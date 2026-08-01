'use client'

import { useEffect } from 'react'

// 在客户端注册 Service Worker（只在生产环境激活）
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => console.log('[SW] registered, scope:', reg.scope))
        .catch((err) => console.warn('[SW] registration failed:', err))
    }
  }, [])

  return null
}
