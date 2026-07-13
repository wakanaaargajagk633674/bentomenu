"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Area, BentoPattern, Cuisine, Gender, cuisineLabels } from "@/lib/bento-menu-data";
import { attachSavedMenuImage, createSavedMenu, markSavedMenuImageFailed } from "@/lib/saved-menus";

const cuisines = Object.keys(cuisineLabels) as Cuisine[];
const genderOptions: { value: Gender; label: string }[] = [{ value: "male", label: "男性" }, { value: "female", label: "女性" }, { value: "all", label: "両方" }];
const areaOptions: { value: Area; label: string; note: string }[] = [
  { value: "residential", label: "住宅街", note: "家族・日常の満足感" },
  { value: "office", label: "オフィス街", note: "食べやすさ・午後の軽さ" },
  { value: "station", label: "駅前", note: "分かりやすさ・持ち運び" },
];

type PhotoState = { status: "queued" | "generating" | "ready" | "failed"; url?: string; error?: string };
type SaveState = { status: "saving" | "image" | "saved" | "failed"; error?: string };

export default function BentoPage() {
  const [selectedCuisines, setSelectedCuisines] = useState<Cuisine[]>(["japanese"]);
  const [price, setPrice] = useState(800);
  const [gender, setGender] = useState<Gender>("all");
  const [area, setArea] = useState<Area>("office");
  const [results, setResults] = useState<BentoPattern[]>([]);
  const [active, setActive] = useState<BentoPattern | null>(null);
  const [photos, setPhotos] = useState<Record<string, PhotoState>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState("");
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const resultsRef = useRef<HTMLElement>(null);
  const detailRef = useRef<HTMLElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const photoAbortRef = useRef<AbortController | null>(null);
  const photoUrlsRef = useRef(new Set<string>());
  const savedIdsRef = useRef<Record<string, string>>({});
  const canGenerate = selectedCuisines.length > 0 && price >= 500;

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
    photoAbortRef.current?.abort();
    photoUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const conditionSummary = useMemo(() => selectedCuisines.map((item) => cuisineLabels[item]).join("・"), [selectedCuisines]);

  const toggleCuisine = (cuisine: Cuisine) => {
    setSelectedCuisines((current) => current.includes(cuisine) ? current.filter((item) => item !== cuisine) : [...current, cuisine]);
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

  const startPhotoQueue = (patterns: BentoPattern[]) => {
    photoAbortRef.current?.abort();
    const controller = new AbortController();
    photoAbortRef.current = controller;
    setPhotos(Object.fromEntries(patterns.map((pattern) => [pattern.id, { status: "queued" as const }])));
    let nextIndex = 0;
    const worker = async () => {
      while (nextIndex < patterns.length && !controller.signal.aborted) {
        const pattern = patterns[nextIndex++];
        await loadPhoto(pattern, controller.signal);
      }
    };
    void Promise.all([worker(), worker()]).finally(() => {
      if (photoAbortRef.current === controller) photoAbortRef.current = null;
    });
  };

  const resetPhotos = () => {
    photoAbortRef.current?.abort();
    photoUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    photoUrlsRef.current.clear();
    setPhotos({});
  };

  const generate = async () => {
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    setElapsedSeconds(0);
    setIsGenerating(true);
    setError("");
    setActive(null);
    setSaveStates({});
    savedIdsRef.current = {};
    resetPhotos();

    try {
      const response = await fetch("/api/bento/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cuisines: selectedCuisines, price, gender, area }),
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
      const suggestions = data.suggestions as BentoPattern[];
      setResults(suggestions);
      startPhotoQueue(suggestions);
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
    ? "条件を読み取り、献立の方向性を整理しています"
    : elapsedSeconds < 65
      ? "料理人チームが味・彩り・食感を検討しています"
      : "原価とレシピを確認し、4つの提案に仕上げています";

  return (
    <main className="planner-page">
      <header className="planner-header">
        <Link className="back" href="/">← トップへ戻る</Link>
        <Link className="library-link" href="/saved">保存したメニューを確認</Link>
      </header>

      <section className="planner-hero">
        <p className="eyebrow">BENTO MENU PLANNER</p>
        <h1>売れる弁当を、<br />4つの条件から。</h1>
        <p>ジャンル・価格・お客様・販売場所を選ぶだけ。料理人チームが、味と見栄え、原価まで考えた4案を提案します。</p>
        <div className="hero-guide" aria-label="使い方"><span>1</span> 条件を選ぶ <i>→</i><span>2</span> 献立を先に確認 <i>→</i><span>3</span> 完成写真を比較</div>
      </section>

      <section className="planner-form" aria-label="弁当の条件">
        <div className="form-heading"><div><p className="eyebrow">YOUR CONDITIONS</p><h2>4つの条件を選択</h2></div><p>迷ったら初期設定のままで大丈夫です</p></div>
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
        </div>

        <div className="condition-bar">
          <div><small>選択中</small><strong>{conditionSummary}・{price.toLocaleString()}円・{genderOptions.find((item) => item.value === gender)?.label}・{areaOptions.find((item) => item.value === area)?.label}</strong></div>
          <button className="generate-button" type="button" disabled={!canGenerate || isGenerating} onClick={generate}><span>{isGenerating ? "生成しています" : results.length > 0 ? "この条件で再生成" : "4つの献立をつくる"}</span><b>{isGenerating ? "…" : "→"}</b></button>
        </div>
        {isGenerating && <div className="generation-progress" role="status" aria-live="polite">
          <div className="progress-top"><span className="progress-spinner" aria-hidden="true" /><div><b>料理人チームが考えています</b><p>{generationStage}</p></div><time>{elapsedSeconds}秒</time></div>
          <div className="progress-track"><i /></div>
          <div className="progress-foot"><span>通常1〜2分ほどかかります。この画面を開いたままお待ちください。</span><button type="button" onClick={() => abortRef.current?.abort()}>中止する</button></div>
        </div>}
        {error && <div className="generation-error" role="alert"><b>提案を生成できませんでした</b><p>{error}</p></div>}
      </section>

      {results.length > 0 && <section className="suggestions" id="suggestions" ref={resultsRef} aria-live="polite">
        <div className="suggestion-heading"><div><p className="eyebrow">4 MENU IDEAS</p><h2>おすすめの弁当候補</h2></div><p>{conditionSummary} ／ {price.toLocaleString()}円</p></div>
        <p className="photo-progress" role="status">献立を先に表示しています。完成写真は2枚ずつ生成し、できた順に表示します。</p>
        <div className="suggestion-grid">{results.map((pattern, index) => {
          const photo = photos[pattern.id];
          return <article className={`suggestion-card ${active?.id === pattern.id ? "selected" : ""}`} key={pattern.id}>
            <div className={`suggestion-photo ${photo?.status === "ready" ? "ready" : ""}`}>
              {photo?.status === "ready" && photo.url
                ? <Image src={photo.url} alt={pattern.imageSpec.altText} fill sizes="(max-width: 720px) 100vw, (max-width: 900px) 50vw, 25vw" unoptimized />
                : <div className="photo-placeholder"><span aria-hidden="true" />{photo?.status === "failed" ? <><b>写真のみ生成できませんでした</b><small>{photo.error}</small><button type="button" onClick={() => loadPhoto(pattern)}>写真だけ再試行</button></> : <><b>{photo?.status === "queued" ? "生成待ち" : "完成写真を生成中"}</b><small>献立と盛り付け仕様を忠実に反映します</small></>}</div>}
            </div>
            <button type="button" className="suggestion-card-body" aria-expanded={active?.id === pattern.id} aria-controls="recipe-detail" onClick={() => setActive(pattern)}><span className="candidate-number">0{index + 1}</span><small>{cuisineLabels[pattern.cuisine]}</small><h3>{pattern.name}</h3><p>{pattern.tagline}</p><dl className="card-metrics"><div><dt>主な内容</dt><dd>{pattern.contents[0]}</dd></div><div><dt>変動費率</dt><dd>{pattern.profitPlan.variableCostRatePercent.toFixed(1)}%</dd></div></dl><div className="color-dots">{pattern.colors.map((color) => <i title={color} key={color} />)}</div><strong>レシピと採算を見る <span>→</span></strong></button>
            <div className="suggestion-actions"><button type="button" className={`save-menu-button ${saveStates[pattern.id]?.status === "saved" ? "saved" : saveStates[pattern.id]?.status === "failed" ? "failed" : ""}`} disabled={Boolean(saveStates[pattern.id] && ["saving", "image", "saved"].includes(saveStates[pattern.id].status))} onClick={() => savePattern(pattern)} aria-label={`${pattern.name}を保存`}>{saveStates[pattern.id]?.status === "saving" ? "メニューを保存中…" : saveStates[pattern.id]?.status === "image" ? "メニュー保存済み・画像を保存中…" : saveStates[pattern.id]?.status === "saved" ? "保存しました ✓" : saveStates[pattern.id]?.status === "failed" ? "保存を再試行" : "このメニューを保存"}</button></div>
          </article>;
        })}</div>
        <p className="image-disclaimer">AIによる盛り付け完成イメージです。実際の仕上がりは食材・加熱・盛り付けで異なり、中心温度や衛生状態を写真だけで保証するものではありません。</p>
      </section>}

      {active && <section className="recipe-detail" id="recipe-detail" ref={detailRef} aria-live="polite">
        <button type="button" className="detail-close" aria-label="詳細を閉じる" onClick={() => setActive(null)}>×</button>
        <button type="button" className="back-to-results" onClick={() => resultsRef.current?.scrollIntoView({ behavior: "smooth" })}>← 4つの候補へ戻る</button>
        <div className="detail-title"><p className="eyebrow">RECIPE DETAIL / {cuisineLabels[active.cuisine]}</p><h2>{active.name}</h2><p>{active.tagline}</p></div>
        <button type="button" className={`save-menu-button detail-save ${saveStates[active.id]?.status === "saved" ? "saved" : saveStates[active.id]?.status === "failed" ? "failed" : ""}`} disabled={Boolean(saveStates[active.id] && ["saving", "image", "saved"].includes(saveStates[active.id].status))} onClick={() => savePattern(active)}>{saveStates[active.id]?.status === "saving" ? "メニューを保存中…" : saveStates[active.id]?.status === "image" ? "メニュー保存済み・画像を保存中…" : saveStates[active.id]?.status === "saved" ? "保存しました ✓" : saveStates[active.id]?.status === "failed" ? "保存を再試行" : "このメニューを保存"}</button>
        {saveStates[active.id]?.error && <p className="save-status" role="alert">{saveStates[active.id].error}</p>}
        <div className="detail-photo">
          {photos[active.id]?.status === "ready" && photos[active.id].url ? <div className="detail-photo-frame"><Image src={photos[active.id].url!} alt={active.imageSpec.altText} fill sizes="(max-width: 900px) 100vw, 860px" unoptimized /></div> : <div className="photo-placeholder"><b>{photos[active.id]?.status === "failed" ? "完成写真を生成できませんでした" : "完成写真を生成中"}</b>{photos[active.id]?.status === "failed" && <button type="button" onClick={() => loadPhoto(active)}>写真だけ再試行</button>}</div>}
          <p>AIによる盛り付け完成イメージです。調理時は下記の加熱・冷却・保冷手順を優先してください。</p>
        </div>
        <div className="design-grid"><article><b>味の設計</b><p>{active.flavor}</p></article><article><b>食感の設計</b><p>{active.texture}</p></article><article><b>構成</b><p>{active.contents.join(" ／ ")}</p></article></div>
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
