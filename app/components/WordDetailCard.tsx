'use client'

interface Word {
  id: string
  korean: string
  chinese: string
  english?: string
  pos_zh?: string
  pronunciation?: string
  origin_detail?: string
}

interface WordDetailCardProps {
  word: Word
  wasCorrect: boolean
  onNext: () => void
  nextLabel?: string
}

export default function WordDetailCard({ word, wasCorrect, onNext, nextLabel = '下一个 →' }: WordDetailCardProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg bg-white rounded-3xl p-6 pb-8 max-h-[90vh] overflow-y-auto">
        {/* 答题结果 */}
        <div className={`rounded-xl px-4 py-2.5 mb-5 text-sm font-medium ${
          wasCorrect ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
        }`}>
          {wasCorrect ? '✅ 答对了！继续保持' : '❌ 答错了，记住它！'}
        </div>

        {/* 单词主体 */}
        <div className="text-center mb-5">
          <p className="text-4xl font-bold text-gray-800 mb-1">{word.korean}</p>
          {word.pronunciation && (
            <p className="text-sm text-orange-400 mb-1">[{word.pronunciation}]</p>
          )}
          <p className="text-xl text-gray-600 mb-2">{word.chinese}</p>
          {word.pos_zh && (
            <span className="inline-block px-2.5 py-0.5 bg-orange-50 text-orange-400 text-xs rounded-full">
              {word.pos_zh}
            </span>
          )}
        </div>

        {/* 详情信息 */}
        <div className="space-y-2.5 mb-6">
          {word.english && (
            <div className="flex gap-3 items-start">
              <span className="text-xs text-gray-400 w-12 shrink-0 pt-0.5">英文</span>
              <span className="text-sm text-gray-600">{word.english}</span>
            </div>
          )}
          {word.origin_detail && (
            <div className="flex gap-3 items-start">
              <span className="text-xs text-gray-400 w-12 shrink-0 pt-0.5">词根</span>
              <span className="text-sm text-gray-600">{word.origin_detail}</span>
            </div>
          )}
          <div className="flex gap-3 items-start">
            <span className="text-xs text-gray-400 w-12 shrink-0 pt-0.5">例句</span>
            <span className="text-sm text-gray-300 italic">V2 版本加入</span>
          </div>
          <div className="flex gap-3 items-start">
            <span className="text-xs text-gray-400 w-12 shrink-0 pt-0.5">发音</span>
            <span className="text-sm text-gray-300 italic">V2 版本加入</span>
          </div>
        </div>

        <button
          onClick={onNext}
          className="w-full py-3.5 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-semibold rounded-2xl transition-colors"
        >
          {nextLabel}
        </button>
      </div>
    </div>
  )
}
