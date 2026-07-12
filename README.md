# 喜功房 弁当・居酒屋メニューサイト

Next.js（App Router）とTypeScriptで作成した、Vercel向けのWebサイトです。

## ローカル起動

```bash
npm install
npm run dev
```

ブラウザで `http://localhost:3000` を開きます。

## Vercelへの公開

1. このリポジトリをGitHubへpushします。
2. Vercelの「Add New Project」からGitHubリポジトリを選択します。
3. Framework Presetが `Next.js` であることを確認し、そのままDeployします。

ビルドコマンドや出力先の追加設定は不要です。

## 編集箇所

- メニュー・価格・店舗情報: `app/page.tsx`
- 色やレイアウト: `app/globals.css`
- ページタイトル・説明文: `app/layout.tsx`

電話番号、住所、営業時間は仮の内容です。公開前に実際の店舗情報へ置き換えてください。
