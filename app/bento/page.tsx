"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Area, BentoMenuCandidate, BentoPattern, BentoSeason, Cuisine, Gender, cuisineLabels, seasonLabels } from "@/lib/bento-menu-data";
import type { BentoRequest } from "@/lib/ai/bento-schema";
import { attachSavedMenuImage, createSavedMenu, markSavedMenuImageFailed } from "@/lib/saved-menus";
import { ChefQualityPanel } from "@/app/components/chef-quality-panel";
import { readImageCostHeaders, recordApiUsage } from "@/lib/api-usage";
import type { ApiCostRecord } from "@/lib/ai/api-cost";
import { menuImageAlt } from "@/lib/menu-image-alt";

const cuisines = Object.keys(cuisineLabels) as Cuisine[];
const genderOptions: { value: Gender; label: string }[] = [{ value: "male", label: "男性" }, { value: "female", label: "女性" }, { value: "all", label: "両方" }];
const areaOptions: { value: Area; label: string; note: string }[] = [
  { value: "residential", label: "住宅街", note: "家族・日常の満足感" },
  { value: "office", label: "オフィス街", note: "食べやすさ・午後の軽さ" },
  { value: "station", label: "駅前", note: "分かりやすさ・持ち運び" },
];
const seasonOptions: Array<{ value: BentoSeason; label: string }> = [
  { value: "auto", label: "おまかせ" },
  { value: "spring", label: "春" },
  { value: "summer", label: "夏" },
  { value: "autumn", label: "秋" },
  { value: "winter", label: "冬" },
];

type PhotoState = { status: "generating" | "ready" | "failed"; url?: string; error?: string };
type SaveState = { status: "saving" | "image" | "saved" | "failed"; error?: string };

export default function BentoPage() {
  const [selectedCuisines, setSelectedCuisines] = useState<Cuisine[]>(["japanese"]);
  const [price, setPrice] = useState(800);
  const [gender, setGender] = useState<Gender>("all");
  const [area, setArea] = useState<Area>("office");
  const [season, setSeason] = useState<BentoSeason>("auto");
  const [requestEnabled, setRequestEnabled] = useState(false);
  const [requestText, setRequestText] = useState("");
  const [generatedRequest, setGeneratedRequest] = useState<string | null>(null);
  const [results, setResults] = useState<BentoMenuCandidate[]>([]);
  const [active, setActive] = useState<BentoPattern | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<BentoMenuCandidate | null>(null);
  const [generatedConditions, setGeneratedConditions] = useState<BentoRequest | null>(null);
  const [photos, setPhotos] = useState<Record<string, PhotoState>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDetailGenerating, setIsDetailGenerating] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState("");
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const [sessionCostJpy, setSessionCostJpy] = useState(0);
  const [costLogWarning, setCostLogWarning] = useState("");
  const resultsRef = useRef<HTMLElement>(null);
  const detailRef = useRef<HTMLElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const detailAbortRef = useRef<AbortController | null>(null);
  const photoAbortRef = useRef<AbortController | null>(null);
  const photoUrlsRef = useRef(new Set<string>());
  const savedIdsRef = useRef<Record<string, string>>({});
  const canGenerate = selectedCuisines.length > 0 && price >= 500 && (!requestEnabled || requestText.trim().length > 0);

  useEffect(() => {
    if (results.length > 0) {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [results]);

  useEffect(() => {
    if (active) detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [active]);

  useEffect(() => {
    if (!isGenerating) return;
    const timer = window.setInterval(() => setElapsedSeconds((current) => current + 1), 1000);
    return () => window.clearInterval(timer);
  }, [isGenerating]);

  useEffect(() => () => {
    abortRef.current?.abort();
    detailAbortRef.current?.abort();
    photoAbortRef.current?.abort();
    photoUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const conditionSummary = useMemo(() => selectedCuisines.map((item) => cuisineLabels[item]).join("・"), [selectedCuisines]);

  const toggleCuisine = (cuisine: Cuisine) => {
    setSelectedCuisines((current) => current.includes(cuisine) ? current.filter((item) => item !== cuisine) : [...current, cuisine]);
  };

  const saveUsageCost = async (cost?: ApiCostRecord | null) => {
    if (!cost) return;
    setSessionCostJpy((current) => current + cost.estimatedCostJpy);
    try {
      await recordApiUsage(cost);
    } catch {
      setCostLogWarning("費用は画面上で計算しましたが、履歴への保存に失敗しました。費用記録画面を確認してください。");
    }
  };

  const loadPhoto = async (pattern: BentoPattern, signal?: AbortSignal) => {
    setPhotos((current) => ({ ...current, [pattern.id]: { status: "generating" } }));
    try {
      const response = await fetch("/api/bento/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestion: pattern, imageToken: pattern.imageToken }),
        signal,
      });
      if (!response.ok) {
        const contentType = response.headers.get("content-type") || "";
        const data = contentType.includes("application/json") ? await response.json() : null;
        throw new Error(typeof data?.error === "string" ? data.error : "完成写真を生成できませんでした。");
      }
      await saveUsageCost(readImageCostHeaders(response.headers, "bento"));
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      photoUrlsRef.current.add(url);
      setPhotos((current) => {
        const oldUrl = current[pattern.id]?.url;
        if (oldUrl) {
          URL.revokeObjectURL(oldUrl);
          photoUrlsRef.current.delete(oldUrl);
        }
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
    photoUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    photoUrlsRef.current.clear();
    setPhotos({});
  };

  const generate = async () => {
    const submittedRequest = requestEnabled ? requestText.trim() : null;
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    setElapsedSeconds(0);
    setIsGenerating(true);
    setError("");
    setGeneratedRequest(null);
    setGeneratedConditions(null);
    setActive(null);
    setSelectedCandidate(null);
    setDetailError("");
    detailAbortRef.current?.abort();
    setSaveStates({});
    savedIdsRef.current = {};
    resetPhotos();

    try {
      const conditions: BentoRequest = { cuisines: selectedCuisines, price, gender, area, season, requestEnabled: submittedRequest !== null, requestText: submittedRequest ?? "" };
      const response = await fetch("/api/bento/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(conditions),
        signal: controller.signal,
      });
      const contentType = response.headers.get("content-type") || "";
      const data = contentType.includes("application/json")
        ? await response.json()
        : { error: await response.text() };
      if (!response.ok) {
        const fallback = response.status === 504
          ? "AIの応答が制限時間を超えました。もう一度お試しください。"
          : "候補を生成できませんでした。";
        const serverMessage = typeof data.error === "string" && !data.error.startsWith("An error occurred")
          ? data.error
          : fallback;
        throw new Error(serverMessage);
      }
      if (!Array.isArray(data.suggestions)) throw new Error("AIから正しい形式の候補が返りませんでした。");
      await saveUsageCost(data.usageCost as ApiCostRecord | undefined);
      const suggestions = data.suggestions as BentoMenuCandidate[];
      setResults(suggestions);
      setGeneratedRequest(submittedRequest);
      setGeneratedConditions(conditions);
    } catch (caught) {
      setResults([]);
      setError(caught instanceof DOMException && caught.name === "AbortError"
        ? "生成を中止しました。条件を調整して、もう一度お試しください。"
        : caught instanceof Error ? caught.message : "候補を生成できませんでした。");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setIsGenerating(false);
    }
  };

  const selectCandidate = async (candidate: BentoMenuCandidate) => {
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
      const response = await fetch("/api/bento/detail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conditions: generatedConditions, candidate }),
        signal: controller.signal,
      });
      const data = (response.headers.get("content-type") || "").includes("application/json") ? await response.json() : { error: await response.text() };
      if (!response.ok || !data.suggestion) throw new Error(typeof data.error === "string" ? data.error : "詳細レシピを生成できませんでした。");
      await saveUsageCost(data.usageCost as ApiCostRecord | undefined);
      const detail = data.suggestion as BentoPattern;
      setActive(detail);
      const photoController = new AbortController();
      photoAbortRef.current = photoController;
      void loadPhoto(detail, photoController.signal).finally(() => {
        if (photoAbortRef.current === photoController) photoAbortRef.current = null;
      });
    } catch (caught) {
      if (!(caught instanceof DOMException && caught.name === "AbortError")) setDetailError(caught instanceof Error ? caught.message : "詳細レシピを生成できませんでした。");
    } finally {
      if (detailAbortRef.current === controller) detailAbortRef.current = null;
      setIsDetailGenerating(false);
    }
  };

  const savePattern = async (pattern: BentoPattern) => {
    const current = saveStates[pattern.id];
    if (current?.status === "saving" || current?.status === "image" || current?.status === "saved") return;
    setSaveStates((states) => ({ ...states, [pattern.id]: { status: "saving" } }));
    try {
      const saved = await createSavedMenu("bento", pattern as unknown as Record<string, unknown>);
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

  const generationStage = elapsedSeconds < 25
    ? "条件を読み取り、4候補の方向性を整理しています"
    : elapsedSeconds < 65
      ? "料理人チームが味・彩り・食感を検討しています"
      : "構成と原価を確認し、比較しやすい4案に仕上げています";

  return (
    <main className="planner-page">
      <header className="planner-header">
        <Link className="back" href="/">← トップへ戻る</Link>
        <div><Link className="library-link" href="/usage">API費用</Link> <Link className="library-link" href="/saved">保存したメニューを確認</Link></div>
      </header>

      <section className="planner-hero">
        <p className="eyebrow">BENTO MENU PLANNER</p>
        <h1>売れる弁当を、<br />6つの条件から。</h1>
        <p>ジャンル・価格・お客様・販売場所・季節を選び、必要なら要望を追加。料理人チームが、味と見栄え、原価まで考えた4案を提案します。</p>
        <div className="hero-guide" aria-label="使い方"><span>1</span> 4候補を比較 <i>→</i><span>2</span> 1件を選ぶ <i>→</i><span>3</span> 詳細と写真を生成</div>
      </section>

      <section className="planner-form" aria-label="弁当の条件">
        <div className="form-heading"><div><p className="eyebrow">YOUR CONDITIONS</p><h2>6つの条件を選択</h2></div><p>06「要望」は必要なときだけ入力できます</p></div>
        <div className="planner-fields">
        <fieldset className="genre-field">
          <legend><b>01</b><span>料理のジャンル</span><small>複数選択できます</small></legend>
          <div className="check-grid">
            {cuisines.map((cuisine) => <label className={selectedCuisines.includes(cuisine) ? "selected" : ""} key={cuisine}><input type="checkbox" checked={selectedCuisines.includes(cuisine)} onChange={() => toggleCuisine(cuisine)} /><span>{cuisineLabels[cuisine]}</span><i>✓</i></label>)}
          </div>
        </fieldset>

        <fieldset>
          <legend><b>02</b><span>弁当の売価</span><small>税込価格を入力</small></legend>
          <div className="price-input"><span>¥</span><input aria-label="弁当売価" inputMode="numeric" type="number" min="500" max="3000" step="10" value={price} onChange={(event) => setPrice(Number(event.target.value))} /><em>円</em></div>
          <div className="price-presets" aria-label="よく使う価格">{[700, 800, 1000].map((amount) => <button type="button" className={price === amount ? "selected" : ""} onClick={() => setPrice(amount)} key={amount}>{amount.toLocaleString()}円</button>)}</div>
          {price < 500 && <p className="field-error">500円以上で入力してください。</p>}
        </fieldset>

        <fieldset>
          <legend><b>03</b><span>ターゲット性別</span></legend>
          <div className="radio-grid three">{genderOptions.map((option) => <label className={gender === option.value ? "selected" : ""} key={option.value}><input type="radio" name="gender" checked={gender === option.value} onChange={() => setGender(option.value)} /><span>{option.label}</span></label>)}</div>
        </fieldset>

        <fieldset>
          <legend><b>04</b><span>販売地域</span></legend>
          <div className="radio-grid areas">{areaOptions.map((option) => <label className={area === option.value ? "selected" : ""} key={option.value}><input type="radio" name="area" checked={area === option.value} onChange={() => setArea(option.value)} /><span>{option.label}<small>{option.note}</small></span></label>)}</div>
        </fieldset>

        <fieldset>
          <legend><b>05</b><span>季節</span><small>旬・香り・色・安全性に反映</small></legend>
          <div className="radio-grid izakaya-options season-options">{seasonOptions.map((option) => <label className={season === option.value ? "selected" : ""} key={option.value}><input type="radio" name="bento-season" checked={season === option.value} onChange={() => setSeason(option.value)} /><span>{option.label}</span></label>)}</div>
        </fieldset>

        <fieldset className="request-field">
          <legend><b>06</b><span>要望</span><small>任意入力</small></legend>
          <label className={`request-toggle ${requestEnabled ? "selected" : ""}`}>
            <input type="checkbox" checked={requestEnabled} onChange={(event) => setRequestEnabled(event.target.checked)} aria-controls="bento-request-input" aria-expanded={requestEnabled} />
            <span><b>要望を追加する</b><small>食材、量、味付け、避けたいものなどを料理人へ伝えます</small></span><i aria-hidden="true">✓</i>
          </label>
          {requestEnabled && <div className="request-input" id="bento-request-input">
            <label htmlFor="bento-request-text">料理人への要望</label>
            <textarea id="bento-request-text" value={requestText} maxLength={500} rows={4} autoFocus onChange={(event) => setRequestText(event.target.value)} placeholder="例：魚を主菜にして、揚げ物は使わず、野菜を多めにしてください" aria-describedby="bento-request-help bento-request-count" />
            <div><small id="bento-request-help">安全性・売価・選択したジャンルと季節を守りながら、4候補すべてに反映します。</small><span id="bento-request-count">{requestText.length}/500</span></div>
            {requestText.trim().length === 0 && <p className="field-error">要望を入力するか、チェックを外してください。</p>}
          </div>}
        </fieldset>
        </div>

        <div className="condition-bar">
          <div><small>選択中</small><strong>{conditionSummary}・{price.toLocaleString()}円・{genderOptions.find((item) => item.value === gender)?.label}・{areaOptions.find((item) => item.value === area)?.label}・{seasonLabels[season]}{requestEnabled ? "・要望あり" : ""}</strong></div>
          <button className="generate-button" type="button" disabled={!canGenerate || isGenerating} onClick={generate}><span>{isGenerating ? "生成しています" : results.length > 0 ? "この条件で再生成" : "4つの献立をつくる"}</span><b>{isGenerating ? "…" : "→"}</b></button>
        </div>
        {isGenerating && <div className="generation-progress" role="status" aria-live="polite">
          <div className="progress-top"><span className="progress-spinner" aria-hidden="true" /><div><b>料理人チームが考えています</b><p>{generationStage}</p></div><time>{elapsedSeconds}秒</time></div>
          <div className="progress-track"><i /></div>
          <div className="progress-foot"><span>Flex Processingで比較用の4候補を生成しています。混雑時は時間がかかる場合があります。</span><button type="button" onClick={() => abortRef.current?.abort()}>中止する</button></div>
        </div>}
        {error && <div className="generation-error" role="alert"><b>提案を生成できませんでした</b><p>{error}</p></div>}
        {sessionCostJpy > 0 && <p className="request-applied-note"><b>この画面でのAPI費用</b><span>約{sessionCostJpy.toFixed(2)}円　<Link href="/usage">履歴と累計を見る</Link></span></p>}
        {costLogWarning && <p className="field-error" role="alert">{costLogWarning}</p>}
      </section>

      {results.length > 0 && <section className="suggestions" id="suggestions" ref={resultsRef} aria-live="polite">
        <div className="suggestion-heading"><div><p className="eyebrow">4 MENU IDEAS</p><h2>おすすめの弁当候補</h2></div><p>{conditionSummary} ／ {price.toLocaleString()}円 ／ {seasonLabels[season]}</p></div>
        {generatedRequest && <p className="request-applied-note"><b>料理人へ反映した要望</b><span>{generatedRequest}</span></p>}
        <p className="photo-progress" role="status">まず料理名・構成・味・原価・特徴だけを比較できます。選んだ1件だけ、詳細レシピと完成写真を生成します。</p>
        <div className="suggestion-grid">{results.map((pattern, index) => {
          return <article className={`suggestion-card ${selectedCandidate?.id === pattern.id ? "selected" : ""}`} key={pattern.id}>
            <div className="suggestion-photo"><div className="photo-placeholder"><span aria-hidden="true" /><b>候補比較</b><small>写真は選択後、この1件だけ生成します</small></div></div>
            <button type="button" disabled={isDetailGenerating} className="suggestion-card-body" aria-expanded={active?.id === pattern.id} aria-controls="recipe-detail" onClick={() => void selectCandidate(pattern)}><span className="candidate-number">0{index + 1}</span><small>{cuisineLabels[pattern.cuisine]}・{seasonLabels[pattern.season]}</small><h3>{pattern.name}</h3><p>{pattern.tagline}</p><p>{pattern.distinctiveFeature}</p><dl className="card-metrics"><div><dt>構成</dt><dd>{pattern.contents.join("・")}</dd></div><div><dt>食材原価</dt><dd>約¥{pattern.profitPlan.estimatedFoodCostYen.toLocaleString()}</dd></div><div><dt>変動費率</dt><dd>{pattern.profitPlan.variableCostRatePercent.toFixed(1)}%</dd></div></dl><div className="color-dots">{pattern.colors.map((color) => <i title={color} key={color} />)}</div><strong>{isDetailGenerating && selectedCandidate?.id === pattern.id ? "詳細を生成しています…" : "この案を選んで詳細・写真を生成"} <span>→</span></strong></button>
          </article>;
        })}</div>
        <p className="image-disclaimer">候補選定では画像料金は発生しません。選択後に完成写真を1枚生成します。</p>
      </section>}

      {isDetailGenerating && selectedCandidate && <section className="recipe-detail" aria-live="polite"><div className="generation-progress" role="status"><div className="progress-top"><span className="progress-spinner" aria-hidden="true" /><div><b>{selectedCandidate.name}を詳細化しています</b><p>レシピ、手順、盛り付け、品質審査、写真仕様をこの1件だけ作成しています。</p></div></div><div className="progress-track"><i /></div><div className="progress-foot"><span>Flex Processingのため、混雑時は応答が遅くなる場合があります。</span><button type="button" onClick={() => detailAbortRef.current?.abort()}>中止する</button></div></div></section>}
      {detailError && <div className="generation-error" role="alert"><b>選択した候補を詳細化できませんでした</b><p>{detailError}</p>{selectedCandidate && <button type="button" onClick={() => void selectCandidate(selectedCandidate)}>もう一度試す</button>}</div>}

      {active && <section className="recipe-detail" id="recipe-detail" ref={detailRef} aria-live="polite">
        <button type="button" className="detail-close" aria-label="詳細を閉じる" onClick={() => setActive(null)}>×</button>
        <button type="button" className="back-to-results" onClick={() => resultsRef.current?.scrollIntoView({ behavior: "smooth" })}>← 4つの候補へ戻る</button>
        <div className="detail-title"><p className="eyebrow">RECIPE DETAIL / {cuisineLabels[active.cuisine]} / {seasonLabels[active.season]}</p><h2>{active.name}</h2><p>{active.tagline}</p></div>
        <button type="button" className={`save-menu-button detail-save ${saveStates[active.id]?.status === "saved" ? "saved" : saveStates[active.id]?.status === "failed" ? "failed" : ""}`} disabled={Boolean(saveStates[active.id] && ["saving", "image", "saved"].includes(saveStates[active.id].status))} onClick={() => savePattern(active)}>{saveStates[active.id]?.status === "saving" ? "メニューを保存中…" : saveStates[active.id]?.status === "image" ? "メニュー保存済み・画像を保存中…" : saveStates[active.id]?.status === "saved" ? "保存しました ✓" : saveStates[active.id]?.status === "failed" ? "保存を再試行" : "このメニューを保存"}</button>
        {saveStates[active.id]?.error && <p className="save-status" role="alert">{saveStates[active.id].error}</p>}
        <div className="detail-photo">
          {photos[active.id]?.status === "ready" && photos[active.id].url ? <div className="detail-photo-frame"><Image src={photos[active.id].url!} alt={menuImageAlt("bento", active.name)} fill sizes="(max-width: 900px) 100vw, 860px" unoptimized /></div> : <div className="photo-placeholder"><b>{photos[active.id]?.status === "failed" ? "完成写真を生成できませんでした" : "完成写真を生成中"}</b>{photos[active.id]?.status === "failed" && <button type="button" onClick={() => loadPhoto(active)}>写真だけ再試行</button>}</div>}
          <p>AIによる盛り付け完成イメージです。調理時は下記の加熱・冷却・保冷手順を優先してください。</p>
        </div>
        <div className="design-grid"><article><b>味の設計</b><p>{active.flavor}</p></article><article><b>食感の設計</b><p>{active.texture}</p></article><article><b>{seasonLabels[active.season]}の季節設計</b><p>{active.seasonalDesign}</p><p>{active.contents.join(" ／ ")}</p></article></div>
        <ChefQualityPanel review={active.qualityReview} />
        <div className="profit-panel">
          <div className="profit-heading"><div><p className="eyebrow">MANAGEMENT REVIEW</p><h3>経営者による採算チェック</h3></div><strong>想定粗利益 ¥{active.profitPlan.estimatedGrossProfitYen.toLocaleString()}</strong></div>
          <div className="profit-numbers"><dl><dt>食材原価</dt><dd>¥{active.profitPlan.estimatedFoodCostYen.toLocaleString()}</dd></dl><dl><dt>容器・包材</dt><dd>¥{active.profitPlan.packagingCostYen.toLocaleString()}</dd></dl><dl><dt>その他変動費</dt><dd>¥{active.profitPlan.otherVariableCostYen.toLocaleString()}</dd></dl><dl><dt>変動費率</dt><dd>{active.profitPlan.variableCostRatePercent.toFixed(1)}%</dd></dl></div>
          <p className="management-verdict">{active.profitPlan.managementVerdict}</p>
          <details><summary>見積もりの前提と含まれない費用</summary><ul>{active.profitPlan.assumptions.map((item) => <li key={item}>{item}</li>)}</ul></details>
        </div>
        <p className="recipe-unit">材料はすべて <b>1食分</b> です</p>
        <div className="recipe-parts">{active.recipes.map((part, index) => <article key={part.name}><header><span>0{index + 1}</span><h3>{part.name}</h3></header><div><section><h4>材料</h4><ul>{part.ingredients.map((item) => <li key={item}>{item}</li>)}</ul></section><section><h4>作り方</h4><ol>{part.steps.map((step) => <li key={step}>{step}</li>)}</ol></section></div></article>)}</div>
        <div className="safety-note"><b>お弁当の安全ポイント</b><p>{active.safety}</p></div>
        <button type="button" className="detail-return-button" onClick={() => resultsRef.current?.scrollIntoView({ behavior: "smooth" })}>他の候補と比較する ↑</button>
      </section>}
    </main>
  );
}
