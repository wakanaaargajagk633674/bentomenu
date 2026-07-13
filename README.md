# 名称（仮称）メニュー考案アプリ

弁当と居酒屋のメニューを考えるための個人用Webアプリです。Next.js（App Router）とTypeScriptで作成し、Vercelで公開できます。

## ローカル起動

```bash
npm install
npm run dev
```

ブラウザで `http://localhost:3000` を開きます。

`.env.example`を参考に、Supabaseの接続情報を`.env.local`へ設定してください。秘密情報をGitへコミットしないでください。

弁当候補の生成にはOpenAI Responses APIの`gpt-5.5`を使用します。ローカルとVercelの環境変数に`OPENAI_API_KEY`を設定してください。APIキーはサーバー側のみで使用され、ブラウザには公開されません。

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

調査内容を確認するためのHTMLレポートは `report/culinary-foundation-report.html`、取得ソースの詳細は `report/culinary-source-details.html`、作業履歴は `report/work-log.md` です。

## データベース

Supabaseの初期スキーマは `supabase/migrations/` で管理します。現在の構造と初期化範囲は `report/database/schema-initialization.html` に記録しています。
