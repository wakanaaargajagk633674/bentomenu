const bentos = [
  { name: "日替わり弁当", price: "750円", tag: "人気", description: "主菜と季節の副菜を詰めた、毎日楽しめるお弁当。", icon: "🍱" },
  { name: "鶏の香味唐揚げ弁当", price: "850円", tag: "おすすめ", description: "生姜と醤油にじっくり漬け込んだ、香ばしい唐揚げ。", icon: "🍗" },
  { name: "さば塩焼き弁当", price: "880円", tag: "定番", description: "ふっくら焼いたさばと、やさしい味わいの煮物。", icon: "🐟" },
];

const izakaya = [
  { name: "だし巻き玉子", price: "580円", description: "注文ごとに焼き上げる、だし香るふわふわ玉子。" },
  { name: "炙りしめさば", price: "780円", description: "目の前で香ばしく炙る、酒がすすむひと皿。" },
  { name: "季節野菜の天ぷら", price: "680円", description: "旬の野菜を軽やかな衣でさっくりと。" },
  { name: "自家製つくね", price: "620円", description: "軟骨入りの食感と、甘辛いたれが自慢。" },
];

export default function Home() {
  return (
    <main>
      <header className="header">
        <a className="logo" href="#top" aria-label="喜功房 ホーム">
          <span className="logo-mark">喜</span>
          <span>喜功房<small>きこうぼう</small></span>
        </a>
        <nav aria-label="メインナビゲーション">
          <a href="#bento">お弁当</a><a href="#izakaya">居酒屋</a><a href="#shop">店舗案内</a>
        </nav>
        <a className="header-cta" href="tel:0000000000">ご予約・ご注文</a>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">まいにち、丁寧に、手づくり。</p>
          <h1>お昼も、夜も。<br /><em>ほっとする味</em>を。</h1>
          <p className="lead">旬の食材とひと手間を大切に。お昼は彩り豊かなお弁当、夜はお酒と楽しむ出来たて料理をどうぞ。</p>
          <div className="hero-actions">
            <a className="button primary" href="#bento">今日のお弁当を見る</a>
            <a className="button secondary" href="#izakaya">夜のメニューを見る</a>
          </div>
        </div>
        <div className="hero-visual" aria-label="和食のお弁当のイメージ">
          <div className="sun" /><div className="dish">🍱</div>
          <span className="stamp">店内<br />仕込み</span>
        </div>
      </section>

      <section className="section" id="bento">
        <div className="section-heading">
          <div><p className="eyebrow">LUNCH / TAKE OUT</p><h2>手づくり弁当</h2></div>
          <p>ひとつひとつ、店内で丁寧に。<br />ご予約・まとまったご注文も承ります。</p>
        </div>
        <div className="card-grid">
          {bentos.map((item) => (
            <article className="menu-card" key={item.name}>
              <div className="food-image"><span>{item.icon}</span><b>{item.tag}</b></div>
              <div className="card-body"><div className="name-price"><h3>{item.name}</h3><strong>{item.price}</strong></div><p>{item.description}</p></div>
            </article>
          ))}
        </div>
        <p className="note">※ 表示価格は税込です。内容は仕入れ状況により変更になる場合があります。</p>
      </section>

      <section className="izakaya" id="izakaya">
        <div className="izakaya-intro"><p className="eyebrow">DINNER / IZAKAYA</p><h2>今夜の<br />おすすめ</h2><p>仕事帰りの一杯に、家族との夕食に。出来たての料理と季節のお酒をご用意してお待ちしています。</p><span className="brush">肴</span></div>
        <div className="dish-list">
          {izakaya.map((item, index) => (
            <article key={item.name}><span className="number">0{index + 1}</span><div><h3>{item.name}</h3><p>{item.description}</p></div><strong>{item.price}</strong></article>
          ))}
        </div>
      </section>

      <section className="shop" id="shop">
        <div><p className="eyebrow">SHOP INFORMATION</p><h2>お店のご案内</h2><p className="shop-message">今日も、あたたかいごはんを<br />ご用意してお待ちしています。</p></div>
        <dl><div><dt>営業時間</dt><dd>昼 11:00–14:00<br />夜 17:00–22:00</dd></div><div><dt>定休日</dt><dd>日曜日・祝日</dd></div><div><dt>所在地</dt><dd>店舗住所をここに入力してください</dd></div><div><dt>電話番号</dt><dd><a href="tel:0000000000">000-0000-0000</a></dd></div></dl>
      </section>

      <footer><div className="logo"><span className="logo-mark">喜</span><span>喜功房<small>きこうぼう</small></span></div><p>© {new Date().getFullYear()} KIKOBOU. All rights reserved.</p></footer>
    </main>
  );
}

