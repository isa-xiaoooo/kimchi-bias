import type { NextConfig } from "next";

// Next.js 16 原生支持 app/manifest.ts + public/sw.js，
// 不再需要 @ducanh2912/next-pwa（它使用 webpack 插件，与 Turbopack 不兼容）
const nextConfig: NextConfig = {};

export default nextConfig;
