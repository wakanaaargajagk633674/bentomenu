"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChefQualityPanel } from "@/app/components/chef-quality-panel";
import type { ApiCostRecord } from "@/lib/ai/api-cost";
import type { HomeBentoCandidate, HomeBentoRequest, HomeBentoSuggestion } from "@/lib/ai/home-bento-schema";
import { readImageCostHeaders, recordApiUsage } from "@/lib/api-usage";
import { HomeBentoAgeGroup, HomeBentoGender, homeBentoAgeLabels, homeBentoGenderLabels } from "@/lib/home-bento-data";
import { attachSavedMenuImage, createSavedMenu, markSavedMenuImageFailed } from "@/lib/saved-menus";
import { MealSeason, mealSeasonLabels } from "@/lib/season-data";

const ageOptions = Object.entries(homeBentoAgeLabels) as Array<[HomeBentoAgeGroup, string]>;
const genderOptions = Object.entries(homeBentoGenderLabels) as Array<[HomeBentoGender, string]>;
const seasonOptions = Object.entries(mealSeasonLabels) as Array<[MealSeason, string]>;
type HomeBentoDetail = HomeBentoSuggestion & { imageToken: string };
type PhotoState = { status: "idle" | "generating" | "ready" | "failed"; url?: string; error?: string };
type SaveState = { status: "idle" | "saving" | "image" | "saved" | "failed"; error?: string };

export default function HomeBentoPage() {
  const [ageGroup, setAgeGroup] = useState<HomeBentoAgeGroup>("elementary-high");
  const [gender, setGender] = useState<HomeBentoGender>("all");
  const [largePortion, setLargePortion] = useState(false);
  const [budgetYen, setBudgetYen] = useState(500);
  const [season, setSeason] = useState<MealSeason>("auto");
  const [candidates, setCandidates] = useState<HomeBentoCandidate[]>([]);
  const [conditions, setConditions] = useState<HomeBentoRequest | null>(null);
  const [selected, setSelected] = useState<HomeBentoCandidate | null>(null);
  const [detail, setDetail] = useState<HomeBentoDetail | null>(null);
  const [photo, setPhoto] = useState<PhotoState>({ status: "idle" });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDetailGenerating, setIsDetailGenerating] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [sessionCostJpy, setSessionCostJpy] = useState(0);
  const [costWarning, setCostWarning] = useState("");
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });
  const resultsRef = useRef<HTMLElement>(null);
  const detailRef = useRef<HTMLElement>(null);
  const requestAbortRef = useRef<AbortController | null>(null);
  const photoAbortRef = useRef<AbortController | null>(null);
  const photoUrlRef = useRef<string | null>(null);
  const savedIdRef = useRef<string | null>(null);
  const canGenerate = budgetYen >= 100 && budgetYen <= 3000;

  useEffect(() => {
    if (!isGenerating && !isDetailGenerating) return;
    const timer = window.setInterval(() => setElapsedSeconds((current) => current + 1), 1000);
    return () => window.clearInterval(timer);
  }, [isGenerating, isDetailGenerating]);

  useEffect(() => () => {
    requestAbortRef.current?.abort();
    photoAbortRef.current?.abort();
    if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
  }, []);

  useEffect(() => {
    if (candidates.length) resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [candidates]);

  useEffect(() => {
    if (detail) detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [detail]);

  const summary = useMemo(() => `${homeBentoAgeLabels[ageGroup]}・${homeBentoGenderLabels[gender]}・${largePortion ? "量多め" : "標準量"}・${mealSeasonLabels[season]}・予算${budgetYen.toLocaleString()}円`, [ageGroup, gender, largePortion, season, budgetYen]);

  const saveCost = async (cost?: ApiCostRecord | null) => {
    if (!cost) return;
    setSessionCostJpy((current) => current + cost.estimatedCostJpy);
    try {
      await recordApiUsage(cost);
    } catch {
      setCostWarning("費用は計算できましたが、履歴への保存に失敗しました。");
    }
  };

  const clearPhoto = () => {
    photoAbortRef.current?.abort();
    photoAbortRef.current = null;
    if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
    photoUrlRef.current = null;
    setPhoto({ status: "idle" });
  };

  const generatePhoto = async (suggestion: HomeBentoDetail, signal?: AbortSignal) => {
    setPhoto({ status: "generating" });
    try {
      const response = await fetch("/api/home-bento/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestion, imageToken: suggestion.imageToken }),
        signal,
      });
      if (!response.ok) {
        const data = (response.headers.get("content-type") || "").includes("application/json") ? await response.json() : null;
        throw new Error(typeof data?.error === "string" ? data.error : "家庭用弁当の写真を生成できませんでした。");
      }
      await saveCost(readImageCostHeaders(response.headers, "bento"));
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
      photoUrlRef.current = url;
      setPhoto({ status: "ready", url });
      if (savedIdRef.current) {
        try {
          await attachSavedMenuImage(savedIdRef.current, blob);
          setSaveState({ status: "saved" });
        } catch {
          await markSavedMenuImageFailed(savedIdRef.current);
          setSaveState({ status: "failed", error: "レシピは保存済みですが、画像の保存に失敗しました。再試行してください。" });
        }
      }
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setPhoto({ status: "failed", error: caught instanceof Error ? caught.message : "家庭用弁当の写真を生成できませんでした。" });
      if (savedIdRef.current) {
        await markSavedMenuImageFailed(savedIdRef.current);
        setSaveState({ status: "failed", error: "レシピは保存済みです。写真を再試行すると保存も再開します。" });
      }
    }
  };

  const generateCandidates = async () => {
    if (!canGenerate) return;
    requestAbortRef.current?.abort();
    const controller = new AbortController();
    requestAbortRef.current = controller;
    const submitted: HomeBentoRequest = { ageGroup, gender, largePortion, budgetYen, season };
    setElapsedSeconds(0);
    setIsGenerating(true);
    setError("");
    setDetailError("");
    setCandidates([]);
    setConditions(null);
    setSelected(null);
    setDetail(null);
    setSaveState({ status: "idle" });
    savedIdRef.current = null;
    clearPhoto();
    try {
      const response = await fetch("/api/home-bento/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitted),
        signal: controller.signal,
      });
      const data = (response.headers.get("content-type") || "").includes("application/json") ? await response.json() : { error: await response.text() };
      if (!response.ok || !Array.isArray(data.suggestions)) throw new Error(typeof data.error === "string" ? data.error : "家庭用弁当の候補を生成できませんでした。");
      await saveCost(data.usageCost as ApiCostRecord | undefined);
      setCandidates(data.suggestions as HomeBentoCandidate[]);
      setConditions(submitted);
    } catch (caught) {
      if (!(caught instanceof DOMException && caught.name === "AbortError")) setError(caught instanceof Error ? caught.message : "家庭用弁当の候補を生成できませんでした。");
    } finally {
      if (requestAbortRef.current === controller) requestAbortRef.current = null;
      setIsGenerating(false);
    }
  };

  const selectCandidate = async (candidate: HomeBentoCandidate) => {
    if (!conditions || isDetailGenerating) return;
    requestAbortRef.current?.abort();
    const controller = new AbortController();
    requestAbortRef.current = controller;
    setElapsedSeconds(0);
    setSelected(candidate);
    setDetail(null);
    setSaveState({ status: "idle" });
    savedIdRef.current = null;
    setDetailError("");
    setIsDetailGenerating(true);
    clearPhoto();
    try {
      const response = await fetch("/api/home-bento/detail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conditions, candidate }),
        signal: controller.signal,
      });
      const data = (response.headers.get("content-type") || "").includes("application/json") ? await response.json() : { error: await response.text() };
      if (!response.ok || !data.suggestion) throw new Error(typeof data.error === "string" ? data.error : "家庭用弁当の詳細を生成できませんでした。");
      await saveCost(data.usageCost as ApiCostRecord | undefined);
      const completed = data.suggestion as HomeBentoDetail;
      setDetail(completed);
      const photoController = new AbortController();
      photoAbortRef.current = photoController;
      void generatePhoto(completed, photoController.signal).finally(() => {
        if (photoAbortRef.current === photoController) photoAbortRef.current = null;
      });
    } catch (caught) {
      if (!(caught instanceof DOMException && caught.name === "AbortError")) setDetailError(caught instanceof Error ? caught.message : "家庭用弁当の詳細を生成できませんでした。");
    } finally {
      if (requestAbortRef.current === controller) requestAbortRef.current = null;
      setIsDetailGenerating(false);
    }
  };

  const saveHomeBento = async (suggestion: HomeBentoDetail) => {
    if (["saving", "image", "saved"].includes(saveState.status)) return;
    setSaveState({ status: "saving" });
    try {
      const saved = await createSavedMenu("home_bento", { ...suggestion, id: crypto.randomUUID(), sourceCandidateId: suggestion.id } as unknown as Record<string, unknown>);
      savedIdRef.current = saved.id;
      if (saved.image_status === "ready") {
        setSaveState({ status: "saved" });
        return;
      }
      setSaveState({ status: "image" });
      if (photo.status === "ready" && photo.url) {
        await attachSavedMenuImage(saved.id, await (await fetch(photo.url)).blob());
        setSaveState({ status: "saved" });
      } else if (photo.status === "failed") {
        void generatePhoto(suggestion);
      }
    } catch {
      setSaveState({ status: "failed", error: "保存できませんでした。通信状態を確認して再試行してください。" });
    }
  };

  return <main className="planner-page home-bento-planner">
    <header className="planner-header"><Link className="back" href="/">← トップへ戻る</Link><div><Link className="library-link" href="/usage">API費用</Link> <Link className="library-link" href="/saved">保存したメニュー</Link></div></header>
    <section className="planner-hero home-bento-hero">
      <p className="eyebrow">FAMILY BENTO PLANNER</p>
      <h1>家族に合わせる、<br />毎日の家庭弁当。</h1>
      <p>年齢・性別・食べる量・季節・1食予算から、家庭の台所で無理なく作れる4案を提案。冷めてもおいしく、安全で、家庭用弁当箱にきれいに収まるレシピと写真を作ります。</p>
      <div className="hero-guide"><span>1</span> 条件を選ぶ <i>→</i><span>2</span> 4案を比較 <i>→</i><span>3</span> レシピと家庭用写真</div>
    </section>

    <section className="planner-form" aria-label="家庭用弁当の条件">
      <div className="form-heading"><div><p className="eyebrow">FAMILY CONDITIONS</p><h2>5つの条件を選択</h2></div><p>販売価格や利益ではなく、1食分の食材予算で考えます</p></div>
      <div className="planner-fields">
        <fieldset className="home-age-field"><legend><b>01</b><span>対象年齢</span><small>食べる量と一口サイズに反映</small></legend><div className="home-age-grid">{ageOptions.map(([value, label]) => <label className={ageGroup === value ? "selected" : ""} key={value}><input type="radio" name="home-age" checked={ageGroup === value} onChange={() => setAgeGroup(value)} /><span>{label}</span></label>)}</div></fieldset>
        <fieldset><legend><b>02</b><span>性別</span><small>固定観念ではなく食べやすさの参考</small></legend><div className="radio-grid three">{genderOptions.map(([value, label]) => <label className={gender === value ? "selected" : ""} key={value}><input type="radio" name="home-gender" checked={gender === value} onChange={() => setGender(value)} /><span>{label}</span></label>)}</div></fieldset>
        <fieldset><legend><b>03</b><span>食べる量</span><small>主食・主菜・副菜を均等に調整</small></legend><label className={`request-toggle ${largePortion ? "selected" : ""}`}><input type="checkbox" checked={largePortion} onChange={(event) => setLargePortion(event.target.checked)} /><span><b>量多めにする</b><small>年齢の標準量から全体を約20〜30%増やします</small></span><i aria-hidden="true">✓</i></label></fieldset>
        <fieldset className="genre-field"><legend><b>04</b><span>季節</span><small>旬・色・香り・安全性に反映</small></legend><div className="radio-grid dinner-five">{seasonOptions.map(([value, label]) => <label className={season === value ? "selected" : ""} key={value}><input type="radio" name="home-season" checked={season === value} onChange={() => setSeason(value)} /><span>{label}</span></label>)}</div></fieldset>
        <fieldset><legend><b>05</b><span>1食分の予算</span><small>主食・少量の調味料を含む</small></legend><div className="price-input"><span>¥</span><input aria-label="家庭用弁当の予算" inputMode="numeric" type="number" min="100" max="3000" step="10" value={budgetYen} onChange={(event) => setBudgetYen(Number(event.target.value))} /><em>円</em></div><div className="price-presets">{[300, 500, 700].map((amount) => <button type="button" className={budgetYen === amount ? "selected" : ""} key={amount} onClick={() => setBudgetYen(amount)}>{amount}円</button>)}</div>{!canGenerate && <p className="field-error">100〜3,000円で入力してください。</p>}</fieldset>
      </div>
      <div className="condition-bar"><div><small>現在の条件</small><strong>{summary}</strong></div><button className="generate-button" type="button" disabled={!canGenerate || isGenerating || isDetailGenerating} onClick={generateCandidates}><span>{isGenerating ? "考案中…" : "家庭用弁当を考える"}</span><b>→</b></button></div>
      {(isGenerating || isDetailGenerating) && <div className="generation-progress" role="status"><div className="progress-top"><span className="progress-spinner" aria-hidden="true" /><div><b>{isGenerating ? "4つの家庭弁当を考えています" : "選んだ弁当を詳しくしています"}</b><p>{elapsedSeconds < 25 ? "年齢・量・予算を読み取っています" : "冷めた味、朝の段取り、安全性を確認しています"}</p></div><time>{elapsedSeconds}秒</time></div><div className="progress-track"><i /></div></div>}
      {error && <div className="generation-error" role="alert"><b>生成できませんでした</b><p>{error}</p></div>}
      {sessionCostJpy > 0 && <p className="session-cost">今回のAPI費用概算: <b>{sessionCostJpy.toFixed(2)}円</b></p>}{costWarning && <p className="field-error">{costWarning}</p>}
    </section>

    {candidates.length > 0 && <section className="suggestions home-suggestions" ref={resultsRef}><div className="suggestion-heading"><div><p className="eyebrow">FOUR FAMILY IDEAS</p><h2>家庭で作れる4候補</h2></div><p>{homeBentoAgeLabels[conditions?.ageGroup ?? ageGroup]}・{mealSeasonLabels[candidates[0]?.season ?? "spring"]}・予算上限{conditions?.budgetYen.toLocaleString()}円</p></div><div className="home-suggestion-grid">{candidates.map((candidate, index) => <button type="button" className={`home-suggestion-card ${selected?.id === candidate.id ? "selected" : ""}`} key={candidate.id} onClick={() => selectCandidate(candidate)} disabled={isDetailGenerating}><span className="candidate-number">0{index + 1}</span><small>HOMEMADE BENTO・{mealSeasonLabels[candidate.season]}</small><h3>{candidate.name}</h3><p>{candidate.tagline}</p><dl><div><dt>内容</dt><dd>{candidate.contents.join("・")}</dd></div><div><dt>季節設計</dt><dd>{candidate.seasonalDesign}</dd></div><div><dt>量</dt><dd>{candidate.portionPlan}</dd></div></dl><strong>食材見積 ¥{candidate.budgetPlan.totalEstimatedYen.toLocaleString()}<span>／ 残り ¥{candidate.budgetPlan.remainingYen.toLocaleString()}</span></strong></button>)}</div>{detailError && <div className="generation-error" role="alert"><b>詳細を生成できませんでした</b><p>{detailError}</p></div>}</section>}

    {detail && <section className="recipe-detail" ref={detailRef}><button type="button" className="back-to-results" onClick={() => resultsRef.current?.scrollIntoView({ behavior: "smooth" })}>← 4候補へ戻る</button><div className="detail-title"><p className="eyebrow">FAMILY BENTO RECIPE</p><h2>{detail.name}</h2><p>{detail.tagline}</p></div><button type="button" className={`save-menu-button detail-save ${saveState.status === "saved" ? "saved" : saveState.status === "failed" ? "failed" : ""}`} disabled={["saving", "image", "saved"].includes(saveState.status)} onClick={() => void saveHomeBento(detail)}>{saveState.status === "saving" ? "レシピを保存中…" : saveState.status === "image" ? "レシピ保存済み・画像を保存中…" : saveState.status === "saved" ? "保存しました ✓" : saveState.status === "failed" ? "保存を再試行" : "このレシピを保存"}</button>{saveState.error && <p className="save-status" role="alert">{saveState.error}</p>}
      <div className="detail-photo">{photo.status === "ready" && photo.url ? <div className="detail-photo-frame"><Image src={photo.url} alt={`${homeBentoAgeLabels[detail.targetAgeGroup]}向け家庭用弁当「${detail.name}」の完成イメージ`} fill unoptimized sizes="(max-width: 900px) 100vw, 860px" /></div> : <div className="photo-placeholder">{photo.status === "generating" ? <><span /><b>家庭用弁当箱の写真を生成中</b><small>年齢に合う容器と一口サイズで再現しています</small></> : <><b>写真を生成できませんでした</b><small>{photo.error}</small><button type="button" onClick={() => void generatePhoto(detail)}>写真だけ再試行</button></>}</div>}<p>写真は家庭用弁当箱への詰め方の参考です。調理時はレシピの加熱・冷却・保冷を優先してください。</p></div>
      <div className="design-grid"><article><b>味の設計</b><p>{detail.flavor}</p></article><article><b>食感の設計</b><p>{detail.texture}</p></article><article><b>{mealSeasonLabels[detail.season]}の季節設計</b><p>{detail.seasonalDesign}</p></article><article><b>対象に合わせた量</b><p>{detail.familyFit.ageAndGenderConsideration}</p><p>{detail.familyFit.largePortionAdjustment}</p></article></div>
      <ChefQualityPanel review={detail.qualityReview} />
      <div className="home-budget-panel"><div><p className="eyebrow">HOUSEHOLD BUDGET</p><h3>1食分の予算内訳</h3><strong>合計 ¥{detail.budgetPlan.totalEstimatedYen.toLocaleString()} / 上限 ¥{detail.budgetYen.toLocaleString()}</strong></div><dl><div><dt>主材料</dt><dd>¥{detail.budgetPlan.mainIngredientsYen.toLocaleString()}</dd></div><div><dt>野菜・副菜</dt><dd>¥{detail.budgetPlan.vegetablesAndSidesYen.toLocaleString()}</dd></div><div><dt>主食・調味料</dt><dd>¥{detail.budgetPlan.staplesAndSeasoningsYen.toLocaleString()}</dd></div><div><dt>予算残り</dt><dd>¥{detail.budgetPlan.remainingYen.toLocaleString()}</dd></div></dl><ul>{detail.shoppingTips.map((tip) => <li key={tip}>{tip}</li>)}</ul></div>
      <div className="family-fit-panel"><h3>量と食べやすさ</h3><p>総量 {detail.familyFit.totalPortionGrams}g（主食 {detail.familyFit.stapleGrams}g・主菜 {detail.familyFit.mainDishGrams}g・副菜 {detail.familyFit.sideDishGrams}g）</p><p>{detail.familyFit.biteSizeGuidance}</p><p>{detail.familyFit.nutritionBalance}</p></div>
      <p className="recipe-unit">材料はすべて <b>1人分</b> です</p><div className="recipe-parts">{detail.recipes.map((part, index) => <article key={part.name}><header><span>0{index + 1}</span><h3>{part.name}</h3></header><div><section><h4>材料</h4><ul>{part.ingredients.map((item) => <li key={item}>{item}</li>)}</ul></section><section><h4>作り方</h4><ol>{part.steps.map((step) => <li key={step}>{step}</li>)}</ol></section></div></article>)}</div><div className="safety-note"><b>家庭弁当の安全ポイント</b><p>{detail.safety}</p></div>
    </section>}
  </main>;
}
