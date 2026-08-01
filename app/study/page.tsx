'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import WordDetailCard from '@/app/components/WordDetailCard'

interface Word {
  id: string
  korean: string
  chinese: string
  english?: string
  pos_zh?: string
  pronunciation?: string
  origin_detail?: string
  type: 'new' | 'review'
}

interface Question {
  word: Word
  options: string[]
  correctAnswer: string
  mode: 'kr2zh' | 'zh2kr'
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5)
}

function makeOptions(correct: string, pool: Word[], mode: 'kr2zh' | 'zh2kr'): string[] {
  const others = shuffle(
    pool.map(w => mode === 'kr2zh' ? w.chinese : w.korean).filter(v => v !== correct)
  ).slice(0, 3)
  return shuffle([...others, correct])
}

function buildQuestion(word: Word, pool: Word[]): Question {
  const mode: 'kr2zh' | 'zh2kr' = Math.random() > 0.5 ? 'kr2zh' : 'zh2kr'
  const correct = mode === 'kr2zh' ? word.chinese : word.korean
  return { word, options: makeOptions(correct, pool, mode), correctAnswer: correct, mode }
}

type Phase = 'loading' | 'quiz' | 'detail' | 'mistake_intro' | 'mistake_quiz' | 'mistake_detail' | 'done'

export default function StudyPage() {
  const router = useRouter()

  const [allWords, setAllWords] = useState<Word[]>([])
  const [batchSize, setBatchSize] = useState(10)
  const queueRef = useRef<Word[]>([])
  const mistakeRef = useRef<Word[]>([])

  const [phase, setPhase] = useState<Phase>('loading')
  const [question, setQuestion] = useState<Question | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [wasCorrect, setWasCorrect] = useState(false)
  const [stats, setStats] = useState({ total: 0, correct: 0, wrong: 0 })
  const [loadingExtra, setLoadingExtra] = useState(false)

  // 加载新词（初次或追加）
  const loadWords = useCallback(async (extra = 0) => {
    const url = extra > 0
      ? `/api/study/today?mode=new&extra=${extra}`
      : '/api/study/today?mode=new'
    const res = await fetch(url)
    const { words, batchSize: bs } = await res.json()
    return { words: (words ?? []) as Word[], batchSize: bs as number }
  }, [])

  useEffect(() => {
    loadWords(0).then(({ words, batchSize: bs }) => {
      setBatchSize(bs ?? 10)
      if (!words || words.length === 0) {
        setPhase('done')
        return
      }
      setAllWords(words)
      queueRef.current = words
      setQuestion(buildQuestion(words[0], words))
      setPhase('quiz')
    })
  }, [loadWords])

  // 再加一组
  async function handleAddMore() {
    setLoadingExtra(true)
    const { words: extra, batchSize: bs } = await loadWords(batchSize)
    setBatchSize(bs ?? batchSize)
    if (!extra || extra.length === 0) {
      setLoadingExtra(false)
      return
    }
    const newAll = [...allWords, ...extra]
    setAllWords(newAll)
    queueRef.current = extra   // 新队列只包含追加的词
    mistakeRef.current = []
    setSelected(null)
    setQuestion(buildQuestion(extra[0], newAll))
    setPhase('quiz')
    setLoadingExtra(false)
  }

  function handleSelect(option: string) {
    if (selected !== null || !question) return
    const correct = option === question.correctAnswer
    setSelected(option)
    setWasCorrect(correct)
    setStats(s => ({
      total: s.total + 1,
      correct: s.correct + (correct ? 1 : 0),
      wrong: s.wrong + (correct ? 0 : 1),
    }))
    fetch('/api/study/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wordId: question.word.id, correct }),
    })
    if (!correct) mistakeRef.current = [...mistakeRef.current, question.word]
    setPhase('detail')
  }

  function handleDetailNext() {
    queueRef.current = queueRef.current.slice(1)
    setSelected(null)
    if (queueRef.current.length === 0) {
      setPhase(mistakeRef.current.length > 0 ? 'mistake_intro' : 'done')
      return
    }
    setQuestion(buildQuestion(queueRef.current[0], allWords))
    setPhase('quiz')
  }

  function handleMistakeSelect(option: string) {
    if (selected !== null || !question) return
    const correct = option === question.correctAnswer
    setSelected(option)
    setWasCorrect(correct)
    if (!correct) mistakeRef.current = [...mistakeRef.current.slice(1), question.word]
    setPhase('mistake_detail')
  }

  function handleMistakeDetailNext() {
    if (wasCorrect) mistakeRef.current = mistakeRef.current.slice(1)
    setSelected(null)
    if (mistakeRef.current.length === 0) { setPhase('done'); return }
    setQuestion(buildQuestion(mistakeRef.current[0], allWords))
    setPhase('mistake_quiz')
  }

  function startMistakes() {
    setQuestion(buildQuestion(mistakeRef.current[0], allWords))
    setSelected(null)
    setPhase('mistake_quiz')
  }

  // ── 渲染：加载中 ──
  if (phase === 'loading') return (
    <div className="screen-fit flex items-center justify-center bg-orange-50">
      <div className="text-center">
        <div className="text-5xl mb-4 animate-bounce">🥬</div>
        <p className="text-gray-400 text-sm">准备今日新词...</p>
      </div>
    </div>
  )

  // ── 渲染：完成 ──
  if (phase === 'done') {
    const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0
    return (
      <div className="screen-fit flex items-center justify-center bg-orange-50 p-4">
        <div className="bg-white rounded-2xl shadow-md w-full max-w-sm p-8 text-center">
          <div className="text-5xl mb-3">🎊</div>
          <h2 className="text-xl font-bold text-gray-800 mb-1">今日新词完成！</h2>
          <p className="text-sm text-gray-400 mb-5">去复习页做每日复习吧</p>
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { val: stats.total, label: '答题数', color: 'text-orange-500', bg: 'bg-orange-50' },
              { val: `${accuracy}%`, label: '正确率', color: 'text-green-500', bg: 'bg-green-50' },
              { val: stats.wrong, label: '错题数', color: 'text-red-400', bg: 'bg-red-50' },
            ].map(({ val, label, color, bg }) => (
              <div key={label} className={`${bg} rounded-xl p-3`}>
                <p className={`text-2xl font-bold ${color}`}>{val}</p>
                <p className="text-xs text-gray-400 mt-1">{label}</p>
              </div>
            ))}
          </div>
          {/* 再加一组 */}
          <button
            onClick={handleAddMore}
            disabled={loadingExtra}
            className="w-full py-3 mb-3 bg-orange-100 hover:bg-orange-200 text-orange-600 font-medium rounded-xl text-sm transition-colors disabled:opacity-50"
          >
            {loadingExtra ? '加载中...' : `再加 ${batchSize} 个 →`}
          </button>
          <button
            onClick={() => router.push('/')}
            className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-xl text-sm font-medium transition-colors"
          >
            返回首页
          </button>
        </div>
      </div>
    )
  }

  // ── 渲染：错题提示 ──
  if (phase === 'mistake_intro') return (
    <div className="screen-fit flex items-center justify-center bg-orange-50 p-4">
      <div className="bg-white rounded-2xl shadow-md w-full max-w-sm p-8 text-center">
        <div className="text-5xl mb-3">📝</div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">还有 {mistakeRef.current.length} 个错题</h2>
        <p className="text-sm text-gray-400 mb-6">全部答对才算完成今日新词！</p>
        <button onClick={startMistakes}
          className="w-full py-3 bg-orange-500 text-white rounded-xl text-sm font-medium">
          开始错题重练
        </button>
      </div>
    </div>
  )

  if (!question) return null

  const isMistake = phase === 'mistake_quiz' || phase === 'mistake_detail'
  const remaining = isMistake ? mistakeRef.current.length : queueRef.current.length
  const total = isMistake
    ? mistakeRef.current.length + stats.total
    : (allWords.length - (stats.total - queueRef.current.length - (allWords.length - queueRef.current.length - stats.wrong)))
  const pct = (remaining > 0 && total > 0)
    ? Math.round(((total - remaining) / total) * 100)
    : 100

  return (
    <>
      <div className="screen-fit flex flex-col bg-orange-50">
        {/* 顶部进度 */}
        <div className="px-4 pt-5 pb-3 max-w-lg mx-auto w-full">
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => router.push('/')} className="text-gray-400 text-sm px-1 py-1">← 退出</button>
            <span className="text-xs font-medium text-gray-500">
              {isMistake ? '🔴 错题重练' : '🌱 新词'}
            </span>
            <span className="text-xs text-gray-400">{total - remaining + 1}/{total}</span>
          </div>
          <div className="h-2 bg-white rounded-full overflow-hidden shadow-inner">
            <div
              className="h-full bg-orange-400 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* 题目区 */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-2">
          <div className="w-full max-w-sm">
            {/* 单词展示 */}
            <div className="bg-white rounded-2xl shadow-sm p-6 mb-5 text-center min-h-[150px] flex flex-col items-center justify-center">
              <p className="text-xs text-gray-400 mb-3">
                {question.mode === 'kr2zh' ? '这个韩语是什么意思？' : '这个中文怎么用韩语说？'}
              </p>
              {question.mode === 'kr2zh' ? (
                <>
                  <p className="text-4xl font-bold text-gray-800 mb-1.5 break-all leading-tight">
                    {question.word.korean}
                  </p>
                  {question.word.pronunciation && (
                    <p className="text-sm text-orange-400">[{question.word.pronunciation}]</p>
                  )}
                  {question.word.pos_zh && (
                    <span className="mt-2 inline-block px-2.5 py-0.5 bg-orange-50 text-orange-400 text-xs rounded-full">
                      {question.word.pos_zh}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <p className="text-4xl font-bold text-gray-800 mb-1.5">{question.word.chinese}</p>
                  {question.word.pos_zh && (
                    <span className="mt-2 inline-block px-2.5 py-0.5 bg-orange-50 text-orange-400 text-xs rounded-full">
                      {question.word.pos_zh}
                    </span>
                  )}
                </>
              )}
            </div>

            {/* 四个选项 */}
            <div className="space-y-3">
              {question.options.map((opt, i) => {
                let cls = 'bg-white border-2 border-gray-100 text-gray-700 active:scale-[0.98]'
                if (selected !== null) {
                  if (opt === question.correctAnswer) cls = 'bg-green-50 border-2 border-green-400 text-green-700'
                  else if (opt === selected) cls = 'bg-red-50 border-2 border-red-400 text-red-600'
                  else cls = 'bg-white border-2 border-gray-100 text-gray-300'
                } else {
                  cls += ' hover:border-orange-300'
                }
                return (
                  <button
                    key={i}
                    onClick={() => isMistake ? handleMistakeSelect(opt) : handleSelect(opt)}
                    disabled={selected !== null}
                    className={`w-full py-4 px-4 rounded-xl text-left font-medium text-sm transition-all ${cls}`}
                  >
                    <span className="text-gray-300 mr-3 font-normal">{['A', 'B', 'C', 'D'][i]}</span>
                    {opt}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 单词详情弹窗（答完每题都弹） */}
      {(phase === 'detail' || phase === 'mistake_detail') && question && (
        <WordDetailCard
          word={question.word}
          wasCorrect={wasCorrect}
          onNext={phase === 'detail' ? handleDetailNext : handleMistakeDetailNext}
          nextLabel={
            phase === 'detail' && queueRef.current.length <= 1
              ? mistakeRef.current.length > 0 ? '进入错题重练 →' : '完成 🎊'
              : phase === 'mistake_detail' && mistakeRef.current.length <= 1
                ? '完成 🎊'
                : '下一个 →'
          }
        />
      )}
    </>
  )
}
