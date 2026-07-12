# 名称（仮称）メニュー考案アプリ

弁当と居酒屋のメニューを考えるための個人用Webアプリです。Next.js（App Router）とTypeScriptで作成し、Vercelで公開できます。

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

- トップページ: `app/page.tsx`
- 弁当メニュー画面: `app/bento/page.tsx`
- 居酒屋メニュー画面: `app/izakaya/page.tsx`
- 色やレイアウト: `app/globals.css`
- ページタイトル・説明文: `app/layout.tsx`
