'use client'

import { useEffect, useState, useRef } from 'react'
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

export default function ReviewPage() {
  const router = useRouter()
  const [allWords, setAllWords] = useState<Word[]>([])
  const queueRef = useRef<Word[]>([])
  const mistakeRef = useRef<Word[]>([])

  const [phase, setPhase] = useState<'loading' | 'empty' | 'quiz' | 'detail' | 'mistake_intro' | 'mistake_quiz' | 'mistake_detail' | 'done'>('loading')
  const [question, setQuestion] = useState<Question | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [wasCorrect, setWasCorrect] = useState(false)
  const [stats, setStats] = useState({ total: 0, correct: 0, wrong: 0 })
  const [totalDue, setTotalDue] = useState(0)

  useEffect(() => {
    fetch('/api/study/today?mode=review')
      .then(r => r.json())
      .then(({ words }: { words: Word[] }) => {
        if (!words || words.length === 0) {
          setPhase('empty')
          return
        }
        // SM-2排序：错误多的优先，到期最久的优先
        const sorted = words.sort((a: Word & { progress?: { incorrect_count: number } }, b: Word & { progress?: { incorrect_count: number } }) =>
          (b.progress?.incorrect_count ?? 0) - (a.progress?.incorrect_count ?? 0)
        )
        setAllWords(sorted)
        setTotalDue(sorted.length)
        queueRef.current = sorted
        setQuestion(buildQuestion(sorted[0], sorted))
        setPhase('quiz')
      })
  }, [])

  function handleSelect(option: string) {
    if (selected !== null || !question) return
    const correct = option === question.correctAnswer
    setSelected(option)
    setWasCorrect(correct)
    setStats(s => ({ total: s.total + 1, correct: s.correct + (correct ? 1 : 0), wrong: s.wrong + (correct ? 0 : 1) }))
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

  if (phase === 'loading') return (
    <div className="screen-fit flex items-center justify-center bg-orange-50">
      <div className="text-center"><div className="text-5xl mb-4 animate-bounce">🔄</div>
        <p className="text-gray-400 text-sm">加载复习单词...</p></div>
    </div>
  )

  if (phase === 'empty') return (
    <div className="screen-fit flex items-center justify-center bg-orange-50 p-4">
      <div className="bg-white rounded-2xl shadow-md w-full max-w-sm p-8 text-center">
        <div className="text-5xl mb-4">✨</div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">今日无需复习</h2>
        <p className="text-sm text-gray-400 mb-6">所有单词都在计划内，明天再来！</p>
        <button onClick={() => router.push('/')} className="w-full py-3 bg-orange-500 text-white rounded-xl text-sm font-medium">返回首页</button>
      </div>
    </div>
  )

  if (phase === 'done') {
    const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0
    return (
      <div className="screen-fit flex items-center justify-center bg-orange-50 p-4">
        <div className="bg-white rounded-2xl shadow-md w-full max-w-sm p-8 text-center">
          <div className="text-5xl mb-3">🎉</div>
          <h2 className="text-xl font-bold text-gray-800 mb-1">复习完成！</h2>
          <p className="text-sm text-gray-400 mb-5">今日 {totalDue} 个复习词全部搞定</p>
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
          <button onClick={() => router.push('/')} className="w-full py-3 bg-orange-500 text-white rounded-xl text-sm font-medium">返回首页</button>
        </div>
      </div>
    )
  }

  if (phase === 'mistake_intro') return (
    <div className="screen-fit flex items-center justify-center bg-orange-50 p-4">
      <div className="bg-white rounded-2xl shadow-md w-full max-w-sm p-8 text-center">
        <div className="text-5xl mb-3">📝</div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">还有 {mistakeRef.current.length} 个错题</h2>
        <p className="text-sm text-gray-400 mb-6">全部答对才算完成今日复习！</p>
        <button onClick={startMistakes} className="w-full py-3 bg-orange-500 text-white rounded-xl text-sm font-medium">开始错题重练</button>
      </div>
    </div>
  )

  if (!question) return null

  const isMistake = phase === 'mistake_quiz' || phase === 'mistake_detail'
  const remaining = isMistake ? mistakeRef.current.length : queueRef.current.length
  const total = isMistake ? mistakeRef.current.length + stats.total : totalDue
  const pct = total > 0 ? Math.round(((total - remaining) / total) * 100) : 0

  return (
    <>
      <div className="screen-fit flex flex-col bg-orange-50">
        <div className="px-4 pt-5 pb-3">
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => router.push('/')} className="text-gray-400 text-sm">← 退出</button>
            <span className="text-xs font-medium text-orange-400">{isMistake ? '🔴 错题重练' : '🔄 复习'}</span>
            <span className="text-xs text-gray-400">{total - remaining + 1}/{total}</span>
          </div>
          <div className="h-2 bg-white rounded-full overflow-hidden">
            <div className="h-full bg-blue-400 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-4 py-2">
          <div className="w-full max-w-sm">
            <div className="bg-white rounded-2xl shadow-sm p-7 mb-5 text-center min-h-[160px] flex flex-col items-center justify-center">
              <p className="text-xs text-gray-400 mb-3">
                {question.mode === 'kr2zh' ? '这个韩语是什么意思？' : '这个中文怎么用韩语说？'}
              </p>
              {question.mode === 'kr2zh' ? (
                <>
                  <p className="text-4xl font-bold text-gray-800 mb-1.5 break-all">{question.word.korean}</p>
                  {question.word.pronunciation && <p className="text-sm text-orange-400">[{question.word.pronunciation}]</p>}
                  {question.word.pos_zh && <span className="mt-2 inline-block px-2.5 py-0.5 bg-orange-50 text-orange-400 text-xs rounded-full">{question.word.pos_zh}</span>}
                </>
              ) : (
                <>
                  <p className="text-4xl font-bold text-gray-800 mb-1.5">{question.word.chinese}</p>
                  {question.word.pos_zh && <span className="mt-2 inline-block px-2.5 py-0.5 bg-orange-50 text-orange-400 text-xs rounded-full">{question.word.pos_zh}</span>}
                </>
              )}
            </div>
            <div className="space-y-3">
              {question.options.map((opt, i) => {
                let cls = 'bg-white border-2 border-gray-100 text-gray-700 hover:border-blue-300'
                if (selected !== null) {
                  if (opt === question.correctAnswer) cls = 'bg-green-50 border-2 border-green-400 text-green-700'
                  else if (opt === selected) cls = 'bg-red-50 border-2 border-red-400 text-red-600'
                  else cls = 'bg-white border-2 border-gray-100 text-gray-300'
                }
                return (
                  <button key={i} onClick={() => isMistake ? handleMistakeSelect(opt) : handleSelect(opt)}
                    disabled={selected !== null}
                    className={`w-full py-4 px-4 rounded-xl text-left font-medium text-sm transition-all ${cls}`}>
                    <span className="text-gray-300 mr-3 font-normal">{['A', 'B', 'C', 'D'][i]}</span>{opt}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {(phase === 'detail' || phase === 'mistake_detail') && question && (
        <WordDetailCard
          word={question.word}
          wasCorrect={wasCorrect}
          onNext={phase === 'detail' ? handleDetailNext : handleMistakeDetailNext}
          nextLabel={remaining <= 1 ? (mistakeRef.current.length > 0 && phase === 'detail' ? '进入错题重练 →' : '完成 🎊') : '下一个 →'}
        />
      )}
    </>
  )
}
