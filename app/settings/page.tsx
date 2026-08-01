'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SettingsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [dailyGoal, setDailyGoal] = useState(20)
  const [batchSize, setBatchSize] = useState(10)
  const [prefMode, setPrefMode] = useState<'kr2zh' | 'zh2kr' | 'random'>('random')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [email, setEmail] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return }
      setEmail(user.email ?? '')
    })
    supabase.from('user_settings').select('*').single().then(({ data }) => {
      if (data) {
        setDailyGoal(data.daily_new_words_goal ?? 20)
        setBatchSize(data.batch_add_size ?? 10)
        setPrefMode(data.preferred_mode ?? 'random')
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSave() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('user_settings').upsert({
      user_id: user.id,
      daily_new_words_goal: dailyGoal,
      batch_add_size: batchSize,
      preferred_mode: prefMode,
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="screen-fit bg-orange-50">
      {/* 顶部标题 */}
      <div className="bg-white px-4 pt-safe pt-6 pb-4 shadow-sm">
        <h1 className="text-lg font-bold text-gray-800">⚙️ 设置</h1>
        {email && <p className="text-xs text-gray-400 mt-1 truncate">{email}</p>}
      </div>

      <div className="px-4 py-4 space-y-4 max-w-lg mx-auto">

        {/* 每日新词数 */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-5">每日学习目标</h2>

          <div className="mb-5">
            <div className="flex justify-between items-center mb-3">
              <label className="text-sm text-gray-600">每日新词数</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDailyGoal(v => Math.max(5, v - 5))}
                  className="w-8 h-8 rounded-full bg-orange-50 text-orange-500 font-bold text-lg flex items-center justify-center active:bg-orange-100"
                >−</button>
                <span className="text-2xl font-bold text-orange-500 w-12 text-center">{dailyGoal}</span>
                <button
                  onClick={() => setDailyGoal(v => Math.min(200, v + 5))}
                  className="w-8 h-8 rounded-full bg-orange-50 text-orange-500 font-bold text-lg flex items-center justify-center active:bg-orange-100"
                >+</button>
              </div>
            </div>
            <input
              type="range"
              min={5} max={100} step={5}
              value={dailyGoal}
              onChange={e => setDailyGoal(Number(e.target.value))}
              className="w-full h-2 accent-orange-500"
            />
            <div className="flex justify-between text-xs text-gray-300 mt-1.5">
              <span>5</span><span>25</span><span>50</span><span>75</span><span>100</span>
            </div>
          </div>

          {/* 快捷选项 */}
          <div className="flex gap-2 flex-wrap">
            {[10, 20, 30, 50].map(n => (
              <button
                key={n}
                onClick={() => setDailyGoal(n)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  dailyGoal === n
                    ? 'bg-orange-500 text-white'
                    : 'bg-orange-50 text-orange-400 active:bg-orange-100'
                }`}
              >
                {n} 词
              </button>
            ))}
          </div>
        </div>

        {/* 再加一组词数 */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <div className="flex justify-between items-center mb-1">
            <div>
              <p className="text-sm font-semibold text-gray-700">「再加一组」词数</p>
              <p className="text-xs text-gray-400 mt-0.5">完成目标后可无限追加</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setBatchSize(v => Math.max(5, v - 5))}
                className="w-8 h-8 rounded-full bg-orange-50 text-orange-500 font-bold text-lg flex items-center justify-center active:bg-orange-100"
              >−</button>
              <span className="text-xl font-bold text-orange-500 w-10 text-center">{batchSize}</span>
              <button
                onClick={() => setBatchSize(v => Math.min(50, v + 5))}
                className="w-8 h-8 rounded-full bg-orange-50 text-orange-500 font-bold text-lg flex items-center justify-center active:bg-orange-100"
              >+</button>
            </div>
          </div>
        </div>

        {/* 默认练习模式 */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">默认练习模式</h2>
          <div className="space-y-2.5">
            {([
              { value: 'random', label: '🎲 随机混合', desc: '韩→中 和 中→韩 随机出现' },
              { value: 'kr2zh', label: '🇰🇷 看韩选中', desc: '给出韩语，从四个中文里选' },
              { value: 'zh2kr', label: '🇨🇳 看中选韩', desc: '给出中文，从四个韩语里选' },
            ] as const).map(({ value, label, desc }) => (
              <button
                key={value}
                onClick={() => setPrefMode(value)}
                className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border-2 transition-all text-left ${
                  prefMode === value
                    ? 'border-orange-400 bg-orange-50'
                    : 'border-gray-100 active:border-orange-200'
                }`}
              >
                <div>
                  <p className={`text-sm font-medium ${prefMode === value ? 'text-orange-600' : 'text-gray-700'}`}>
                    {label}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ml-3 ${
                  prefMode === value ? 'border-orange-500 bg-orange-500' : 'border-gray-200'
                }`}>
                  {prefMode === value && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 保存按钮 */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-4 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 disabled:bg-orange-300 text-white font-semibold rounded-2xl transition-colors text-sm"
        >
          {saving ? '保存中...' : saved ? '✅ 已保存！' : '保存设置'}
        </button>

        {/* 退出登录 */}
        <button
          onClick={handleSignOut}
          className="w-full py-4 bg-white border-2 border-red-100 text-red-400 active:bg-red-50 font-medium rounded-2xl transition-colors text-sm"
        >
          退出登录
        </button>

        <div className="h-6" />
      </div>
    </div>
  )
}
