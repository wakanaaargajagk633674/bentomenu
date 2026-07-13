import Link from "next/link";

export default function Home() {
  return (
    <main className="home">
      <div className="home-inner">
        <p className="eyebrow">MENU PLANNING APP</p>
        <h1>名称<span>（仮称）</span></h1>
        <div className="menu-choices" aria-label="考えるメニューを選択">
          <Link className="choice bento-choice" href="/bento">
            <span className="choice-icon" aria-hidden="true">🍱</span>
            <span className="choice-label">弁当メニューを考える</span>
            <span className="arrow" aria-hidden="true">→</span>
          </Link>
          <Link className="choice izakaya-choice" href="/izakaya">
            <span className="choice-icon" aria-hidden="true">🏮</span>
            <span className="choice-label">居酒屋メニューを考える</span>
            <span className="arrow" aria-hidden="true">→</span>
          </Link>
        </div>
        <Link className="saved-home-link" href="/saved">保存したメニューを確認する →</Link>
      </div>
    </main>
  );
}
