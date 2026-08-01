import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '奇迹泡菜 Kimchi Bias',
    short_name: '奇迹泡菜',
    description: '延世韩国语单词记忆应用',
    start_url: '/',
    display: 'standalone',
    background_color: '#fff7ed',
    theme_color: '#f97316',
    orientation: 'portrait',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
}
