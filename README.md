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

## メニュー考案の基礎

弁当・居酒屋メニュー、レシピ、盛り付けを考える際は、必ず `.agents/skills/culinary-menu-foundation/SKILL.md` とその参照資料を使用します。和食・中華・韓国料理・洋食の設計思想、弁当の時間経過と食品安全、居酒屋の提供設計をまとめています。

調査内容を確認するためのHTMLレポートは `research/culinary-foundation-report.html` です。
