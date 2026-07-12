import Link from "next/link";

export default function BentoPage() {
  return (
    <main className="workspace bento-workspace">
      <Link className="back" href="/">← トップへ戻る</Link>
      <div className="workspace-title">
        <span aria-hidden="true">🍱</span>
        <p>弁当メニュー</p>
        <h1>弁当メニューを考える</h1>
      </div>
      <p className="coming-soon">メニュー考案機能をここに追加していきます。</p>
    </main>
  );
}

