import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

// 强制每次请求都重新查询，不走 Next.js 静态缓存
export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = new Date().toISOString().split('T')[0]

  // 今日学习统计——study_sessions 由答题 API 实时维护
  // force-dynamic 确保每次请求都读最新数据，不走缓存
  const { data: session } = await supabase
    .from('study_sessions')
    .select('new_words_count, review_words_count, correct_count, total_count')
    .eq('user_id', user.id)
    .eq('date', today)
    .single()

  // 用户设置
  const { data: settings } = await supabase
    .from('user_settings')
    .select('daily_new_words_goal')
    .eq('user_id', user.id)
    .single()
  const dailyGoal = settings?.daily_new_words_goal ?? 20

  // 累计学过的词数
  const { count: learnedCount } = await supabase
    .from('user_word_progress')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  // 今日到期复习数
  const { count: reviewDueCount } = await supabase
    .from('user_word_progress')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .in('status', ['learning', 'review'])
    .lte('next_review_date', today)

  // 连续打卡天数（从今天往前算）
  const { data: recentSessions } = await supabase
    .from('study_sessions')
    .select('date')
    .eq('user_id', user.id)
    .gte('total_count', 1)
    .order('date', { ascending: false })
    .limit(365)

  let streak = 0
  if (recentSessions && recentSessions.length > 0) {
    const dates = recentSessions.map(s => s.date)
    const cursor = new Date()
    for (let i = 0; i < 365; i++) {
      const d = cursor.toISOString().split('T')[0]
      if (dates.includes(d)) {
        streak++
        cursor.setDate(cursor.getDate() - 1)
      } else {
        break
      }
    }
  }

  const todayNew = session?.new_words_count ?? 0
  const todayReview = session?.review_words_count ?? 0
  const newProgress = Math.min(100, Math.round((todayNew / dailyGoal) * 100))

  async function signOut() {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
  }

  return (
    <div className="screen-fit bg-gradient-to-br from-orange-50 to-red-50 p-4">
      <div className="max-w-sm mx-auto pt-8">
        {/* 标题栏 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-800">奇迹泡菜 🥬</h1>
            <p className="text-xs text-gray-400">Kimchi Bias</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-orange-500">
              {streak > 0 ? `🔥 ${streak}` : '🌱'}
            </p>
            <p className="text-xs text-gray-400">{streak > 0 ? `连续 ${streak} 天` : '开始打卡'}</p>
          </div>
        </div>

        {/* 今日任务卡片 */}
        <div className="bg-white rounded-2xl shadow-md p-6 mb-4">
          <h2 className="text-sm font-semibold text-gray-500 mb-4">今日任务</h2>

          {/* 新词进度 */}
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-gray-600">🌱 新词</span>
              <span className="text-gray-400">{todayNew} / {dailyGoal}</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-orange-400 rounded-full transition-all"
                style={{ width: `${newProgress}%` }}
              />
            </div>
          </div>

          {/* 复习 */}
          <div className="flex items-center justify-between py-2 border-t border-gray-50">
            <span className="text-sm text-gray-600">🔄 待复习</span>
            <span className={`text-sm font-medium ${(reviewDueCount ?? 0) > 0 ? 'text-orange-500' : 'text-gray-300'}`}>
              {reviewDueCount ?? 0} 个
            </span>
          </div>
          <div className="flex items-center justify-between py-2 border-t border-gray-50">
            <span className="text-sm text-gray-600">✅ 今日已复习</span>
            <span className="text-sm text-gray-400">{todayReview} 个</span>
          </div>
        </div>

        {/* 开始学习按钮 */}
        <Link
          href="/study"
          className="block w-full py-4 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white text-center font-semibold rounded-2xl shadow-md transition-colors mb-4"
        >
          开始学习 →
        </Link>

        {/* 总体进度 */}
        <div className="bg-white rounded-2xl shadow-md p-6 mb-4">
          <h2 className="text-sm font-semibold text-gray-500 mb-4">总体进度</h2>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div>
              <p className="text-2xl font-bold text-gray-800">{learnedCount ?? 0}</p>
              <p className="text-xs text-gray-400 mt-1">已学单词</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-300">4445</p>
              <p className="text-xs text-gray-400 mt-1">词库总数</p>
            </div>
          </div>
          {/* 总进度条 */}
          <div className="mt-4">
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-400 rounded-full"
                style={{ width: `${Math.round(((learnedCount ?? 0) / 4445) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 text-right mt-1">
              {Math.round(((learnedCount ?? 0) / 4445) * 100)}%
            </p>
          </div>
        </div>

        {/* 底部：退出登录 */}
        <div className="text-center pb-8">
          <form action={signOut}>
            <button type="submit" className="text-xs text-gray-300 hover:text-red-400 transition-colors">
              退出登录
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
