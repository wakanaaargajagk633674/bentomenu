import Link from "next/link";

export default function IzakayaPage() {
  return (
    <main className="workspace izakaya-workspace">
      <Link className="back" href="/">← トップへ戻る</Link>
      <div className="workspace-title">
        <span aria-hidden="true">🏮</span>
        <p>居酒屋メニュー</p>
        <h1>居酒屋メニューを考える</h1>
      </div>
      <p className="coming-soon">メニュー考案機能をここに追加していきます。</p>
    </main>
  );
}

