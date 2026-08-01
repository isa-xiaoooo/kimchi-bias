// 提交答题结果，更新 SM-2 进度
// POST /api/study/answer

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { computeSM2 } from '@/lib/sm2'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { wordId, correct }: { wordId: string; correct: boolean } = body

  if (!wordId || correct === undefined) {
    return NextResponse.json({ error: 'Missing wordId or correct' }, { status: 400 })
  }

  // 查找现有进度
  const { data: existing } = await supabase
    .from('user_word_progress')
    .select('*')
    .eq('user_id', user.id)
    .eq('word_id', wordId)
    .single()

  const easeFactor = existing?.ease_factor ?? 2.5
  const intervalDays = existing?.interval_days ?? 0
  const sm2 = computeSM2(easeFactor, intervalDays, correct)

  const now = new Date().toISOString()

  if (existing) {
    await supabase
      .from('user_word_progress')
      .update({
        status: sm2.status,
        ease_factor: sm2.easeFactor,
        interval_days: sm2.intervalDays,
        next_review_date: sm2.nextReviewDate,
        correct_count: existing.correct_count + (correct ? 1 : 0),
        incorrect_count: existing.incorrect_count + (correct ? 0 : 1),
        last_reviewed_at: now,
      })
      .eq('id', existing.id)
  } else {
    await supabase
      .from('user_word_progress')
      .insert({
        user_id: user.id,
        word_id: wordId,
        status: sm2.status,
        ease_factor: sm2.easeFactor,
        interval_days: sm2.intervalDays,
        next_review_date: sm2.nextReviewDate,
        correct_count: correct ? 1 : 0,
        incorrect_count: correct ? 0 : 1,
        last_reviewed_at: now,
      })
  }

  // ── 更新今日学习记录（study_sessions）────────────────────
  const today = new Date().toISOString().split('T')[0]
  const isNewWord = !existing   // 之前没有记录 = 新词

  // 先查今天是否已有记录
  const { data: todaySession } = await supabase
    .from('study_sessions')
    .select('id, new_words_count, review_words_count, correct_count, total_count')
    .eq('user_id', user.id)
    .eq('date', today)
    .single()

  if (todaySession) {
    await supabase
      .from('study_sessions')
      .update({
        new_words_count: todaySession.new_words_count + (isNewWord ? 1 : 0),
        review_words_count: todaySession.review_words_count + (isNewWord ? 0 : 1),
        correct_count: todaySession.correct_count + (correct ? 1 : 0),
        total_count: todaySession.total_count + 1,
      })
      .eq('id', todaySession.id)
  } else {
    await supabase
      .from('study_sessions')
      .insert({
        user_id: user.id,
        date: today,
        new_words_count: isNewWord ? 1 : 0,
        review_words_count: isNewWord ? 0 : 1,
        correct_count: correct ? 1 : 0,
        total_count: 1,
      })
  }

  return NextResponse.json({ ok: true, sm2 })
}
