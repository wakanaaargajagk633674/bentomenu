"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { IzakayaCandidate, IzakayaRequest, IzakayaSuggestion } from "@/lib/ai/izakaya-schema";
import { attachSavedMenuImage, createSavedMenu, markSavedMenuImageFailed } from "@/lib/saved-menus";
import { ChefQualityPanel } from "@/app/components/chef-quality-panel";
import { readImageCostHeaders, recordApiUsage } from "@/lib/api-usage";
import type { ApiCostRecord } from "@/lib/ai/api-cost";

type Cuisine = "japanese" | "western" | "korean" | "chinese" | "mixed";
type Drink = "beer" | "sake" | "shochu" | "wine" | "any";
type Season = "auto" | "spring" | "summer" | "autumn" | "winter";
type Pattern = IzakayaSuggestion & { imageToken: string };
type PhotoState = { status: "generating" | "ready" | "failed"; url?: string; error?: string };
type SaveState = { status: "saving" | "image" | "saved" | "failed"; error?: string };

const cuisineLabels: Record<Cuisine, string> = { japanese: "和食", western: "洋食", korean: "韓国", chinese: "中華", mixed: "混合" };
const drinkOptions: Array<{ value: Drink; label: string }> = [{ value: "beer", label: "ビール" }, { value: "sake", label: "日本酒" }, { value: "shochu", label: "焼酎" }, { value: "wine", label: "ワイン" }, { value: "any", label: "指定なし" }];
const seasonOptions: Array<{ value: Season; label: string }> = [{ value: "auto", label: "おまかせ" }, { value: "spring", label: "春" }, { value: "summer", label: "夏" }, { value: "autumn", label: "秋" }, { value: "winter", label: "冬" }];

export default function IzakayaPage() {
  const [cuisines, setCuisines] = useState<Cuisine[]>(["japanese"]);
  const [price, setPrice] = useState(680);
  const [drink, setDrink] = useState<Drink>("any");
  const [season, setSeason] = useState<Season>("auto");
  const [results, setResults] = useState<IzakayaCandidate[]>([]);
  const [active, setActive] = useState<Pattern | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<IzakayaCandidate | null>(null);
  const [generatedConditions, setGeneratedConditions] = useState<IzakayaRequest | null>(null);
  const [photos, setPhotos] = useState<Record<string, PhotoState>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDetailGenerating, setIsDetailGenerating] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const [sessionCostJpy, setSessionCostJpy] = useState(0);
  const [costLogWarning, setCostLogWarning] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const detailAbortRef = useRef<AbortController | null>(null);
  const photoAbortRef = useRef<AbortController | null>(null);
  const urlsRef = useRef(new Set<string>());
  const resultsRef = useRef<HTMLElement>(null);
  const detailRef = useRef<HTMLElement>(null);
  const savedIdsRef = useRef<Record<string, string>>({});

  useEffect(() => { if (results.length) resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [results]);
  useEffect(() => { if (active) detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [active]);
  useEffect(() => {
    if (!isGenerating) return;
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [isGenerating]);
  useEffect(() => () => {
    abortRef.current?.abort();
    detailAbortRef.current?.abort();
    photoAbortRef.current?.abort();
    urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const summary = useMemo(() => `${cuisines.map((item) => cuisineLabels[item]).join("・")}・${price.toLocaleString()}円・${drinkOptions.find((item) => item.value === drink)?.label}`, [cuisines, price, drink]);
  const toggleCuisine = (value: Cuisine) => setCuisines((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);

  const saveUsageCost = async (cost?: ApiCostRecord | null) => {
    if (!cost) return;
    setSessionCostJpy((current) => current + cost.estimatedCostJpy);
    try {
      await recordApiUsage(cost);
    } catch {
      setCostLogWarning("費用は画面上で計算しましたが、履歴への保存に失敗しました。費用記録画面を確認してください。");
    }
  };

  const loadPhoto = async (pattern: Pattern, signal?: AbortSignal) => {
    setPhotos((current) => ({ ...current, [pattern.id]: { status: "generating" } }));
    try {
      const response = await fetch("/api/izakaya/image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ suggestion: pattern, imageToken: pattern.imageToken }), signal });
      if (!response.ok) {
        const data = (response.headers.get("content-type") || "").includes("application/json") ? await response.json() : null;
        throw new Error(typeof data?.error === "string" ? data.error : "完成写真を生成できませんでした。");
      }
      await saveUsageCost(readImageCostHeaders(response.headers, "izakaya"));
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      urlsRef.current.add(url);
      setPhotos((current) => {
        const old = current[pattern.id]?.url;
        if (old) { URL.revokeObjectURL(old); urlsRef.current.delete(old); }
        return { ...current, [pattern.id]: { status: "ready", url } };
      });
      const savedId = savedIdsRef.current[pattern.id];
      if (savedId) {
        try {
          await attachSavedMenuImage(savedId, blob);
          setSaveStates((current) => ({ ...current, [pattern.id]: { status: "saved" } }));
        } catch {
          await markSavedMenuImageFailed(savedId);
          setSaveStates((current) => ({ ...current, [pattern.id]: { status: "failed", error: "メニューは保存済みですが、画像の保存に失敗しました。再試行してください。" } }));
        }
      }
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setPhotos((current) => ({ ...current, [pattern.id]: { status: "failed", error: caught instanceof Error ? caught.message : "完成写真を生成できませんでした。" } }));
      const savedId = savedIdsRef.current[pattern.id];
      if (savedId) {
        await markSavedMenuImageFailed(savedId);
        setSaveStates((current) => ({ ...current, [pattern.id]: { status: "failed", error: "メニューは保存済みです。写真を再試行すると保存も再開します。" } }));
      }
    }
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
    setIsGenerating(true); setElapsed(0); setError(""); setActive(null); setSelectedCandidate(null); setGeneratedConditions(null); setDetailError(""); setSaveStates({}); savedIdsRef.current = {};
    detailAbortRef.current?.abort();
    try {
      const conditions: IzakayaRequest = { menuType: "daily-special", cuisines, price, drink, season };
      const response = await fetch("/api/izakaya/suggest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(conditions), signal: controller.signal });
      const data = (response.headers.get("content-type") || "").includes("application/json") ? await response.json() : { error: await response.text() };
      if (!response.ok) throw new Error(typeof data.error === "string" && !data.error.startsWith("An error occurred") ? data.error : "日替わりの逸品を生成できませんでした。");
      if (!Array.isArray(data.suggestions)) throw new Error("AIから正しい形式の候補が返りませんでした。");
      await saveUsageCost(data.usageCost as ApiCostRecord | undefined);
      const suggestions = data.suggestions as IzakayaCandidate[];
      setResults(suggestions);
      setGeneratedConditions(conditions);
    } catch (caught) {
      setResults([]);
      setError(caught instanceof DOMException && caught.name === "AbortError" ? "生成を中止しました。" : caught instanceof Error ? caught.message : "生成できませんでした。");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setIsGenerating(false);
    }
  };

  const selectCandidate = async (candidate: IzakayaCandidate) => {
    if (!generatedConditions || isDetailGenerating) return;
    const controller = new AbortController();
    detailAbortRef.current?.abort();
    detailAbortRef.current = controller;
    resetPhotos();
    setSelectedCandidate(candidate);
    setActive(null);
    setDetailError("");
    setIsDetailGenerating(true);
    try {
      const response = await fetch("/api/izakaya/detail", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conditions: generatedConditions, candidate }), signal: controller.signal });
      const data = (response.headers.get("content-type") || "").includes("application/json") ? await response.json() : { error: await response.text() };
      if (!response.ok || !data.suggestion) throw new Error(typeof data.error === "string" ? data.error : "詳細レシピを生成できませんでした。");
      await saveUsageCost(data.usageCost as ApiCostRecord | undefined);
      const detail = data.suggestion as Pattern;
      setActive(detail);
      const photoController = new AbortController();
      photoAbortRef.current = photoController;
      void loadPhoto(detail, photoController.signal).finally(() => { if (photoAbortRef.current === photoController) photoAbortRef.current = null; });
    } catch (caught) {
      if (!(caught instanceof DOMException && caught.name === "AbortError")) setDetailError(caught instanceof Error ? caught.message : "詳細レシピを生成できませんでした。");
    } finally {
      if (detailAbortRef.current === controller) detailAbortRef.current = null;
      setIsDetailGenerating(false);
    }
  };

  const savePattern = async (pattern: Pattern) => {
    const current = saveStates[pattern.id];
    if (current?.status === "saving" || current?.status === "image" || current?.status === "saved") return;
    setSaveStates((states) => ({ ...states, [pattern.id]: { status: "saving" } }));
    try {
      const saved = await createSavedMenu("izakaya", pattern as unknown as Record<string, unknown>);
      savedIdsRef.current[pattern.id] = saved.id;
      if (saved.image_status === "ready") {
        setSaveStates((states) => ({ ...states, [pattern.id]: { status: "saved" } }));
        return;
      }
      setSaveStates((states) => ({ ...states, [pattern.id]: { status: "image" } }));
      const photo = photos[pattern.id];
      if (photo?.status === "ready" && photo.url) {
        await attachSavedMenuImage(saved.id, await (await fetch(photo.url)).blob());
        setSaveStates((states) => ({ ...states, [pattern.id]: { status: "saved" } }));
      } else if (photo?.status === "failed") {
        void loadPhoto(pattern);
      }
    } catch {
      setSaveStates((states) => ({ ...states, [pattern.id]: { status: "failed", error: "保存できませんでした。通信状態を確認して再試行してください。" } }));
    }
  };

  const stage = elapsed < 25 ? "旬と酒の相性から主役を選んでいます" : elapsed < 70 ? "味・構成・特徴を比較できる形に整えています" : "原価を確認し、4つの候補に仕上げています";

  return <main className="planner-page izakaya-planner">
    <header className="planner-header"><Link className="back" href="/">← トップへ戻る</Link><div><Link className="library-link" href="/usage">API費用</Link> <Link className="library-link" href="/saved">保存したメニューを確認</Link></div></header>
    <section className="planner-hero"><p className="eyebrow">DAILY IZAKAYA SPECIAL</p><h1>今日だけの逸品を、<br />店の武器に。</h1><p>まず料理名・構成・味・原価・特徴の4案を比較。選んだ一皿だけ、レシピ、仕込み、採算、完成写真まで作ります。</p><div className="hero-guide"><span>1</span> 4候補を比較 <i>→</i><span>2</span> 1件を選ぶ <i>→</i><span>3</span> 詳細と写真を生成</div></section>

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
      {isGenerating && <div className="generation-progress" role="status"><div className="progress-top"><span className="progress-spinner" /><div><b>料理人チームが考えています</b><p>{stage}</p></div><time>{elapsed}秒</time></div><div className="progress-track"><i /></div><div className="progress-foot"><span>Flex Processingで比較用の4候補を生成しています。混雑時は時間がかかる場合があります。</span><button type="button" onClick={() => abortRef.current?.abort()}>中止する</button></div></div>}
      {error && <div className="generation-error" role="alert"><b>日替わりの逸品を生成できませんでした</b><p>{error}</p></div>}
      {sessionCostJpy > 0 && <p className="request-applied-note"><b>この画面でのAPI費用</b><span>約{sessionCostJpy.toFixed(2)}円　<Link href="/usage">履歴と累計を見る</Link></span></p>}
      {costLogWarning && <p className="field-error" role="alert">{costLogWarning}</p>}
    </section>

    {results.length > 0 && <section className="suggestions" ref={resultsRef} aria-live="polite"><div className="suggestion-heading"><div><p className="eyebrow">4 DAILY SPECIALS</p><h2>本日の日替わり逸品候補</h2></div><p>{summary}</p></div><p className="photo-progress">まず料理名・構成・味・原価・特徴だけを比較できます。選んだ1件だけ、詳細レシピと完成写真を生成します。</p><div className="suggestion-grid">{results.map((pattern, index) => {
      return <article className={`suggestion-card ${selectedCandidate?.id === pattern.id ? "selected" : ""}`} key={pattern.id}><div className="suggestion-photo"><div className="photo-placeholder"><span aria-hidden="true" /><b>候補比較</b><small>写真は選択後、この1件だけ生成します</small></div></div><button type="button" disabled={isDetailGenerating} className="suggestion-card-body" onClick={() => void selectCandidate(pattern)} aria-expanded={active?.id === pattern.id}><span className="candidate-number">0{index + 1}</span><small>{cuisineLabels[pattern.cuisine]}</small><h3>{pattern.name}</h3><p>{pattern.tagline}</p><p>{pattern.distinctiveFeature}</p><dl className="card-metrics"><div><dt>構成</dt><dd>{pattern.composition}</dd></div><div><dt>食材原価</dt><dd>約¥{pattern.profitPlan.estimatedFoodCostYen.toLocaleString()}</dd></div><div><dt>提供時間</dt><dd>約{pattern.orderToServeMinutes}分</dd></div><div><dt>変動費率</dt><dd>{pattern.profitPlan.variableCostRatePercent.toFixed(1)}%</dd></div></dl><strong>{isDetailGenerating && selectedCandidate?.id === pattern.id ? "詳細を生成しています…" : "この案を選んで詳細・写真を生成"} <span>→</span></strong></button></article>;
    })}</div><p className="image-disclaimer">候補選定では画像料金は発生しません。選択後に完成写真を1枚生成します。</p></section>}

    {isDetailGenerating && selectedCandidate && <section className="recipe-detail" aria-live="polite"><div className="generation-progress" role="status"><div className="progress-top"><span className="progress-spinner" /><div><b>{selectedCandidate.name}を詳細化しています</b><p>レシピ、仕込み、盛り付け、品質審査、写真仕様をこの1件だけ作成しています。</p></div></div><div className="progress-track"><i /></div><div className="progress-foot"><span>Flex Processingのため、混雑時は応答が遅くなる場合があります。</span><button type="button" onClick={() => detailAbortRef.current?.abort()}>中止する</button></div></div></section>}
    {detailError && <div className="generation-error" role="alert"><b>選択した候補を詳細化できませんでした</b><p>{detailError}</p>{selectedCandidate && <button type="button" onClick={() => void selectCandidate(selectedCandidate)}>もう一度試す</button>}</div>}

    {active && <section className="recipe-detail" ref={detailRef} aria-live="polite"><button className="detail-close" type="button" aria-label="詳細を閉じる" onClick={() => setActive(null)}>×</button><button className="back-to-results" type="button" onClick={() => resultsRef.current?.scrollIntoView({ behavior: "smooth" })}>← 4つの候補へ戻る</button><div className="detail-title"><p className="eyebrow">DAILY SPECIAL / {cuisineLabels[active.cuisine]}</p><h2>{active.name}</h2><p>{active.tagline}</p></div><button type="button" className={`save-menu-button detail-save ${saveStates[active.id]?.status === "saved" ? "saved" : saveStates[active.id]?.status === "failed" ? "failed" : ""}`} disabled={Boolean(saveStates[active.id] && ["saving", "image", "saved"].includes(saveStates[active.id].status))} onClick={() => savePattern(active)}>{saveStates[active.id]?.status === "saving" ? "メニューを保存中…" : saveStates[active.id]?.status === "image" ? "メニュー保存済み・画像を保存中…" : saveStates[active.id]?.status === "saved" ? "保存しました ✓" : saveStates[active.id]?.status === "failed" ? "保存を再試行" : "このメニューを保存"}</button>{saveStates[active.id]?.error && <p className="save-status" role="alert">{saveStates[active.id].error}</p>}
      <div className="detail-photo">{photos[active.id]?.status === "ready" && photos[active.id].url ? <div className="detail-photo-frame"><Image src={photos[active.id].url!} alt={active.photoSpec.altText} fill sizes="(max-width:900px) 100vw, 860px" unoptimized /></div> : <div className="photo-placeholder"><b>{photos[active.id]?.status === "failed" ? "完成写真を生成できませんでした" : "完成写真を生成中"}</b>{photos[active.id]?.status === "failed" && <button type="button" onClick={() => loadPhoto(active)}>写真だけ再試行</button>}</div>}<p>AIによる完成イメージです。実際の提供では下記の仕込み・加熱・保持条件を優先してください。</p></div>
      <div className="design-grid"><article><b>コンセプト</b><p>{active.concept}</p></article><article><b>味・香り・食感</b><p>{active.flavor} ／ {active.aroma} ／ {active.texture}</p></article><article><b>酒との相性</b><p>{active.drinkPairing}</p></article></div>
      <ChefQualityPanel review={active.qualityReview} />
      <div className="profit-panel"><div className="profit-heading"><div><p className="eyebrow">OPERATION & PROFIT</p><h3>提供設計と採算</h3></div><strong>想定粗利益 ¥{active.profitPlan.estimatedGrossProfitYen.toLocaleString()}</strong></div><div className="profit-numbers"><dl><dt>食材原価</dt><dd>¥{active.profitPlan.estimatedFoodCostYen}</dd></dl><dl><dt>その他変動費</dt><dd>¥{active.profitPlan.otherVariableCostYen}</dd></dl><dl><dt>注文後の提供</dt><dd>{active.operations.orderToServeMinutes}分</dd></dl><dl><dt>変動費率</dt><dd>{active.profitPlan.variableCostRatePercent.toFixed(1)}%</dd></dl></div><p className="management-verdict">{active.profitPlan.managementVerdict}</p><details><summary>仕込み・保持・見積もり前提</summary><p>{active.operations.prepAhead}</p><p>保持限界: {active.operations.holdingLimit} ／ 設備: {active.operations.specialEquipment}</p><ul>{active.profitPlan.assumptions.map((item) => <li key={item}>{item}</li>)}</ul></details></div>
      <p className="recipe-unit">材料は <b>{active.recipe.servingYield}</b> です</p><div className="recipe-parts"><article><header><span>01</span><h3>材料と仕込み</h3></header><div><section><h4>材料</h4><ul>{active.recipe.ingredients.map((item) => <li key={item}>{item}</li>)}</ul></section><section><h4>仕込み</h4><ol>{active.recipe.prepSteps.map((step) => <li key={step}>{step}</li>)}</ol></section></div></article><article><header><span>02</span><h3>注文後の仕上げ</h3></header><div><section><h4>提供温度・文化の核</h4><p>{active.temperature}</p><p>{active.culturalAnchor}</p></section><section><h4>仕上げと盛り付け</h4><ol>{active.recipe.serviceSteps.map((step) => <li key={step}>{step}</li>)}</ol></section></div></article></div>
      <div className="safety-note"><b>食品安全・アレルゲン</b><p>{active.safety}</p><p>アレルゲン: {active.allergens.length ? active.allergens.join("、") : "特記事項なし"}</p></div><button className="detail-return-button" type="button" onClick={() => resultsRef.current?.scrollIntoView({ behavior: "smooth" })}>他の逸品と比較する ↑</button>
    </section>}
  </main>;
}
