import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import BottomNav from "./components/BottomNav";
import ServiceWorkerRegistration from "./components/ServiceWorkerRegistration";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "奇迹泡菜 | Kimchi Bias",
  description: "延世韩国语单词记忆应用",
};

// 锁定移动端视口：不允许缩放，viewport-fit=cover 让安全区 env() 生效
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#f97316",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-orange-50">
        {/* 底部留白 = 导航栏高度(约 60px) + 底部安全区，避免内容被导航遮挡 */}
        <main className="flex-1 w-full max-w-lg mx-auto pb-[calc(60px+env(safe-area-inset-bottom))]">
          {children}
        </main>
        <BottomNav />
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
