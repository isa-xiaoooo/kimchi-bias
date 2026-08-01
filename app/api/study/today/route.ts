// 获取今日学习词列表
// GET /api/study/today?mode=new|review
// GET /api/study/today?mode=new&extra=10  （再加一组）

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('mode') ?? 'new'
  const extra = parseInt(searchParams.get('extra') ?? '0', 10)

  const { data: settings } = await supabase
    .from('user_settings')
    .select('daily_new_words_goal, batch_add_size')
    .eq('user_id', user.id)
    .single()
  const dailyGoal = settings?.daily_new_words_goal ?? 20
  const batchSize = settings?.batch_add_size ?? 10
  const today = new Date().toISOString().split('T')[0]

  // ── 复习词 ────────────────────────────────────────────────────────────────
  if (mode === 'review') {
    // 拉取用户所有进度记录（含今天学的新词）
    const { data: allProgress } = await supabase
      .from('user_word_progress')
      .select('word_id, status, ease_factor, interval_days, incorrect_count, correct_count, next_review_date, last_reviewed_at')
      .eq('user_id', user.id)

    if (!allProgress || allProgress.length === 0) {
      return NextResponse.json({ words: [], total: 0 })
    }

    // 今天到期 或 今天刚学的词都纳入复习范围
    const eligible = allProgress.filter(p => {
      const isDue = p.next_review_date && p.next_review_date <= today
      const isLearnedToday = p.last_reviewed_at && p.last_reviewed_at.startsWith(today)
      return isDue || isLearnedToday
    })

    if (eligible.length === 0) {
      return NextResponse.json({ words: [], total: 0 })
    }

    // 多因子优先级评分（分数越高越先出现）
    //
    // 核心逻辑：逾期天数权重最大，保证"等得久的词"一定排在前面
    // 这样无论词本身难不难，只要到期够久就会出现，确保所有词都能轮到
    //
    // 因子权重：
    //   逾期天数 × 10  → 主因子，决定覆盖公平性
    //   错误率   × 3   → 次因子，同等逾期时，错得多的稍微提前
    //   难度系数 × 1   → 弱因子，几乎不影响排序，只是平局时的参考
    const scored = eligible.map(p => {
      const dueDate = new Date(p.next_review_date ?? today)
      const overdueDays = Math.max(0, (Date.now() - dueDate.getTime()) / 86400000)
      const total = (p.correct_count ?? 0) + (p.incorrect_count ?? 0)
      const errorRate = total > 0 ? (p.incorrect_count ?? 0) / total : 0
      // ease_factor 越低 = 这个词越难 → difficulty 越高
      const difficulty = Math.max(0, 3.0 - (p.ease_factor ?? 2.5))
      const score = overdueDays * 10 + errorRate * 3 + difficulty * 1
      return { ...p, _score: score }
    })

    // 按分数降序排列
    scored.sort((a, b) => b._score - a._score)

    const wordIds = scored.map(p => p.word_id)
    // 分批拉取词条（Supabase in() 支持数组）
    const { data: reviewWords } = await supabase
      .from('words')
      .select('id, korean, chinese, english, pos_zh, pronunciation, origin_detail')
      .in('id', wordIds)

    const wordMap = new Map((reviewWords ?? []).map(w => [w.id, w]))
    const progressMap = new Map(scored.map(p => [p.word_id, p]))

    // 按评分顺序返回（保持排序）
    const words = wordIds
      .map(id => {
        const w = wordMap.get(id)
        if (!w) return null
        return { ...w, progress: progressMap.get(id), type: 'review' as const }
      })
      .filter(Boolean)

    return NextResponse.json({ words, total: words.length })
  }

  // ── 新词 ──────────────────────────────────────────────────────────────────
  // 1. 拉取用户所有已学 word_id
  const { data: learnedRows } = await supabase
    .from('user_word_progress')
    .select('word_id')
    .eq('user_id', user.id)
  const learnedIds = (learnedRows ?? []).map(r => r.word_id as string)
  const learnedSet = new Set(learnedIds)

  // 2. 今天已答题的词数（用于计算今日已学多少新词）
  const { data: todayAnswered } = await supabase
    .from('user_word_progress')
    .select('word_id')
    .eq('user_id', user.id)
    .gte('last_reviewed_at', today + 'T00:00:00')
  const todayCount = todayAnswered?.length ?? 0

  // 3. 计算需要多少新词
  const needed = extra > 0 ? extra : Math.max(0, dailyGoal - todayCount)
  if (needed === 0) {
    return NextResponse.json({ words: [], total: 0, todayDone: true, batchSize })
  }

  // 4. 找当前进度所在册
  //    逻辑：已学词里 volume 最大的那一册，若该册未学完则继续；若学完了则进下一册
  let currentVolume = 1
  if (learnedIds.length > 0) {
    // 查已学词里最高的 volume
    const { data: maxVolRow } = await supabase
      .from('words')
      .select('volume')
      .in('id', learnedIds)
      .order('volume', { ascending: false })
      .limit(1)
    const maxVol = maxVolRow?.[0]?.volume ?? 1

    // 检查该册是否已经全部学完
    const { count: totalInMaxVol } = await supabase
      .from('words')
      .select('*', { count: 'exact', head: true })
      .eq('volume', maxVol)
    const { count: learnedInMaxVol } = await supabase
      .from('words')
      .select('*', { count: 'exact', head: true })
      .eq('volume', maxVol)
      .in('id', learnedIds)

    if ((learnedInMaxVol ?? 0) >= (totalInMaxVol ?? 1)) {
      // 当前册已学完，进入下一册
      currentVolume = maxVol + 1
    } else {
      currentVolume = maxVol
    }
  }

  // 5. 从 currentVolume 开始拉取候选词（多拉一些用于过滤和随机）
  const fetchLimit = Math.min(needed * 10 + 50, 500)
  let candidates: {
    id: string; korean: string; chinese: string; english?: string;
    pos_zh?: string; pronunciation?: string; origin_detail?: string;
    volume: number; sequence: number;
  }[] = []

  for (let vol = currentVolume; vol <= 6 && candidates.length < needed * 3; vol++) {
    const { data: volWords } = await supabase
      .from('words')
      .select('id, korean, chinese, english, pos_zh, pronunciation, origin_detail, volume, sequence')
      .eq('volume', vol)
      .order('sequence', { ascending: true })
      .limit(fetchLimit)

    const unlearned = (volWords ?? []).filter(w => !learnedSet.has(w.id))
    candidates = [...candidates, ...unlearned]
  }

  if (candidates.length === 0) {
    return NextResponse.json({ words: [], total: 0, todayDone: true, batchSize })
  }

  // 6. 按册分组，每册内随机打乱，再按册顺序拼合（保证第1册用完才进第2册）
  const byVol: Record<number, typeof candidates> = {}
  for (const w of candidates) {
    if (!byVol[w.volume]) byVol[w.volume] = []
    byVol[w.volume].push(w)
  }
  for (const v of Object.keys(byVol)) {
    byVol[Number(v)] = byVol[Number(v)].sort(() => Math.random() - 0.5)
  }
  const finalWords = Object.keys(byVol)
    .map(Number).sort((a, b) => a - b)
    .flatMap(v => byVol[v])
    .slice(0, needed)

  return NextResponse.json({
    words: finalWords.map(w => ({ ...w, type: 'new' })),
    total: finalWords.length,
    todayDone: false,
    batchSize,
  })
}
