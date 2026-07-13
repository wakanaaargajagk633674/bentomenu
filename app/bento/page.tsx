"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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
  const [error, setError] = useState("");
  const canGenerate = selectedCuisines.length > 0 && price >= 500;

  const conditionSummary = useMemo(() => selectedCuisines.map((item) => cuisineLabels[item]).join("・"), [selectedCuisines]);

  const toggleCuisine = (cuisine: Cuisine) => {
    setSelectedCuisines((current) => current.includes(cuisine) ? current.filter((item) => item !== cuisine) : [...current, cuisine]);
  };

  const generate = async () => {
    setIsGenerating(true);
    setError("");
    setActive(null);

    try {
      const response = await fetch("/api/bento/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cuisines: selectedCuisines, price, gender, area }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "候補を生成できませんでした。");
      setResults(data.suggestions);
    } catch (caught) {
      setResults([]);
      setError(caught instanceof Error ? caught.message : "候補を生成できませんでした。");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <main className="planner-page">
      <header className="planner-header">
        <Link className="back" href="/">← トップへ戻る</Link>
        <span>名称（仮称）</span>
      </header>

      <section className="planner-hero">
        <p className="eyebrow">BENTO MENU PLANNER</p>
        <h1>どんな弁当に<br />しましょうか。</h1>
        <p>世界最高水準の4人の料理人が、味・彩り・食感・売り場との相性まで考えた4つの献立を提案します。</p>
      </section>

      <section className="planner-form" aria-label="弁当の条件">
        <fieldset>
          <legend><b>01</b><span>料理のジャンル</span><small>複数選択できます</small></legend>
          <div className="check-grid">
            {cuisines.map((cuisine) => <label className={selectedCuisines.includes(cuisine) ? "selected" : ""} key={cuisine}><input type="checkbox" checked={selectedCuisines.includes(cuisine)} onChange={() => toggleCuisine(cuisine)} /><span>{cuisineLabels[cuisine]}</span><i>✓</i></label>)}
          </div>
        </fieldset>

        <fieldset>
          <legend><b>02</b><span>弁当の売価</span><small>税込価格を入力</small></legend>
          <div className="price-input"><span>¥</span><input aria-label="弁当売価" type="number" min="500" max="3000" step="10" value={price} onChange={(event) => setPrice(Number(event.target.value))} /><em>円</em></div>
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

        <button className="generate-button" type="button" disabled={!canGenerate || isGenerating} onClick={generate}><span>{isGenerating ? "4人の料理人が献立を考えています…" : "この条件で4種類を提案"}</span><b>{isGenerating ? "…" : "→"}</b></button>
        {error && <div className="generation-error" role="alert"><b>提案を生成できませんでした</b><p>{error}</p></div>}
      </section>

      {results.length > 0 && <section className="suggestions" id="suggestions">
        <div className="suggestion-heading"><div><p className="eyebrow">4 MENU IDEAS</p><h2>おすすめの弁当候補</h2></div><p>{conditionSummary} ／ {price.toLocaleString()}円</p></div>
        <div className="suggestion-grid">{results.map((pattern, index) => <button type="button" className="suggestion-card" key={pattern.id} onClick={() => setActive(pattern)}><span className="candidate-number">0{index + 1}</span><small>{cuisineLabels[pattern.cuisine]}</small><h3>{pattern.name}</h3><p>{pattern.tagline}</p><div className="color-dots">{pattern.colors.map((color) => <i title={color} key={color} />)}</div><strong>詳しいレシピと材料を見る <span>→</span></strong></button>)}</div>
      </section>}

      {active && <section className="recipe-detail" aria-live="polite">
        <button type="button" className="detail-close" aria-label="詳細を閉じる" onClick={() => setActive(null)}>×</button>
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
      </section>}
    </main>
  );
}
