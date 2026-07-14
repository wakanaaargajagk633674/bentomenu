"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ApiCostRecord } from "@/lib/ai/api-cost";
import type { DinnerCandidate, DinnerRequest, DinnerSuggestion } from "@/lib/ai/dinner-schema";
import { recordApiUsage } from "@/lib/api-usage";
import { DinnerCuisine, DinnerGenderMix, dinnerCuisineLabels, dinnerGenderLabels } from "@/lib/dinner-menu-data";

const genderOptions = Object.entries(dinnerGenderLabels) as Array<[DinnerGenderMix, string]>;
const cuisineOptions = Object.entries(dinnerCuisineLabels) as Array<[DinnerCuisine, string]>;
const roleLabels = { main: "主菜", side: "副菜", soup: "汁物" } as const;

export default function DinnerPage() {
  const [people, setPeople] = useState(2);
  const [genderMix, setGenderMix] = useState<DinnerGenderMix>("balanced");
  const [cuisine, setCuisine] = useState<DinnerCuisine>("japanese");
  const [budgetYen, setBudgetYen] = useState(2000);
  const [requestEnabled, setRequestEnabled] = useState(false);
  const [requestText, setRequestText] = useState("");
  const [candidates, setCandidates] = useState<DinnerCandidate[]>([]);
  const [conditions, setConditions] = useState<DinnerRequest | null>(null);
  const [selected, setSelected] = useState<DinnerCandidate | null>(null);
  const [detail, setDetail] = useState<DinnerSuggestion | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDetailGenerating, setIsDetailGenerating] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [sessionCostJpy, setSessionCostJpy] = useState(0);
  const [costWarning, setCostWarning] = useState("");
  const resultsRef = useRef<HTMLElement>(null);
  const detailRef = useRef<HTMLElement>(null);
  const requestAbortRef = useRef<AbortController | null>(null);
  const canGenerate = budgetYen >= 500 && budgetYen <= 30000 && (!requestEnabled || requestText.trim().length > 0) && requestText.length <= 500;

  useEffect(() => {
    if (!isGenerating && !isDetailGenerating) return;
    const timer = window.setInterval(() => setElapsedSeconds((current) => current + 1), 1000);
    return () => window.clearInterval(timer);
  }, [isGenerating, isDetailGenerating]);

  useEffect(() => () => requestAbortRef.current?.abort(), []);
  useEffect(() => { if (candidates.length) resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [candidates]);
  useEffect(() => { if (detail) detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [detail]);

  const summary = useMemo(() => `${people}人・${dinnerGenderLabels[genderMix]}・${dinnerCuisineLabels[cuisine]}・予算${budgetYen.toLocaleString()}円`, [people, genderMix, cuisine, budgetYen]);

  const saveCost = async (cost?: ApiCostRecord) => {
    if (!cost) return;
    setSessionCostJpy((current) => current + cost.estimatedCostJpy);
    try { await recordApiUsage(cost); } catch { setCostWarning("費用は計算できましたが、履歴への保存に失敗しました。"); }
  };

  const generateCandidates = async () => {
    if (!canGenerate) return;
    requestAbortRef.current?.abort();
    const controller = new AbortController();
    requestAbortRef.current = controller;
    const submitted: DinnerRequest = { people, genderMix, cuisine, budgetYen, requestEnabled, requestText: requestEnabled ? requestText.trim() : "" };
    setElapsedSeconds(0); setIsGenerating(true); setError(""); setDetailError(""); setCandidates([]); setConditions(null); setSelected(null); setDetail(null);
    try {
      const response = await fetch("/api/dinner/suggest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(submitted), signal: controller.signal });
      const data = (response.headers.get("content-type") || "").includes("application/json") ? await response.json() : { error: await response.text() };
      if (!response.ok || !Array.isArray(data.suggestions)) throw new Error(typeof data.error === "string" ? data.error : "夜ご飯の候補を生成できませんでした。");
      await saveCost(data.usageCost as ApiCostRecord | undefined);
      setCandidates(data.suggestions as DinnerCandidate[]); setConditions(submitted);
    } catch (caught) {
      if (!(caught instanceof DOMException && caught.name === "AbortError")) setError(caught instanceof Error ? caught.message : "夜ご飯の候補を生成できませんでした。");
    } finally {
      if (requestAbortRef.current === controller) requestAbortRef.current = null;
      setIsGenerating(false);
    }
  };

  const selectCandidate = async (candidate: DinnerCandidate) => {
    if (!conditions || isDetailGenerating) return;
    requestAbortRef.current?.abort();
    const controller = new AbortController();
    requestAbortRef.current = controller;
    setElapsedSeconds(0); setSelected(candidate); setDetail(null); setDetailError(""); setIsDetailGenerating(true);
    try {
      const response = await fetch("/api/dinner/detail", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conditions, candidate }), signal: controller.signal });
      const data = (response.headers.get("content-type") || "").includes("application/json") ? await response.json() : { error: await response.text() };
      if (!response.ok || !data.suggestion) throw new Error(typeof data.error === "string" ? data.error : "夜ご飯の詳細を生成できませんでした。");
      await saveCost(data.usageCost as ApiCostRecord | undefined);
      setDetail(data.suggestion as DinnerSuggestion);
    } catch (caught) {
      if (!(caught instanceof DOMException && caught.name === "AbortError")) setDetailError(caught instanceof Error ? caught.message : "夜ご飯の詳細を生成できませんでした。");
    } finally {
      if (requestAbortRef.current === controller) requestAbortRef.current = null;
      setIsDetailGenerating(false);
    }
  };

  return <main className="planner-page dinner-planner">
    <header className="planner-header"><Link className="back" href="/">← トップへ戻る</Link><Link className="library-link" href="/usage">API費用</Link></header>
    <section className="planner-hero dinner-hero"><p className="eyebrow">FAMILY DINNER PLANNER</p><h1>今日の夜ご飯を、<br />家族にちょうどよく。</h1><p>人数・構成・料理ジャンル・全員分の予算から、主菜、副菜2〜6品、汁物の献立を4案提案します。8人の専門家が内部で検討し、家庭で作れる結論だけをお届けします。</p><div className="hero-guide"><span>1</span> 条件を選ぶ <i>→</i><span>2</span> 4案を比較 <i>→</i><span>3</span> レシピを確認</div></section>

    <section className="planner-form" aria-label="今日の夜ご飯の条件">
      <div className="form-heading"><div><p className="eyebrow">DINNER CONDITIONS</p><h2>5つの条件を選択</h2></div><p>予算は主食・基本調味料を含む全員分です</p></div>
      <div className="planner-fields">
        <fieldset><legend><b>01</b><span>人数</span><small>1〜6人</small></legend><div className="radio-grid dinner-six">{[1,2,3,4,5,6].map((value) => <label className={people === value ? "selected" : ""} key={value}><input type="radio" name="dinner-people" checked={people === value} onChange={() => setPeople(value)} /><span>{value}人</span></label>)}</div></fieldset>
        <fieldset><legend><b>02</b><span>構成</span><small>量の参考にのみ使用</small></legend><div className="radio-grid dinner-five">{genderOptions.map(([value,label]) => <label className={genderMix === value ? "selected" : ""} key={value}><input type="radio" name="dinner-gender" checked={genderMix === value} onChange={() => setGenderMix(value)} /><span>{label}</span></label>)}</div></fieldset>
        <fieldset className="genre-field"><legend><b>03</b><span>料理ジャンル</span><small>献立全体の方向性</small></legend><div className="radio-grid dinner-five">{cuisineOptions.map(([value,label]) => <label className={cuisine === value ? "selected" : ""} key={value}><input type="radio" name="dinner-cuisine" checked={cuisine === value} onChange={() => setCuisine(value)} /><span>{label}</span></label>)}</div></fieldset>
        <fieldset><legend><b>04</b><span>全員分の予算</span><small>スーパー小売価格で見積</small></legend><div className="price-input"><span>¥</span><input aria-label="夜ご飯の予算" inputMode="numeric" type="number" min="500" max="30000" step="100" value={budgetYen} onChange={(event) => setBudgetYen(Number(event.target.value))} /><em>円</em></div><div className="price-presets">{[1000,2000,3000].map((amount) => <button type="button" className={budgetYen === amount ? "selected" : ""} key={amount} onClick={() => setBudgetYen(amount)}>{amount.toLocaleString()}円</button>)}</div>{(budgetYen < 500 || budgetYen > 30000) && <p className="field-error">500〜30,000円で入力してください。</p>}</fieldset>
        <fieldset><legend><b>05</b><span>細かい指示</span><small>任意・500文字まで</small></legend><label className={`request-toggle ${requestEnabled ? "selected" : ""}`}><input type="checkbox" checked={requestEnabled} onChange={(event) => setRequestEnabled(event.target.checked)} /><span><b>希望を追加する</b><small>苦手食材、使いたい食材、調理時間など</small></span><i aria-hidden="true">✓</i></label>{requestEnabled && <div className="request-input dinner-request"><textarea aria-label="夜ご飯の細かい指示" maxLength={500} value={requestText} onChange={(event) => setRequestText(event.target.value)} placeholder="例：30分以内、辛さ控えめ、鶏むね肉を使いたい" /><small>{requestText.length}/500文字</small></div>}{requestEnabled && !requestText.trim() && <p className="field-error">細かい指示を入力するか、チェックを外してください。</p>}</fieldset>
      </div>
      <div className="condition-bar"><div><small>現在の条件</small><strong>{summary}</strong></div><button className="generate-button" type="button" disabled={!canGenerate || isGenerating || isDetailGenerating} onClick={generateCandidates}><span>{isGenerating ? "考案中…" : "今日の夜ご飯を考える"}</span><b>→</b></button></div>
      {(isGenerating || isDetailGenerating) && <div className="generation-progress" role="status"><div className="progress-top"><span className="progress-spinner" aria-hidden="true" /><div><b>{isGenerating ? "4つの献立を考えています" : "選んだ献立を詳しくしています"}</b><p>{elapsedSeconds < 25 ? "人数・予算・ジャンルを整理しています" : "8人の専門家が味・栄養・費用・安全を確認しています"}</p></div><time>{elapsedSeconds}秒</time></div><div className="progress-track"><i /></div></div>}
      {error && <div className="generation-error" role="alert"><b>生成できませんでした</b><p>{error}</p></div>}
      {sessionCostJpy > 0 && <p className="session-cost">今回のAPI費用概算: <b>{sessionCostJpy.toFixed(2)}円</b></p>}{costWarning && <p className="field-error">{costWarning}</p>}
    </section>

    {candidates.length > 0 && <section className="suggestions dinner-suggestions" ref={resultsRef}><div className="suggestion-heading"><div><p className="eyebrow">FOUR DINNER IDEAS</p><h2>今夜作れる4候補</h2></div><p>{conditions?.people}人・予算上限{conditions?.budgetYen.toLocaleString()}円</p></div><div className="home-suggestion-grid">{candidates.map((candidate,index) => <button type="button" className={`home-suggestion-card dinner-card ${selected?.id === candidate.id ? "selected" : ""}`} key={candidate.id} onClick={() => selectCandidate(candidate)} disabled={isDetailGenerating}><span className="candidate-number">0{index+1}</span><small>{dinnerCuisineLabels[candidate.cuisine]}</small><h3>{candidate.name}</h3><p>{candidate.tagline}</p><dl><div><dt>主菜</dt><dd>{candidate.mainDish}</dd></div><div><dt>副菜・汁物</dt><dd>{candidate.sideDishes.join("・")}／{candidate.soup}</dd></div><div><dt>調理時間</dt><dd>約{candidate.estimatedCookingMinutes}分</dd></div></dl><strong>食材見積 ¥{candidate.budgetPlan.totalEstimatedYen.toLocaleString()}<span>／ 残り ¥{candidate.budgetPlan.remainingYen.toLocaleString()}</span></strong></button>)}</div>{detailError && <div className="generation-error" role="alert"><b>詳細を生成できませんでした</b><p>{detailError}</p></div>}</section>}

    {detail && <section className="recipe-detail dinner-detail" ref={detailRef}><button type="button" className="back-to-results" onClick={() => resultsRef.current?.scrollIntoView({ behavior: "smooth" })}>← 4候補へ戻る</button><div className="detail-title"><p className="eyebrow">FAMILY DINNER RECIPE</p><h2>{detail.name}</h2><p>{detail.tagline}</p></div>
      <div className="design-grid"><article><b>味の設計</b><p>{detail.flavorDesign}</p></article><article><b>食感の設計</b><p>{detail.textureDesign}</p></article><article><b>栄養と量</b><p>{detail.nutritionBalance}</p></article></div>
      <div className="dinner-expert-panel"><p className="eyebrow">EIGHT-EXPERT CONSENSUS</p><h3>8人の専門家による統合結論</h3><p className="dinner-concept">{detail.expertConclusion.finalConcept}</p><div><article><b>味・食感</b><p>{detail.expertConclusion.tasteAndTexture}</p></article><article><b>栄養・分量</b><p>{detail.expertConclusion.nutritionAndPortion}</p></article><article><b>予算・買物</b><p>{detail.expertConclusion.budgetAndShopping}</p></article><article><b>段取り・安全</b><p>{detail.expertConclusion.workflowAndSafety}</p></article><article><b>料理文化</b><p>{detail.expertConclusion.culturalIntegrity}</p></article><article><b>最終判断</b><p>{detail.expertConclusion.finalDecision}</p></article></div></div>
      <div className="home-budget-panel dinner-budget-panel"><div><p className="eyebrow">HOUSEHOLD BUDGET</p><h3>{detail.people}人分の予算内訳</h3><strong>合計 ¥{detail.budgetPlan.totalEstimatedYen.toLocaleString()} / 上限 ¥{conditions?.budgetYen.toLocaleString()}</strong></div><dl><div><dt>主菜</dt><dd>¥{detail.budgetPlan.mainDishYen.toLocaleString()}</dd></div><div><dt>副菜</dt><dd>¥{detail.budgetPlan.sideDishesYen.toLocaleString()}</dd></div><div><dt>汁物・主食・調味料</dt><dd>¥{detail.budgetPlan.soupAndStaplesYen.toLocaleString()}</dd></div><div><dt>予算残り</dt><dd>¥{detail.budgetPlan.remainingYen.toLocaleString()}</dd></div></dl><ul>{detail.shoppingTips.map((tip) => <li key={tip}>{tip}</li>)}</ul></div>
      <div className="family-fit-panel dinner-schedule"><h3>同時調理の段取り（約{detail.cookingSchedule.totalMinutes}分）</h3><ol>{detail.cookingSchedule.parallelSteps.map((step) => <li key={step}>{step}</li>)}</ol><p>{detail.servingPlan}</p></div>
      <p className="recipe-unit">材料はすべて <b>{detail.people}人分</b> です</p><div className="recipe-parts">{detail.recipes.map((part,index) => <article key={`${part.role}-${part.name}`}><header><span>0{index+1}</span><div><small>{roleLabels[part.role]}</small><h3>{part.name}</h3></div></header><div><section><h4>材料</h4><ul>{part.ingredients.map((item) => <li key={item}>{item}</li>)}</ul></section><section><h4>作り方</h4><ol>{part.steps.map((step) => <li key={step}>{step}</li>)}</ol></section></div></article>)}</div>
      <div className="safety-note"><b>安全とアレルゲン</b><p>{detail.safety}</p><p>想定アレルゲン: {detail.allergens.length ? detail.allergens.join("・") : "特になし（使用商品の表示を要確認）"}</p></div>
    </section>}
  </main>;
}
