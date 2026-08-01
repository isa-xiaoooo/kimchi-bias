// 生成 PWA 图标：橙色背景 + 🥬 emoji，输出 192px 和 512px PNG
import sharp from '../node_modules/sharp/lib/index.js'
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'public', 'icons')

function makeSvg(size) {
  const r = Math.round(size * 0.2)
  const fs = Math.round(size * 0.52)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="#f97316"/>
  <text x="${size/2}" y="${size*0.56}" font-size="${fs}" text-anchor="middle"
    dominant-baseline="middle" font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,serif">&#x1F96C;</text>
</svg>`
}

for (const size of [192, 512]) {
  const svg = Buffer.from(makeSvg(size))
  await sharp(svg).png().toFile(join(outDir, `icon-${size}.png`))
  console.log(`icon-${size}.png`)
}
console.log('done')
