# 名称（仮称）メニュー考案アプリ

弁当と居酒屋のメニューを考えるための個人用Webアプリです。Next.js（App Router）とTypeScriptで作成し、Vercelで公開できます。

## ローカル起動

```bash
npm install
npm run dev
```

ブラウザで `http://localhost:3000` を開きます。

`.env.example`を参考に、Supabaseの接続情報を`.env.local`へ設定してください。秘密情報をGitへコミットしないでください。

弁当候補の生成にはOpenAI Responses APIの`gpt-5.5`、完成写真にはImage APIの`gpt-image-2`を使用します。ローカルとVercelの環境変数に`OPENAI_API_KEY`、`OPENAI_TEXT_MODEL=gpt-5.5`、`OPENAI_IMAGE_MODEL=gpt-image-2`を設定してください。APIキーはサーバー側のみで使用され、ブラウザには公開されません。

献立は先にJSONで表示され、その検証済みレシピと`imageSpec`からサーバーが画像プロンプトを組み立てます。写真は候補ごとに2枚ずつ生成され、失敗した写真だけを再試行できます。画像はAIによる盛り付け参考であり、調理時はレシピの加熱・冷却・保冷指示を優先してください。

弁当画面ではジャンル、売価、ターゲット性別、販売地域に加えて、春・夏・秋・冬または「おまかせ」を選択できます。「おまかせ」は日本時間の基準日から季節を判断し、旬、気候、香り、色、冷めた時の品質と持ち運び安全へ反映します。

居酒屋画面では、弁当・定食・コースではなく「日替わりの逸品」一皿を指定して4案生成できます。ジャンル、売価、合わせたい酒、季節を選び、1〜2人前のレシピ、仕込み、注文後の提供時間、採算と完成写真を確認できます。

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

### 保存したメニュー

- 生成候補の「このメニューを保存」から、完全なレシピスナップショットを`public.saved_menus`へ保存します。
- 完成画像は非公開Storageバケット`saved-menu-images`へ保存します。
- `/saved`で弁当・居酒屋をカード表示し、`/saved/[id]`で写真、レシピ、採算、安全情報を確認できます。
- 保存欄はSupabase Anonymous AuthとRLSでブラウザごとに分離されます。ブラウザデータを消すと匿名セッションへ再アクセスできない場合があります。
