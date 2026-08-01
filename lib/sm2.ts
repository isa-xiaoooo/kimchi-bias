// SM-2 间隔重复算法
// 答对 → 拉长复习间隔；答错 → 重置为 1 天

export interface SM2Result {
  easeFactor: number
  intervalDays: number
  nextReviewDate: string  // 'YYYY-MM-DD'
  status: 'learning' | 'review' | 'mastered'
}

export function computeSM2(
  easeFactor: number,
  intervalDays: number,
  correct: boolean
): SM2Result {
  let newEF = easeFactor
  let newInterval: number

  if (correct) {
    // 答对：按 1→3→n*EF 的序列拉长间隔
    if (intervalDays <= 0) {
      newInterval = 1
    } else if (intervalDays === 1) {
      newInterval = 3
    } else {
      newInterval = Math.round(intervalDays * easeFactor)
    }
    newEF = Math.min(3.0, easeFactor + 0.05)
  } else {
    // 答错：重置间隔，降低难度系数
    newInterval = 1
    newEF = Math.max(1.3, easeFactor - 0.2)
  }

  const nextReview = new Date()
  nextReview.setDate(nextReview.getDate() + newInterval)

  // 21 天以上视为掌握
  const status: SM2Result['status'] =
    newInterval >= 21 ? 'mastered' : newInterval > 1 ? 'review' : 'learning'

  return {
    easeFactor: newEF,
    intervalDays: newInterval,
    nextReviewDate: nextReview.toISOString().split('T')[0],
    status,
  }
}
