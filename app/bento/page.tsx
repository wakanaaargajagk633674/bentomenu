"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Area, BentoPattern, Cuisine, Gender, cuisineLabels } from "@/lib/bento-menu-data";

const cuisines = Object.keys(cuisineLabels) as Cuisine[];
const genderOptions: { value: Gender; label: string }[] = [{ value: "male", label: "男性" }, { value: "female", label: "女性" }, { value: "all", label: "両方" }];
const areaOptions: { value: Area; label: string; note: string }[] = [
  { value: "residential", label: "住宅街", note: "家族・日常の満足感" },
  { value: "office", label: "オフィス街", note: "食べやすさ・午後の軽さ" },
  { value: "station", label: "駅前", note: "分かりやすさ・持ち運び" },
];

export default function BentoPage() {
  const [selectedCuisines, setSelectedCuisines] = useState<Cuisine[]>(["japanese"]);
  const [price, setPrice] = useState(800);
  const [gender, setGender] = useState<Gender>("all");
  const [area, setArea] = useState<Area>("office");
  const [results, setResults] = useState<BentoPattern[]>([]);
  const [active, setActive] = useState<BentoPattern | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState("");
  const resultsRef = useRef<HTMLElement>(null);
  const detailRef = useRef<HTMLElement>(null);
  const abortRef = useRef<AbortController | null>(null);
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

  const conditionSummary = useMemo(() => selectedCuisines.map((item) => cuisineLabels[item]).join("・"), [selectedCuisines]);

  const toggleCuisine = (cuisine: Cuisine) => {
    setSelectedCuisines((current) => current.includes(cuisine) ? current.filter((item) => item !== cuisine) : [...current, cuisine]);
  };

  const generate = async () => {
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    setElapsedSeconds(0);
    setIsGenerating(true);
    setError("");
    setActive(null);

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
      setResults(data.suggestions);
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

  const generationStage = elapsedSeconds < 25
    ? "条件を読み取り、献立の方向性を整理しています"
    : elapsedSeconds < 65
      ? "料理人チームが味・彩り・食感を検討しています"
      : "原価とレシピを確認し、4つの提案に仕上げています";

  return (
    <main className="planner-page">
      <header className="planner-header">
        <Link className="back" href="/">← トップへ戻る</Link>
        <span>名称（仮称）</span>
      </header>

      <section className="planner-hero">
        <p className="eyebrow">BENTO MENU PLANNER</p>
        <h1>売れる弁当を、<br />4つの条件から。</h1>
        <p>ジャンル・価格・お客様・販売場所を選ぶだけ。料理人チームが、味と見栄え、原価まで考えた4案を提案します。</p>
        <div className="hero-guide" aria-label="使い方"><span>1</span> 条件を選ぶ <i>→</i><span>2</span> 約1〜2分待つ <i>→</i><span>3</span> 4案から選ぶ</div>
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
        <div className="suggestion-grid">{results.map((pattern, index) => <button type="button" className={`suggestion-card ${active?.id === pattern.id ? "selected" : ""}`} aria-expanded={active?.id === pattern.id} aria-controls="recipe-detail" key={pattern.id} onClick={() => setActive(pattern)}><span className="candidate-number">0{index + 1}</span><small>{cuisineLabels[pattern.cuisine]}</small><h3>{pattern.name}</h3><p>{pattern.tagline}</p><dl className="card-metrics"><div><dt>主な内容</dt><dd>{pattern.contents[0]}</dd></div><div><dt>変動費率</dt><dd>{pattern.profitPlan.variableCostRatePercent.toFixed(1)}%</dd></div></dl><div className="color-dots">{pattern.colors.map((color) => <i title={color} key={color} />)}</div><strong>レシピと採算を見る <span>→</span></strong></button>)}</div>
      </section>}

      {active && <section className="recipe-detail" id="recipe-detail" ref={detailRef} aria-live="polite">
        <button type="button" className="detail-close" aria-label="詳細を閉じる" onClick={() => setActive(null)}>×</button>
        <button type="button" className="back-to-results" onClick={() => resultsRef.current?.scrollIntoView({ behavior: "smooth" })}>← 4つの候補へ戻る</button>
        <div className="detail-title"><p className="eyebrow">RECIPE DETAIL / {cuisineLabels[active.cuisine]}</p><h2>{active.name}</h2><p>{active.tagline}</p></div>
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
