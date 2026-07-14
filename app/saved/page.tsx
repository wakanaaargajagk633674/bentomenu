"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { listSavedMenus, SavedMenuKind, SavedMenuSummary } from "@/lib/saved-menus";
import { cuisineLabels } from "@/lib/bento-menu-data";
import { dinnerCuisineLabels } from "@/lib/dinner-menu-data";

type Filter = "all" | SavedMenuKind;

const kindLabels: Record<SavedMenuKind, string> = { bento: "販売用弁当", home_bento: "家庭用弁当", izakaya: "居酒屋", dinner: "夜ご飯" };

function priceLabel(kind: SavedMenuKind) {
  return kind === "home_bento" ? "予算上限" : kind === "dinner" ? "食材見積" : "売価";
}

function cuisineLabel(menu: SavedMenuSummary) {
  if (menu.kind === "home_bento") return "家庭向け";
  return cuisineLabels[menu.cuisine as keyof typeof cuisineLabels]
    ?? dinnerCuisineLabels[menu.cuisine as keyof typeof dinnerCuisineLabels]
    ?? menu.cuisine;
}

export default function SavedMenusPage() {
  const [menus, setMenus] = useState<SavedMenuSummary[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    listSavedMenus()
      .then((items) => { if (active) setMenus(items); })
      .catch(() => { if (active) setError("保存したメニューを読み込めませんでした。時間をおいて再度お試しください。"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const visibleMenus = useMemo(() => menus.filter((menu) => {
    const matchesKind = filter === "all" || menu.kind === filter;
    const normalizedQuery = query.trim().toLocaleLowerCase("ja");
    const matchesQuery = !normalizedQuery || `${menu.name} ${menu.tagline ?? ""}`.toLocaleLowerCase("ja").includes(normalizedQuery);
    return matchesKind && matchesQuery;
  }), [menus, filter, query]);

  return <main className="saved-page">
    <header className="planner-header"><Link className="back" href="/">← トップへ戻る</Link><span>名称（仮称）</span></header>
    <section className="saved-hero">
      <p className="eyebrow">YOUR MENU LIBRARY</p>
      <h1>保存したメニュー</h1>
      <p>気になった販売用弁当、家庭用弁当、居酒屋の逸品、夜ご飯を、生成時点のレシピと一緒に振り返れます。</p>
      <p className="guest-note">このブラウザ専用の保存欄です。ブラウザのデータを消すと、保存内容を開けなくなる場合があります。</p>
    </section>
    <section className="saved-content" aria-busy={loading}>
      <div className="library-tools">
        <div className="filter-chips" aria-label="メニュー種別で絞り込む">
          {([{ value: "all", label: "すべて" }, { value: "bento", label: "販売弁当" }, { value: "home_bento", label: "家庭弁当" }, { value: "izakaya", label: "居酒屋" }, { value: "dinner", label: "夜ご飯" }] as const).map((item) => <button key={item.value} type="button" aria-pressed={filter === item.value} onClick={() => setFilter(item.value)}>{item.label}</button>)}
        </div>
        <label className="library-search"><span>料理名から探す</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="例：鮭、唐揚げ" /></label>
      </div>
      {!loading && !error && <p className="library-count" role="status">{visibleMenus.length}件を新しい順に表示</p>}
      {loading && <div className="library-state" role="status"><span className="progress-spinner" aria-hidden="true" /><b>保存したメニューを読み込んでいます</b></div>}
      {error && <div className="library-state error" role="alert"><b>{error}</b><button type="button" onClick={() => window.location.reload()}>再読み込み</button></div>}
      {!loading && !error && visibleMenus.length === 0 && <div className="library-empty">
        <span aria-hidden="true">栞</span><h2>{menus.length ? "条件に合うメニューがありません" : "まだ保存したメニューはありません"}</h2>
        <p>{menus.length ? "検索語または種別を変えてください。" : "生成した候補の「このメニューを保存」から追加できます。"}</p>
        {menus.length ? <button type="button" onClick={() => { setFilter("all"); setQuery(""); }}>絞り込みを解除</button> : <div><Link href="/bento">販売用弁当</Link><Link href="/home-bento">家庭用弁当</Link><Link href="/izakaya">居酒屋の逸品</Link><Link href="/dinner">夜ご飯</Link></div>}
      </div>}
      <div className="saved-grid">{visibleMenus.map((menu) => <article className="saved-card" key={menu.id}>
        <Link href={`/saved/${menu.id}`} aria-label={`${menu.name}の保存レシピ詳細を見る`}>
          <div className="saved-card-image">{menu.imageUrl ? <Image src={menu.imageUrl} alt={menu.image_alt} fill sizes="(max-width:720px) 100vw, (max-width:1000px) 50vw, 33vw" unoptimized /> : <div className={`saved-image-pending ${menu.image_status === "none" ? "no-image" : ""}`}><span aria-hidden="true">{menu.image_status === "none" ? "献立" : "写真"}</span><b>{menu.image_status === "none" ? "レシピ保存済み" : menu.image_status === "failed" ? "画像の保存に失敗" : "画像を保存中"}</b></div>}</div>
          <div className="saved-card-body"><div className="saved-card-meta"><span className={menu.kind}>{kindLabels[menu.kind]}</span><time dateTime={menu.created_at}>{new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium" }).format(new Date(menu.created_at))}</time></div><h2>{menu.name}</h2><p>{menu.tagline}</p><dl><div><dt>料理</dt><dd>{cuisineLabel(menu)}</dd></div><div><dt>{priceLabel(menu.kind)}</dt><dd>¥{menu.price_yen.toLocaleString()}</dd></div></dl><strong>{menu.image_status === "none" ? "レシピを見る" : "写真とレシピを見る"} →</strong></div>
        </Link>
      </article>)}</div>
    </section>
  </main>;
}
