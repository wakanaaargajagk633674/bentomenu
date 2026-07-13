"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { IzakayaSuggestion } from "@/lib/ai/izakaya-schema";

type Cuisine = "japanese" | "western" | "korean" | "chinese" | "mixed";
type Drink = "beer" | "sake" | "shochu" | "wine" | "any";
type Season = "auto" | "spring" | "summer" | "autumn" | "winter";
type Pattern = IzakayaSuggestion & { imageToken: string };
type PhotoState = { status: "queued" | "generating" | "ready" | "failed"; url?: string; error?: string };

const cuisineLabels: Record<Cuisine, string> = { japanese: "和食", western: "洋食", korean: "韓国", chinese: "中華", mixed: "混合" };
const drinkOptions: Array<{ value: Drink; label: string }> = [{ value: "beer", label: "ビール" }, { value: "sake", label: "日本酒" }, { value: "shochu", label: "焼酎" }, { value: "wine", label: "ワイン" }, { value: "any", label: "指定なし" }];
const seasonOptions: Array<{ value: Season; label: string }> = [{ value: "auto", label: "おまかせ" }, { value: "spring", label: "春" }, { value: "summer", label: "夏" }, { value: "autumn", label: "秋" }, { value: "winter", label: "冬" }];

export default function IzakayaPage() {
  const [cuisines, setCuisines] = useState<Cuisine[]>(["japanese"]);
  const [price, setPrice] = useState(680);
  const [drink, setDrink] = useState<Drink>("any");
  const [season, setSeason] = useState<Season>("auto");
  const [results, setResults] = useState<Pattern[]>([]);
  const [active, setActive] = useState<Pattern | null>(null);
  const [photos, setPhotos] = useState<Record<string, PhotoState>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const photoAbortRef = useRef<AbortController | null>(null);
  const urlsRef = useRef(new Set<string>());
  const resultsRef = useRef<HTMLElement>(null);
  const detailRef = useRef<HTMLElement>(null);

  useEffect(() => { if (results.length) resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [results]);
  useEffect(() => { if (active) detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [active]);
  useEffect(() => {
    if (!isGenerating) return;
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [isGenerating]);
  useEffect(() => () => {
    abortRef.current?.abort();
    photoAbortRef.current?.abort();
    urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const summary = useMemo(() => `${cuisines.map((item) => cuisineLabels[item]).join("・")}・${price.toLocaleString()}円・${drinkOptions.find((item) => item.value === drink)?.label}`, [cuisines, price, drink]);
  const toggleCuisine = (value: Cuisine) => setCuisines((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);

  const loadPhoto = async (pattern: Pattern, signal?: AbortSignal) => {
    setPhotos((current) => ({ ...current, [pattern.id]: { status: "generating" } }));
    try {
      const response = await fetch("/api/izakaya/image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ suggestion: pattern, imageToken: pattern.imageToken }), signal });
      if (!response.ok) {
        const data = (response.headers.get("content-type") || "").includes("application/json") ? await response.json() : null;
        throw new Error(typeof data?.error === "string" ? data.error : "完成写真を生成できませんでした。");
      }
      const url = URL.createObjectURL(await response.blob());
      urlsRef.current.add(url);
      setPhotos((current) => {
        const old = current[pattern.id]?.url;
        if (old) { URL.revokeObjectURL(old); urlsRef.current.delete(old); }
        return { ...current, [pattern.id]: { status: "ready", url } };
      });
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setPhotos((current) => ({ ...current, [pattern.id]: { status: "failed", error: caught instanceof Error ? caught.message : "完成写真を生成できませんでした。" } }));
    }
  };

  const startPhotoQueue = (patterns: Pattern[]) => {
    photoAbortRef.current?.abort();
    const controller = new AbortController();
    photoAbortRef.current = controller;
    setPhotos(Object.fromEntries(patterns.map((pattern) => [pattern.id, { status: "queued" as const }])));
    let next = 0;
    const worker = async () => { while (next < patterns.length && !controller.signal.aborted) await loadPhoto(patterns[next++], controller.signal); };
    void Promise.all([worker(), worker()]).finally(() => { if (photoAbortRef.current === controller) photoAbortRef.current = null; });
  };

  const resetPhotos = () => {
    photoAbortRef.current?.abort();
    urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    urlsRef.current.clear();
    setPhotos({});
  };

  const generate = async () => {
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    resetPhotos();
    setIsGenerating(true); setElapsed(0); setError(""); setActive(null);
    try {
      const response = await fetch("/api/izakaya/suggest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ menuType: "daily-special", cuisines, price, drink, season }), signal: controller.signal });
      const data = (response.headers.get("content-type") || "").includes("application/json") ? await response.json() : { error: await response.text() };
      if (!response.ok) throw new Error(typeof data.error === "string" && !data.error.startsWith("An error occurred") ? data.error : "日替わりの逸品を生成できませんでした。");
      if (!Array.isArray(data.suggestions)) throw new Error("AIから正しい形式の候補が返りませんでした。");
      const suggestions = data.suggestions as Pattern[];
      setResults(suggestions);
      startPhotoQueue(suggestions);
    } catch (caught) {
      setResults([]);
      setError(caught instanceof DOMException && caught.name === "AbortError" ? "生成を中止しました。" : caught instanceof Error ? caught.message : "生成できませんでした。");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setIsGenerating(false);
    }
  };

  const stage = elapsed < 25 ? "旬と酒の相性から主役を選んでいます" : elapsed < 70 ? "味・香り・食感と現場オペレーションを設計しています" : "原価とレシピを確認し、4つの逸品に仕上げています";

  return <main className="planner-page izakaya-planner">
    <header className="planner-header"><Link className="back" href="/">← トップへ戻る</Link><span>名称（仮称）</span></header>
    <section className="planner-hero"><p className="eyebrow">DAILY IZAKAYA SPECIAL</p><h1>今日だけの逸品を、<br />店の武器に。</h1><p>弁当や定食ではなく、単独で注文できる日替わりの一皿を4案提案。レシピ、仕込み、提供時間、採算、完成写真まで作ります。</p><div className="hero-guide"><span>1</span> 条件を選ぶ <i>→</i><span>2</span> 逸品案を確認 <i>→</i><span>3</span> 完成写真で比較</div></section>

    <section className="planner-form" aria-label="日替わり逸品の条件">
      <div className="form-heading"><div><p className="eyebrow">TODAY&apos;S CONDITIONS</p><h2>日替わりの逸品を指定</h2></div><p>一皿・1〜2人前の店内提供用です</p></div>
      <div className="menu-type-lock"><span>メニュー種別</span><strong>日替わりの逸品</strong><small>弁当・定食・コースは生成しません</small></div>
      <div className="planner-fields">
        <fieldset className="genre-field"><legend><b>01</b><span>料理のジャンル</span><small>複数選択できます</small></legend><div className="check-grid">{(Object.keys(cuisineLabels) as Cuisine[]).map((item) => <label className={cuisines.includes(item) ? "selected" : ""} key={item}><input type="checkbox" checked={cuisines.includes(item)} onChange={() => toggleCuisine(item)} /><span>{cuisineLabels[item]}</span><i>✓</i></label>)}</div></fieldset>
        <fieldset><legend><b>02</b><span>一皿の売価</span><small>税込価格</small></legend><div className="price-input"><span>¥</span><input aria-label="逸品の売価" type="number" inputMode="numeric" min="300" max="3000" step="10" value={price} onChange={(event) => setPrice(Number(event.target.value))} /><em>円</em></div><div className="price-presets">{[580, 680, 880].map((amount) => <button type="button" className={price === amount ? "selected" : ""} onClick={() => setPrice(amount)} key={amount}>{amount}円</button>)}</div></fieldset>
        <fieldset><legend><b>03</b><span>合わせたいお酒</span></legend><div className="radio-grid izakaya-options">{drinkOptions.map((item) => <label className={drink === item.value ? "selected" : ""} key={item.value}><input type="radio" name="drink" checked={drink === item.value} onChange={() => setDrink(item.value)} /><span>{item.label}</span></label>)}</div></fieldset>
        <fieldset><legend><b>04</b><span>季節</span></legend><div className="radio-grid izakaya-options">{seasonOptions.map((item) => <label className={season === item.value ? "selected" : ""} key={item.value}><input type="radio" name="season" checked={season === item.value} onChange={() => setSeason(item.value)} /><span>{item.label}</span></label>)}</div></fieldset>
      </div>
      <div className="condition-bar"><div><small>選択中</small><strong>{summary}</strong></div><button className="generate-button" type="button" disabled={!cuisines.length || price < 300 || isGenerating} onClick={generate}><span>{isGenerating ? "考案しています" : results.length ? "この条件で再生成" : "日替わり逸品を4案つくる"}</span><b>{isGenerating ? "…" : "→"}</b></button></div>
      {isGenerating && <div className="generation-progress" role="status"><div className="progress-top"><span className="progress-spinner" /><div><b>料理人チームが考えています</b><p>{stage}</p></div><time>{elapsed}秒</time></div><div className="progress-track"><i /></div><div className="progress-foot"><span>通常1〜2分ほどかかります。逸品案を先に表示し、写真はその後に生成します。</span><button type="button" onClick={() => abortRef.current?.abort()}>中止する</button></div></div>}
      {error && <div className="generation-error" role="alert"><b>日替わりの逸品を生成できませんでした</b><p>{error}</p></div>}
    </section>

    {results.length > 0 && <section className="suggestions" ref={resultsRef} aria-live="polite"><div className="suggestion-heading"><div><p className="eyebrow">4 DAILY SPECIALS</p><h2>本日の日替わり逸品候補</h2></div><p>{summary}</p></div><p className="photo-progress">逸品案を先に表示しています。完成写真は2枚ずつ生成し、できた順に表示します。</p><div className="suggestion-grid">{results.map((pattern, index) => {
      const photo = photos[pattern.id];
      return <article className={`suggestion-card ${active?.id === pattern.id ? "selected" : ""}`} key={pattern.id}><div className={`suggestion-photo ${photo?.status === "ready" ? "ready" : ""}`}>{photo?.status === "ready" && photo.url ? <Image src={photo.url} alt={pattern.photoSpec.altText} fill sizes="(max-width:720px) 100vw, (max-width:900px) 50vw, 25vw" unoptimized /> : <div className="photo-placeholder"><span />{photo?.status === "failed" ? <><b>写真のみ生成できませんでした</b><small>{photo.error}</small><button type="button" onClick={() => loadPhoto(pattern)}>写真だけ再試行</button></> : <><b>{photo?.status === "queued" ? "生成待ち" : "完成写真を生成中"}</b><small>一皿のレシピと盛り付けを反映します</small></>}</div>}</div><button type="button" className="suggestion-card-body" onClick={() => setActive(pattern)}><span className="candidate-number">0{index + 1}</span><small>{cuisineLabels[pattern.cuisine]}</small><h3>{pattern.name}</h3><p>{pattern.tagline}</p><dl className="card-metrics"><div><dt>提供時間</dt><dd>約{pattern.operations.orderToServeMinutes}分</dd></div><div><dt>変動費率</dt><dd>{pattern.profitPlan.variableCostRatePercent.toFixed(1)}%</dd></div></dl><strong>レシピと採算を見る <span>→</span></strong></button></article>;
    })}</div><p className="image-disclaimer">AIによる盛り付け完成イメージです。実際の仕上がりや食品安全は、レシピの加熱・保存・提供手順で確認してください。</p></section>}

    {active && <section className="recipe-detail" ref={detailRef} aria-live="polite"><button className="detail-close" type="button" aria-label="詳細を閉じる" onClick={() => setActive(null)}>×</button><button className="back-to-results" type="button" onClick={() => resultsRef.current?.scrollIntoView({ behavior: "smooth" })}>← 4つの候補へ戻る</button><div className="detail-title"><p className="eyebrow">DAILY SPECIAL / {cuisineLabels[active.cuisine]}</p><h2>{active.name}</h2><p>{active.tagline}</p></div>
      <div className="detail-photo">{photos[active.id]?.status === "ready" && photos[active.id].url ? <div className="detail-photo-frame"><Image src={photos[active.id].url!} alt={active.photoSpec.altText} fill sizes="(max-width:900px) 100vw, 860px" unoptimized /></div> : <div className="photo-placeholder"><b>{photos[active.id]?.status === "failed" ? "完成写真を生成できませんでした" : "完成写真を生成中"}</b>{photos[active.id]?.status === "failed" && <button type="button" onClick={() => loadPhoto(active)}>写真だけ再試行</button>}</div>}<p>AIによる完成イメージです。実際の提供では下記の仕込み・加熱・保持条件を優先してください。</p></div>
      <div className="design-grid"><article><b>コンセプト</b><p>{active.concept}</p></article><article><b>味・香り・食感</b><p>{active.flavor} ／ {active.aroma} ／ {active.texture}</p></article><article><b>酒との相性</b><p>{active.drinkPairing}</p></article></div>
      <div className="profit-panel"><div className="profit-heading"><div><p className="eyebrow">OPERATION & PROFIT</p><h3>提供設計と採算</h3></div><strong>想定粗利益 ¥{active.profitPlan.estimatedGrossProfitYen.toLocaleString()}</strong></div><div className="profit-numbers"><dl><dt>食材原価</dt><dd>¥{active.profitPlan.estimatedFoodCostYen}</dd></dl><dl><dt>その他変動費</dt><dd>¥{active.profitPlan.otherVariableCostYen}</dd></dl><dl><dt>注文後の提供</dt><dd>{active.operations.orderToServeMinutes}分</dd></dl><dl><dt>変動費率</dt><dd>{active.profitPlan.variableCostRatePercent.toFixed(1)}%</dd></dl></div><p className="management-verdict">{active.profitPlan.managementVerdict}</p><details><summary>仕込み・保持・見積もり前提</summary><p>{active.operations.prepAhead}</p><p>保持限界: {active.operations.holdingLimit} ／ 設備: {active.operations.specialEquipment}</p><ul>{active.profitPlan.assumptions.map((item) => <li key={item}>{item}</li>)}</ul></details></div>
      <p className="recipe-unit">材料は <b>{active.recipe.servingYield}</b> です</p><div className="recipe-parts"><article><header><span>01</span><h3>材料と仕込み</h3></header><div><section><h4>材料</h4><ul>{active.recipe.ingredients.map((item) => <li key={item}>{item}</li>)}</ul></section><section><h4>仕込み</h4><ol>{active.recipe.prepSteps.map((step) => <li key={step}>{step}</li>)}</ol></section></div></article><article><header><span>02</span><h3>注文後の仕上げ</h3></header><div><section><h4>提供温度・文化の核</h4><p>{active.temperature}</p><p>{active.culturalAnchor}</p></section><section><h4>仕上げと盛り付け</h4><ol>{active.recipe.serviceSteps.map((step) => <li key={step}>{step}</li>)}</ol></section></div></article></div>
      <div className="safety-note"><b>食品安全・アレルゲン</b><p>{active.safety}</p><p>アレルゲン: {active.allergens.length ? active.allergens.join("、") : "特記事項なし"}</p></div><button className="detail-return-button" type="button" onClick={() => resultsRef.current?.scrollIntoView({ behavior: "smooth" })}>他の逸品と比較する ↑</button>
    </section>}
  </main>;
}
