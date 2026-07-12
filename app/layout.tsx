import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "名称（仮称）| メニュー考案アプリ",
  description: "弁当と居酒屋のメニューを考えるための個人用Webアプリです。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
