"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ApiCostRecord } from "@/lib/ai/api-cost";
import type { DinnerCandidate, DinnerRequest, DinnerSuggestion } from "@/lib/ai/dinner-schema";
import { readImageCostHeaders, recordApiUsage } from "@/lib/api-usage";
import { DinnerCuisine, DinnerGenderMix, dinnerCuisineLabels, dinnerGenderLabels } from "@/lib/dinner-menu-data";
import { attachSavedMenuImage, createSavedMenu, markSavedMenuImageFailed } from "@/lib/saved-menus";
import { MealSeason, mealSeasonLabels } from "@/lib/season-data";
import { DINNER_CLIENT_VERSION } from "@/lib/dinner-client-version";

const genderOptions = Object.entries(dinnerGenderLabels) as Array<[DinnerGenderMix, string]>;
const cuisineOptions = Object.entries(dinnerCuisineLabels) as Array<[DinnerCuisine, string]>;
const seasonOptions = Object.entries(mealSeasonLabels) as Array<[MealSeason, string]>;
const roleLabels = { main: "主菜", side: "副菜", soup: "汁物" } as const;
type DinnerDetail = DinnerSuggestion & { imageToken: string };
type PhotoState = { status: "idle" | "generating" | "ready" | "failed"; url?: string; error?: string };
type SaveState = { status: "idle" | "saving" | "image" | "saved" | "failed"; error?: string };

export default function DinnerPage() {
  const [people, setPeople] = useState(2);
  const [genderMix, setGenderMix] = useState<DinnerGenderMix>("balanced");
  const [cuisine, setCuisine] = useState<DinnerCuisine>("japanese");
  const [budgetYen, setBudgetYen] = useState(2000);
  const [season, setSeason] = useState<MealSeason>("auto");
  const [requestEnabled, setRequestEnabled] = useState(false);
  const [requestText, setRequestText] = useState("");
  const [candidates, setCandidates] = useState<DinnerCandidate[]>([]);
  const [conditions, setConditions] = useState<DinnerRequest | null>(null);
  const [selected, setSelected] = useState<DinnerCandidate | null>(null);
  const [detail, setDetail] = useState<DinnerDetail | null>(null);
  const [photo, setPhoto] = useState<PhotoState>({ status: "idle" });
  const [photoElapsedSeconds, setPhotoElapsedSeconds] = useState(0);
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
  const photoRef = useRef<HTMLDivElement>(null);
  const requestAbortRef = useRef<AbortController | null>(null);
  const photoAbortRef = useRef<AbortController | null>(null);
  const photoUrlRef = useRef<string | null>(null);
  const savedIdRef = useRef<string | null>(null);
  const canGenerate = budgetYen >= 500 && budgetYen <= 30000 && (!requestEnabled || requestText.trim().length > 0) && requestText.length <= 500;

  useEffect(() => {
    if (!isGenerating && !isDetailGenerating) return;
    const timer = window.setInterval(() => setElapsedSeconds((current) => current + 1), 1000);
    return () => window.clearInterval(timer);
  }, [isGenerating, isDetailGenerating]);

  useEffect(() => {
    if (photo.status !== "generating") return;
    const timer = window.setInterval(() => setPhotoElapsedSeconds((current) => current + 1), 1000);
    return () => window.clearInterval(timer);
  }, [photo.status]);

  useEffect(() => () => {
    requestAbortRef.current?.abort();
    photoAbortRef.current?.abort();
    if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
  }, []);
  useEffect(() => { if (candidates.length) resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [candidates]);
  useEffect(() => { if (detail) detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [detail]);

  const summary = useMemo(() => `${people}人・${dinnerGenderLabels[genderMix]}・${dinnerCuisineLabels[cuisine]}・${mealSeasonLabels[season]}・予算${budgetYen.toLocaleString()}円`, [people, genderMix, cuisine, season, budgetYen]);

  const saveCost = async (cost?: ApiCostRecord) => {
    if (!cost) return;
    setSessionCostJpy((current) => current + cost.estimatedCostJpy);
    try { await recordApiUsage(cost); } catch { setCostWarning("費用は計算できましたが、履歴への保存に失敗しました。"); }
  };

  const clearPhoto = () => {
    photoAbortRef.current?.abort();
    photoAbortRef.current = null;
    if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
    photoUrlRef.current = null;
    setPhotoElapsedSeconds(0);
    setPhoto({ status: "idle" });
  };

  const generatePhoto = async (suggestion: DinnerDetail, signal?: AbortSignal) => {
    setPhotoElapsedSeconds(0);
    setPhoto({ status: "generating" });
    try {
      const response = await fetch("/api/dinner/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestion, imageToken: suggestion.imageToken }),
        signal,
      });
      if (!response.ok) {
        const data = (response.headers.get("content-type") || "").includes("application/json") ? await response.json() : null;
        throw new Error(typeof data?.error === "string" ? data.error : "夜ご飯の写真を生成できませんでした。");
      }
      await saveCost(readImageCostHeaders(response.headers, "dinner") ?? undefined);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
      photoUrlRef.current = url;
      setPhoto({ status: "ready", url });
      window.requestAnimationFrame(() => photoRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
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
      if (caught instanceof DOMException && caught.name === "AbortError") {
        setPhoto({ status: "idle" });
        return;
      }
      setPhoto({ status: "failed", error: caught instanceof Error ? caught.message : "夜ご飯の写真を生成できませんでした。" });
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
    const submitted: DinnerRequest = { people, genderMix, cuisine, budgetYen, season, requestEnabled, requestText: requestEnabled ? requestText.trim() : "" };
    setElapsedSeconds(0); setIsGenerating(true); setError(""); setDetailError(""); setCandidates([]); setConditions(null); setSelected(null); setDetail(null); setSaveState({ status: "idle" });
    savedIdRef.current = null;
    clearPhoto();
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
    if (!conditions || isDetailGenerating || photo.status === "generating") return;
    requestAbortRef.current?.abort();
    const controller = new AbortController();
    requestAbortRef.current = controller;
    setElapsedSeconds(0); setSelected(candidate); setDetail(null); setDetailError(""); setIsDetailGenerating(true); setSaveState({ status: "idle" });
    savedIdRef.current = null;
    clearPhoto();
    try {
      const response = await fetch("/api/dinner/detail", { method: "POST", headers: { "Content-Type": "application/json", "X-Dinner-Client-Version": DINNER_CLIENT_VERSION }, body: JSON.stringify({ conditions, candidate }), signal: controller.signal });
      const data = (response.headers.get("content-type") || "").includes("application/json") ? await response.json() : { error: await response.text() };
      if (!response.ok || !data.suggestion) throw new Error(typeof data.error === "string" ? data.error : "夜ご飯の詳細を生成できませんでした。");
      await saveCost(data.usageCost as ApiCostRecord | undefined);
      const completed = data.suggestion as DinnerDetail;
      setDetail(completed);
      const photoController = new AbortController();
      photoAbortRef.current = photoController;
      void generatePhoto(completed, photoController.signal).finally(() => {
        if (photoAbortRef.current === photoController) photoAbortRef.current = null;
      });
    } catch (caught) {
      if (!(caught instanceof DOMException && caught.name === "AbortError")) setDetailError(caught instanceof Error ? caught.message : "夜ご飯の詳細を生成できませんでした。");
    } finally {
      if (requestAbortRef.current === controller) requestAbortRef.current = null;
      setIsDetailGenerating(false);
    }
  };

  const saveDinner = async (suggestion: DinnerDetail) => {
    if (["saving", "image", "saved"].includes(saveState.status)) return;
    if (savedIdRef.current && saveState.status === "failed") {
      setSaveState({ status: "image" });
      void generatePhoto(suggestion);
      return;
    }
    setSaveState({ status: "saving" });
    try {
      const saved = await createSavedMenu("dinner", { ...suggestion, id: crypto.randomUUID(), sourceCandidateId: suggestion.id } as unknown as Record<string, unknown>);
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

  return <main className="planner-page dinner-planner">
    <header className="planner-header"><Link className="back" href="/">← トップへ戻る</Link><div><Link className="library-link" href="/usage">API費用</Link> <Link className="library-link" href="/saved">保存したメニュー</Link></div></header>
    <section className="planner-hero dinner-hero"><p className="eyebrow">FAMILY DINNER PLANNER</p><h1>今日の夜ご飯を、<br />家族にちょうどよく。</h1><p>人数・構成・料理ジャンル・季節・全員分の予算から、主菜、副菜2〜6品、汁物の献立を4案提案します。8人の専門家が内部で検討し、家庭で作れるレシピと食卓写真をお届けします。</p><div className="hero-guide"><span>1</span> 条件を選ぶ <i>→</i><span>2</span> 4案を比較 <i>→</i><span>3</span> レシピと写真</div></section>

    <section className="planner-form" aria-label="今日の夜ご飯の条件">
      <div className="form-heading"><div><p className="eyebrow">DINNER CONDITIONS</p><h2>6つの条件を選択</h2></div><p>予算は主食・基本調味料を含む全員分です</p></div>
      <div className="planner-fields">
        <fieldset><legend><b>01</b><span>人数</span><small>1〜6人</small></legend><div className="radio-grid dinner-six">{[1,2,3,4,5,6].map((value) => <label className={people === value ? "selected" : ""} key={value}><input type="radio" name="dinner-people" checked={people === value} onChange={() => setPeople(value)} /><span>{value}人</span></label>)}</div></fieldset>
        <fieldset><legend><b>02</b><span>構成</span><small>量の参考にのみ使用</small></legend><div className="radio-grid dinner-five">{genderOptions.map(([value,label]) => <label className={genderMix === value ? "selected" : ""} key={value}><input type="radio" name="dinner-gender" checked={genderMix === value} onChange={() => setGenderMix(value)} /><span>{label}</span></label>)}</div></fieldset>
        <fieldset className="genre-field"><legend><b>03</b><span>料理ジャンル</span><small>献立全体の方向性</small></legend><div className="radio-grid dinner-five">{cuisineOptions.map(([value,label]) => <label className={cuisine === value ? "selected" : ""} key={value}><input type="radio" name="dinner-cuisine" checked={cuisine === value} onChange={() => setCuisine(value)} /><span>{label}</span></label>)}</div></fieldset>
        <fieldset className="genre-field"><legend><b>04</b><span>季節</span><small>旬・気候・香り・温度に反映</small></legend><div className="radio-grid dinner-five">{seasonOptions.map(([value,label]) => <label className={season === value ? "selected" : ""} key={value}><input type="radio" name="dinner-season" checked={season === value} onChange={() => setSeason(value)} /><span>{label}</span></label>)}</div></fieldset>
        <fieldset><legend><b>05</b><span>全員分の予算</span><small>スーパー小売価格で見積</small></legend><div className="price-input"><span>¥</span><input aria-label="夜ご飯の予算" inputMode="numeric" type="number" min="500" max="30000" step="100" value={budgetYen} onChange={(event) => setBudgetYen(Number(event.target.value))} /><em>円</em></div><div className="price-presets">{[1000,2000,3000].map((amount) => <button type="button" className={budgetYen === amount ? "selected" : ""} key={amount} onClick={() => setBudgetYen(amount)}>{amount.toLocaleString()}円</button>)}</div>{(budgetYen < 500 || budgetYen > 30000) && <p className="field-error">500〜30,000円で入力してください。</p>}</fieldset>
        <fieldset><legend><b>06</b><span>細かい指示</span><small>任意・500文字まで</small></legend><label className={`request-toggle ${requestEnabled ? "selected" : ""}`}><input type="checkbox" checked={requestEnabled} onChange={(event) => setRequestEnabled(event.target.checked)} /><span><b>希望を追加する</b><small>苦手食材、使いたい食材、調理時間など</small></span><i aria-hidden="true">✓</i></label>{requestEnabled && <div className="request-input dinner-request"><textarea aria-label="夜ご飯の細かい指示" maxLength={500} value={requestText} onChange={(event) => setRequestText(event.target.value)} placeholder="例：30分以内、辛さ控えめ、鶏むね肉を使いたい" /><small>{requestText.length}/500文字</small></div>}{requestEnabled && !requestText.trim() && <p className="field-error">細かい指示を入力するか、チェックを外してください。</p>}</fieldset>
      </div>
      <div className="condition-bar"><div><small>現在の条件</small><strong>{summary}</strong></div><button className="generate-button" type="button" disabled={!canGenerate || isGenerating || isDetailGenerating || photo.status === "generating"} onClick={generateCandidates}><span>{isGenerating ? "考案中…" : photo.status === "generating" ? "写真の完成を待っています" : "今日の夜ご飯を考える"}</span><b>→</b></button></div>
      {(isGenerating || isDetailGenerating) && <div className="generation-progress" role="status"><div className="progress-top"><span className="progress-spinner" aria-hidden="true" /><div><b>{isGenerating ? "4つの献立を考えています" : "選んだ献立を詳しくしています"}</b><p>{elapsedSeconds < 25 ? "人数・予算・ジャンルを整理しています" : "8人の専門家が味・栄養・費用・安全を確認しています"}</p></div><time>{elapsedSeconds}秒</time></div><div className="progress-track"><i /></div></div>}
      {error && <div className="generation-error" role="alert"><b>生成できませんでした</b><p>{error}</p></div>}
      {sessionCostJpy > 0 && <p className="session-cost">今回のAPI費用概算: <b>{sessionCostJpy.toFixed(2)}円</b></p>}{costWarning && <p className="field-error">{costWarning}</p>}
    </section>

    {candidates.length > 0 && <section className="suggestions dinner-suggestions" ref={resultsRef}><div className="suggestion-heading"><div><p className="eyebrow">FOUR DINNER IDEAS</p><h2>今夜作れる4候補</h2></div><p>{conditions?.people}人・{mealSeasonLabels[candidates[0]?.season ?? "spring"]}・予算上限{conditions?.budgetYen.toLocaleString()}円</p></div><div className="home-suggestion-grid">{candidates.map((candidate,index) => <button type="button" className={`home-suggestion-card dinner-card ${selected?.id === candidate.id ? "selected" : ""}`} key={candidate.id} onClick={() => selectCandidate(candidate)} disabled={isDetailGenerating || photo.status === "generating"}><span className="candidate-number">0{index+1}</span><small>{dinnerCuisineLabels[candidate.cuisine]}・{mealSeasonLabels[candidate.season]}</small><h3>{candidate.name}</h3><p>{candidate.tagline}</p><dl><div><dt>主菜</dt><dd>{candidate.mainDish}</dd></div><div><dt>副菜・汁物</dt><dd>{candidate.sideDishes.join("・")}／{candidate.soup}</dd></div><div><dt>季節設計</dt><dd>{candidate.seasonalDesign}</dd></div><div><dt>調理時間</dt><dd>約{candidate.estimatedCookingMinutes}分</dd></div></dl><strong>食材見積 ¥{candidate.budgetPlan.totalEstimatedYen.toLocaleString()}<span>／ 残り ¥{candidate.budgetPlan.remainingYen.toLocaleString()}</span></strong></button>)}</div>{detailError && <div className="generation-error" role="alert"><b>詳細を生成できませんでした</b><p>{detailError}</p></div>}</section>}

    {detail && <section className="recipe-detail dinner-detail" ref={detailRef}><button type="button" className="back-to-results" onClick={() => resultsRef.current?.scrollIntoView({ behavior: "smooth" })}>← 4候補へ戻る</button><div className="detail-title"><p className="eyebrow">FAMILY DINNER RECIPE</p><h2>{detail.name}</h2><p>{detail.tagline}</p></div><button type="button" className={`save-menu-button detail-save ${saveState.status === "saved" ? "saved" : saveState.status === "failed" ? "failed" : ""}`} disabled={["saving", "image", "saved"].includes(saveState.status)} onClick={() => void saveDinner(detail)}>{saveState.status === "saving" ? "レシピを保存中…" : saveState.status === "image" ? "レシピ保存済み・画像を保存中…" : saveState.status === "saved" ? "保存しました ✓" : saveState.status === "failed" ? "保存を再試行" : "このレシピを保存"}</button>{saveState.error && <p className="save-status" role="alert">{saveState.error}</p>}
      <div className="detail-photo" ref={photoRef}>{photo.status === "ready" && photo.url ? <div className="detail-photo-frame"><Image src={photo.url} alt={`${detail.people}人分の夜ご飯「${detail.name}」の食卓完成イメージ`} fill unoptimized sizes="(max-width: 900px) 100vw, 860px" onError={() => setPhoto({ status: "failed", error: "生成した写真を画面へ表示できませんでした。写真だけ再試行してください。" })} /></div> : <div className="photo-placeholder">{photo.status === "generating" ? <><span /><b>夜ご飯の食卓写真を生成中　{photoElapsedSeconds}秒</b><small>{photoElapsedSeconds < 60 ? "8人の統合結論から、主菜・副菜・汁物・主食を家庭の器へ配置しています" : photoElapsedSeconds < 240 ? "画像モデルが盛り付けを仕上げています。混雑時は4〜5分かかります。このままお待ちください" : "まもなく5分です。画面を閉じずにお待ちください。5分を超えて失敗した場合は写真だけ再試行できます"}</small></> : <><b>写真を生成できませんでした</b><small>{photo.error}</small><button type="button" onClick={() => void generatePhoto(detail)}>写真だけ再試行</button></>}</div>}<p>写真は8人の専門家が合意した献立全体の盛り付け参考です。実際の器・分量はご家庭に合わせ、レシピの加熱と安全を優先してください。</p></div>
      <div className="design-grid"><article><b>味の設計</b><p>{detail.flavorDesign}</p></article><article><b>食感の設計</b><p>{detail.textureDesign}</p></article><article><b>{mealSeasonLabels[detail.season]}の季節設計</b><p>{detail.seasonalDesign}</p></article><article><b>栄養と量</b><p>{detail.nutritionBalance}</p></article></div>
      <div className="dinner-expert-panel"><p className="eyebrow">EIGHT-EXPERT CONSENSUS</p><h3>8人の専門家による統合結論</h3><p className="dinner-concept">{detail.expertConclusion.finalConcept}</p><div><article><b>味・食感</b><p>{detail.expertConclusion.tasteAndTexture}</p></article><article><b>栄養・分量</b><p>{detail.expertConclusion.nutritionAndPortion}</p></article><article><b>予算・買物</b><p>{detail.expertConclusion.budgetAndShopping}</p></article><article><b>段取り・安全</b><p>{detail.expertConclusion.workflowAndSafety}</p></article><article><b>料理文化</b><p>{detail.expertConclusion.culturalIntegrity}</p></article><article><b>最終判断</b><p>{detail.expertConclusion.finalDecision}</p></article></div></div>
      <div className="home-budget-panel dinner-budget-panel"><div><p className="eyebrow">HOUSEHOLD BUDGET</p><h3>{detail.people}人分の予算内訳</h3><strong>合計 ¥{detail.budgetPlan.totalEstimatedYen.toLocaleString()} / 上限 ¥{conditions?.budgetYen.toLocaleString()}</strong></div><dl><div><dt>主菜</dt><dd>¥{detail.budgetPlan.mainDishYen.toLocaleString()}</dd></div><div><dt>副菜</dt><dd>¥{detail.budgetPlan.sideDishesYen.toLocaleString()}</dd></div><div><dt>汁物・主食・調味料</dt><dd>¥{detail.budgetPlan.soupAndStaplesYen.toLocaleString()}</dd></div><div><dt>予算残り</dt><dd>¥{detail.budgetPlan.remainingYen.toLocaleString()}</dd></div></dl><ul>{detail.shoppingTips.map((tip) => <li key={tip}>{tip}</li>)}</ul></div>
      <div className="family-fit-panel dinner-schedule"><h3>同時調理の段取り（約{detail.cookingSchedule.totalMinutes}分）</h3><ol>{detail.cookingSchedule.parallelSteps.map((step) => <li key={step}>{step}</li>)}</ol><p>{detail.servingPlan}</p></div>
      <p className="recipe-unit">材料はすべて <b>{detail.people}人分</b> です</p><div className="recipe-parts">{detail.recipes.map((part,index) => <article key={`${part.role}-${part.name}`}><header><span>0{index+1}</span><div><small>{roleLabels[part.role]}</small><h3>{part.name}</h3></div></header><div><section><h4>材料</h4><ul>{part.ingredients.map((item) => <li key={item}>{item}</li>)}</ul></section><section><h4>作り方</h4><ol>{part.steps.map((step) => <li key={step}>{step}</li>)}</ol></section></div></article>)}</div>
      <div className="safety-note"><b>安全とアレルゲン</b><p>{detail.safety}</p><p>想定アレルゲン: {detail.allergens.length ? detail.allergens.join("・") : "特になし（使用商品の表示を要確認）"}</p></div>
    </section>}
  </main>;
}
