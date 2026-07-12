import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "喜功房 | 手づくり弁当と居酒屋料理",
  description: "毎日の弁当と、夜の居酒屋料理。季節の食材を使った手づくりの味をお届けします。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}

