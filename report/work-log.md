# 作業ログ

このファイルは作業ごとに追記する。過去の記録は原則として変更・削除しない。

## 2026-07-13 — Vercel対応の初期サイト

- 依頼: 空のGitHubリポジトリにVercelで動くWebサイトの土台を作成する。
- 実施: Next.js、TypeScript、ESLint、レスポンシブ画面を導入し、依存関係を安全なバージョンへ固定。
- 検証: `npm run lint`、`npm run build`、`npm audit`（脆弱性0件）。
- コミット: `4813498 Initial Vercel-ready menu site`
- Push: `origin/main`へ成功。

## 2026-07-13 — 個人用メニュー考案アプリへの変更

- 依頼: 店舗サイトではなく、弁当と居酒屋のメニューを考える個人用Webアプリにする。
- 実施: トップを2つの選択ボタンに整理し、`/bento`、`/izakaya`を追加。名称を「名称（仮称）」に変更。自動コミット・push規則を`AGENTS.md`へ追加。
- 検証: `npm run lint`、`npm run build`。
- コミット: `b272b45 Refocus app on personal menu planning`
- Push: `origin/main`へ成功。

## 2026-07-13 — 料理メニュー設計の基礎スキル

- 依頼: 和食・中華・韓国・洋食の一流の考え方、レシピ、盛り付け、色彩をWeb調査し、弁当・居酒屋献立の大前提となるスキルへ取り込む。
- 実施: 公的機関、料理教育機関、MICHELIN掲載料理人を中心に26ソースを調査。`.agents/skills/culinary-menu-foundation/`へ中核手順と7つの参照資料を作成。料理企画時の必須適用規則を`AGENTS.md`へ追加。
- 主な変更: `.agents/skills/culinary-menu-foundation/`、`AGENTS.md`、`README.md`、料理基礎調査HTML。
- ソース: 農林水産省、厚生労働省、Kikkoman食文化資料、Korea.net、CIA、ICE、MICHELIN Guideなど26件。詳細は`culinary-source-details.html`を参照。
- 検証: スキル構造検証成功、`npm run lint`成功、`npm run build`成功、`git diff --check`成功。
- コミット: `d3e9171 Add researched culinary planning foundation skill`
- Push: `origin/main`へ反映済み。

## 2026-07-13 — 作業ログと詳細ソースレポートの恒久化

- 依頼: pushと同時に必ず作業ログを残し、取得したソースの詳細を`report/`内のHTMLにする。
- 実施: `report/`を新設し、既存調査レポートを移動。全26ソースの詳細レポートと本作業ログを追加。ログ・レポート作成を`AGENTS.md`の絶対ルールに追加。
- 主な変更: `AGENTS.md`、`README.md`、`report/culinary-foundation-report.html`、`report/culinary-source-details.html`、`report/work-log.md`。
- ソース追加: なし。前回取得した26ソースの詳細情報を再整理。
- 検証: `npm run lint`成功、`npm run build`成功、`git diff --check`成功、2つのHTMLでDOCTYPE・UTF-8指定・終了タグを確認。
- 予定コミット: `Add permanent work log and detailed research report`
- コミット: `f38da8a Add permanent work log and detailed research report`
- Push: `origin/main`へ成功。

## 2026-07-13 — Supabase接続とメニューデータベース初期化

- 依頼: Supabaseプロジェクト`bgudwgqbfdztgryjwaxt`を接続先とし、既存データを全削除してよい条件で作業する。
- 実施: 認証情報を値を表示せず検出。直接接続はIPv6到達不可だったため、SingaporeリージョンのShared Pooler経由で接続。`public`スキーマ内の旧テーブル4件を削除し、メニュー考案用7テーブル、列挙型、外部キー、インデックス、更新トリガー、Authプロフィール作成トリガー、RLSポリシーを作成。Supabase JSクライアントと環境変数例を追加。
- 削除した旧テーブル: `extracted_patterns`、`interview_messages`、`interview_sessions`、`pattern_feedback`。
- 保持した管理領域: `auth`、`storage`、`realtime`、`extensions`。
- 新規テーブル: `profiles`、`ingredients`、`recipes`、`recipe_ingredients`、`menu_plans`、`menu_plan_items`、`research_sources`。
- 主な変更: `supabase/`、`lib/supabase/client.ts`、`.env.example`、`package.json`、`package-lock.json`、`README.md`、`report/database/schema-initialization.html`。
- 認証上の注意: 保存された`SUPABASE_ACCESS_TOKEN`はPAT形式ではなかったためCLI linkには不使用。データベースパスワードとIPv4 Shared Poolerで安全に接続した。
- ソース追加: Supabase公式接続・パスワード・CLI資料。詳細な設計根拠は本作業の会話内参照。
- 検証: リモート7テーブル存在、全テーブルRLS有効、ポリシー7件、外部キー9件、ユーザーデータ0件、マイグレーション履歴を確認。`npm run lint`成功、Supabase環境変数を読み込んだ`npm run build`成功、`npm audit --omit=dev`脆弱性0件、`git diff --check`成功。
- 予定コミット: `Initialize Supabase menu planning database`
- コミット: `72c0a6f Initialize Supabase menu planning database`
- Push: 当初GitHub認証待ちで2回タイムアウトしたが、2026-07-13の再試行で後続ログコミットとともに`origin/main`へ成功。

## 2026-07-13 — Supabase Personal Access Token再設定

- 依頼: `sbp_`形式のPersonal Access Tokenを`.env.local`へ保存後、作業を継続する。
- 実施: 秘密値を出力せずトークン形式を検証。Supabase CLIでプロジェクト`bgudwgqbfdztgryjwaxt`を正式にlink。
- 検証: Personal Access Token形式正常、プロジェクトlink成功、ローカルとリモートのマイグレーション`20260713004307`一致。
- 主な変更: `report/work-log.md`。Supabase CLIの一時link情報はGit管理対象外。
- ソース追加: なし。
- 予定コミット: `Record successful Supabase CLI link`
- コミット: `63a5cd9 Record successful Supabase CLI link`
- Push: 保留されていたデータベース初期化コミットを含め、`origin/main`へ成功。

## 2026-07-13 — 条件選択式の弁当メニュー提案画面

- 依頼: `/bento`に和食・洋食・韓国・中華・混合の複数選択、弁当売価、ターゲット性別、販売地域を追加し、条件から4候補を提示、候補名から詳細レシピと材料を表示する。
- 実施: 条件入力UI、適合度スコアリング、常時4候補の生成、候補カード、味・食感・色・構成、1食分材料、調理手順、安全ポイントの詳細表示を実装。10種類の基礎弁当パターンを和・洋・韓・中・混合で作成。スマートフォン・タブレット表示を追加。ローカルブラウザ検証用の許可Originを設定。
- 料理設計: `.agents/skills/culinary-menu-foundation/`の共通原則、弁当実装、和食、中華、韓国、洋食の全参照資料を適用。味・香り・食感・五色・文化的な核・時間経過・食品安全を各案へ反映。
- 主な変更: `app/bento/page.tsx`、`app/globals.css`、`lib/bento-menu-data.ts`、`next.config.ts`、`report/work-log.md`。
- ソース追加: なし。既存の料理基礎調査26ソースを使用。
- ブラウザ検証: 入力項目の表示、複数ジャンル選択、売価入力、性別・地域選択、4候補生成、候補クリック、材料2セクション、レシピ、安全ポイント表示を確認。ブラウザコンソールエラー0件。
- 検証: `npm run lint`成功、`npm run build`成功、`npm audit --omit=dev`脆弱性0件、`git diff --check`成功。
- 予定コミット: `Build condition-based bento menu planner`
- コミット: `1ffdefc Build condition-based bento menu planner`
- Push: `origin/main`へ成功。VercelのGit連携によるデプロイ対象。
