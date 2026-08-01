import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function VocabularyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 已学过的词（有 progress 记录）
  const { data: progress } = await supabase
    .from('user_word_progress')
    .select('word_id, status, correct_count, incorrect_count')
    .eq('user_id', user.id)

  const learnedIds = new Set((progress ?? []).map(p => p.word_id))
  const progressMap = new Map((progress ?? []).map(p => [p.word_id, p]))

  // 所有词（按册/顺序）
  // 注意：Supabase 服务端有 Max Rows 上限（默认 1000），.limit() 无法突破，
  // 必须用 .range() 分页循环拉取，才能取全 4445 个词。
  type WordRow = {
    id: string; entry_id: string; volume: number; chapter: number
    unit: number; sequence: number; korean: string; chinese: string
    pos_zh: string | null; pronunciation: string | null
  }
  const words: WordRow[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data: page } = await supabase
      .from('words')
      .select('id, entry_id, volume, chapter, unit, sequence, korean, chinese, pos_zh, pronunciation')
      .order('volume', { ascending: true })
      .order('sequence', { ascending: true })
      .range(from, from + PAGE - 1)
    if (!page || page.length === 0) break
    words.push(...(page as WordRow[]))
    if (page.length < PAGE) break
  }

  const totalWords = words?.length ?? 0
  const learnedCount = learnedIds.size
  const masteredCount = (progress ?? []).filter(p => p.status === 'mastered').length

  // 按册分组
  const byVolume: Record<number, typeof words> = {}
  for (const w of words ?? []) {
    if (!byVolume[w.volume]) byVolume[w.volume] = []
    byVolume[w.volume]!.push(w)
  }

  const statusLabel: Record<string, { text: string; cls: string }> = {
    new:      { text: '新',   cls: 'bg-blue-50 text-blue-400' },
    learning: { text: '学习中', cls: 'bg-orange-50 text-orange-400' },
    review:   { text: '复习中', cls: 'bg-yellow-50 text-yellow-500' },
    mastered: { text: '已掌握', cls: 'bg-green-50 text-green-500' },
  }

  return (
    <div className="screen-fit bg-orange-50">
      {/* 顶部汇总 */}
      <div className="bg-white px-4 pt-6 pb-4 shadow-sm">
        <h1 className="text-lg font-bold text-gray-800 mb-4">📚 单词本</h1>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-orange-50 rounded-xl p-3">
            <p className="text-2xl font-bold text-orange-500">{learnedCount}</p>
            <p className="text-xs text-gray-400 mt-0.5">已学</p>
          </div>
          <div className="bg-green-50 rounded-xl p-3">
            <p className="text-2xl font-bold text-green-500">{masteredCount}</p>
            <p className="text-xs text-gray-400 mt-0.5">已掌握</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-2xl font-bold text-gray-400">{totalWords - learnedCount}</p>
            <p className="text-xs text-gray-400 mt-0.5">未学</p>
          </div>
        </div>
        {/* 总进度条 */}
        <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-orange-400 rounded-full"
            style={{ width: `${totalWords > 0 ? Math.round((learnedCount / totalWords) * 100) : 0}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 text-right mt-1">
          {totalWords > 0 ? Math.round((learnedCount / totalWords) * 100) : 0}% 进度
        </p>
      </div>

      {/* 按册展示 */}
      <div className="px-4 py-4 space-y-4">
        {Object.entries(byVolume).map(([vol, volWords]) => {
          const volLearned = (volWords ?? []).filter(w => learnedIds.has(w.id)).length
          const volTotal = volWords?.length ?? 0
          return (
            <details key={vol} className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <summary className="flex items-center justify-between px-4 py-4 cursor-pointer select-none list-none">
                <div>
                  <span className="font-semibold text-gray-800">第 {vol} 册</span>
                  <span className="ml-2 text-xs text-gray-400">{volLearned}/{volTotal} 词</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-orange-400 rounded-full"
                      style={{ width: `${volTotal > 0 ? Math.round((volLearned / volTotal) * 100) : 0}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400">▼</span>
                </div>
              </summary>
              <div className="border-t border-gray-50">
                {(volWords ?? []).map(w => {
                  const prog = progressMap.get(w.id)
                  const status = prog?.status ?? 'unlearned'
                  const badge = statusLabel[status]
                  return (
                    <div key={w.id} className="flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-0">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-800 text-sm">{w.korean}</span>
                          {w.pronunciation && (
                            <span className="text-xs text-orange-300">[{w.pronunciation}]</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{w.chinese}</p>
                      </div>
                      <div className="flex items-center gap-2 ml-3 shrink-0">
                        {w.pos_zh && (
                          <span className="text-xs text-gray-300">{w.pos_zh}</span>
                        )}
                        {badge ? (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.text}</span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-50 text-gray-300">未学</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </details>
          )
        })}
      </div>
    </div>
  )
}
