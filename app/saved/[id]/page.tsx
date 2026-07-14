"use client";

import Image from "next/image";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { seasonLabels, type BentoPattern } from "@/lib/bento-menu-data";
import type { IzakayaSuggestion } from "@/lib/ai/izakaya-schema";
import type { HomeBentoSuggestion } from "@/lib/ai/home-bento-schema";
import type { DinnerSuggestion } from "@/lib/ai/dinner-schema";
import { getSavedMenu, SavedMenuDetail } from "@/lib/saved-menus";
import { ChefQualityPanel } from "@/app/components/chef-quality-panel";

type IzakayaPattern = IzakayaSuggestion & { imageToken?: string };
const kindLabels = { bento: "販売用弁当", home_bento: "家庭用弁当", izakaya: "居酒屋", dinner: "夜ご飯" } as const;

export default function SavedMenuDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [menu, setMenu] = useState<SavedMenuDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getSavedMenu(id).then((item) => { if (active) setMenu(item); }).catch(() => { if (active) setError("このメニューを開けませんでした。保存したブラウザでアクセスしているか確認してください。"); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  if (loading) return <main className="saved-page"><header className="planner-header"><Link className="back" href="/saved">← 保存したメニューへ</Link><span>名称（仮称）</span></header><div className="library-state detail-loading" role="status"><span className="progress-spinner" aria-hidden="true" /><b>レシピを読み込んでいます</b></div></main>;
  if (error || !menu) return <main className="saved-page"><header className="planner-header"><Link className="back" href="/saved">← 保存したメニューへ</Link><span>名称（仮称）</span></header><div className="library-state error detail-loading" role="alert"><b>{error}</b><Link href="/saved">保存したメニュー一覧へ戻る</Link></div></main>;

  const savedDate = new Intl.DateTimeFormat("ja-JP", { dateStyle: "long" }).format(new Date(menu.created_at));
  return <main className={`saved-page saved-detail-page ${menu.kind}`}>
    <header className="planner-header"><Link className="back" href="/saved">← 保存したメニューへ</Link><span>名称（仮称）</span></header>
    <article className="saved-detail">
      <div className="saved-detail-hero"><div className="saved-detail-image">{menu.imageUrl ? <Image src={menu.imageUrl} alt={menu.image_alt} fill sizes="(max-width:800px) 100vw, 50vw" priority unoptimized /> : <div className={`saved-image-pending ${menu.image_status === "none" ? "no-image" : ""}`}><span aria-hidden="true">{menu.image_status === "none" ? "献立" : "写真"}</span><b>{menu.image_status === "none" ? "画像なし・レシピ保存" : menu.image_status === "failed" ? "画像を保存できませんでした" : "画像を保存しています"}</b></div>}</div><div className="saved-detail-intro"><div className="saved-card-meta"><span className={menu.kind}>{kindLabels[menu.kind]}</span><time dateTime={menu.created_at}>{savedDate} 保存</time></div><p className="eyebrow">SAVED RECIPE</p><h1>{menu.name}</h1><p>{menu.tagline}</p><dl><div><dt>{menu.kind === "home_bento" ? "予算上限" : menu.kind === "dinner" ? "食材見積" : "売価"}</dt><dd>¥{menu.price_yen.toLocaleString()}</dd></div><div><dt>保存形式</dt><dd>生成時点の完全版</dd></div></dl></div></div>
      <p className="saved-safety-banner">AIによる提案・完成イメージです。実際の調理・提供では、記載された加熱・冷却・保存・アレルゲン条件を現場で再確認してください。</p>
      {menu.kind === "bento" && <BentoSavedDetail pattern={menu.payload as unknown as BentoPattern} />}
      {menu.kind === "home_bento" && <HomeBentoSavedDetail pattern={menu.payload as unknown as HomeBentoSuggestion} />}
      {menu.kind === "izakaya" && <IzakayaSavedDetail pattern={menu.payload as unknown as IzakayaPattern} />}
      {menu.kind === "dinner" && <DinnerSavedDetail pattern={menu.payload as unknown as DinnerSuggestion} />}
      <Link className="detail-return-button saved-return" href="/saved">保存したメニュー一覧へ戻る</Link>
    </article>
  </main>;
}

function BentoSavedDetail({ pattern }: { pattern: BentoPattern }) {
  return <div className="saved-recipe-content"><div className="design-grid"><article><b>味の設計</b><p>{pattern.flavor}</p></article><article><b>食感の設計</b><p>{pattern.texture}</p></article><article><b>{pattern.season ? `${seasonLabels[pattern.season]}の季節設計` : "献立構成"}</b>{pattern.seasonalDesign && <p>{pattern.seasonalDesign}</p>}<p>{pattern.contents.join(" ／ ")}</p></article></div>{pattern.qualityReview && <ChefQualityPanel review={pattern.qualityReview} />}<ProfitPanel plan={pattern.profitPlan} packaging /><p className="recipe-unit">材料はすべて <b>1食分</b> です</p><div className="recipe-parts">{pattern.recipes.map((part, index) => <article key={part.name}><header><span>0{index + 1}</span><h3>{part.name}</h3></header><div><section><h4>材料</h4><ul>{part.ingredients.map((item) => <li key={item}>{item}</li>)}</ul></section><section><h4>作り方</h4><ol>{part.steps.map((step) => <li key={step}>{step}</li>)}</ol></section></div></article>)}</div><div className="safety-note"><b>お弁当の安全ポイント</b><p>{pattern.safety}</p></div></div>;
}

function HomeBentoSavedDetail({ pattern }: { pattern: HomeBentoSuggestion }) {
  return <div className="saved-recipe-content"><div className="design-grid"><article><b>味の設計</b><p>{pattern.flavor}</p></article><article><b>食感の設計</b><p>{pattern.texture}</p></article><article><b>量と栄養</b><p>{pattern.familyFit.ageAndGenderConsideration}</p><p>{pattern.familyFit.nutritionBalance}</p></article></div>{pattern.qualityReview && <ChefQualityPanel review={pattern.qualityReview} />}<div className="home-budget-panel"><div><p className="eyebrow">HOUSEHOLD BUDGET</p><h3>1食分の予算内訳</h3><strong>合計 ¥{pattern.budgetPlan.totalEstimatedYen.toLocaleString()} / 上限 ¥{pattern.budgetYen.toLocaleString()}</strong></div><dl><div><dt>主材料</dt><dd>¥{pattern.budgetPlan.mainIngredientsYen.toLocaleString()}</dd></div><div><dt>野菜・副菜</dt><dd>¥{pattern.budgetPlan.vegetablesAndSidesYen.toLocaleString()}</dd></div><div><dt>主食・調味料</dt><dd>¥{pattern.budgetPlan.staplesAndSeasoningsYen.toLocaleString()}</dd></div><div><dt>予算残り</dt><dd>¥{pattern.budgetPlan.remainingYen.toLocaleString()}</dd></div></dl><ul>{pattern.shoppingTips.map((tip) => <li key={tip}>{tip}</li>)}</ul></div><p className="recipe-unit">材料はすべて <b>1人分</b> です</p><div className="recipe-parts">{pattern.recipes.map((part,index) => <article key={part.name}><header><span>0{index+1}</span><h3>{part.name}</h3></header><div><section><h4>材料</h4><ul>{part.ingredients.map((item) => <li key={item}>{item}</li>)}</ul></section><section><h4>作り方</h4><ol>{part.steps.map((step) => <li key={step}>{step}</li>)}</ol></section></div></article>)}</div><div className="safety-note"><b>家庭弁当の安全ポイント</b><p>{pattern.safety}</p></div></div>;
}

function DinnerSavedDetail({ pattern }: { pattern: DinnerSuggestion }) {
  const roleLabels = { main: "主菜", side: "副菜", soup: "汁物" } as const;
  return <div className="saved-recipe-content"><div className="design-grid"><article><b>味の設計</b><p>{pattern.flavorDesign}</p></article><article><b>食感の設計</b><p>{pattern.textureDesign}</p></article><article><b>栄養と量</b><p>{pattern.nutritionBalance}</p></article></div><div className="dinner-expert-panel"><p className="eyebrow">EIGHT-EXPERT CONSENSUS</p><h3>8人の専門家による統合結論</h3><p className="dinner-concept">{pattern.expertConclusion.finalConcept}</p><div><article><b>味・食感</b><p>{pattern.expertConclusion.tasteAndTexture}</p></article><article><b>栄養・分量</b><p>{pattern.expertConclusion.nutritionAndPortion}</p></article><article><b>予算・買物</b><p>{pattern.expertConclusion.budgetAndShopping}</p></article><article><b>段取り・安全</b><p>{pattern.expertConclusion.workflowAndSafety}</p></article><article><b>料理文化</b><p>{pattern.expertConclusion.culturalIntegrity}</p></article><article><b>最終判断</b><p>{pattern.expertConclusion.finalDecision}</p></article></div></div><div className="home-budget-panel dinner-budget-panel"><div><p className="eyebrow">HOUSEHOLD BUDGET</p><h3>{pattern.people}人分の食材見積</h3><strong>合計 ¥{pattern.budgetPlan.totalEstimatedYen.toLocaleString()}</strong></div><dl><div><dt>主菜</dt><dd>¥{pattern.budgetPlan.mainDishYen.toLocaleString()}</dd></div><div><dt>副菜</dt><dd>¥{pattern.budgetPlan.sideDishesYen.toLocaleString()}</dd></div><div><dt>汁物・主食・調味料</dt><dd>¥{pattern.budgetPlan.soupAndStaplesYen.toLocaleString()}</dd></div><div><dt>予算残り</dt><dd>¥{pattern.budgetPlan.remainingYen.toLocaleString()}</dd></div></dl><ul>{pattern.shoppingTips.map((tip) => <li key={tip}>{tip}</li>)}</ul></div><div className="family-fit-panel dinner-schedule"><h3>同時調理の段取り（約{pattern.cookingSchedule.totalMinutes}分）</h3><ol>{pattern.cookingSchedule.parallelSteps.map((step) => <li key={step}>{step}</li>)}</ol><p>{pattern.servingPlan}</p></div><p className="recipe-unit">材料はすべて <b>{pattern.people}人分</b> です</p><div className="recipe-parts">{pattern.recipes.map((part,index) => <article key={`${part.role}-${part.name}`}><header><span>0{index+1}</span><div><small>{roleLabels[part.role]}</small><h3>{part.name}</h3></div></header><div><section><h4>材料</h4><ul>{part.ingredients.map((item) => <li key={item}>{item}</li>)}</ul></section><section><h4>作り方</h4><ol>{part.steps.map((step) => <li key={step}>{step}</li>)}</ol></section></div></article>)}</div><div className="safety-note"><b>安全とアレルゲン</b><p>{pattern.safety}</p><p>想定アレルゲン: {pattern.allergens.length ? pattern.allergens.join("・") : "特になし（使用商品の表示を要確認）"}</p></div></div>;
}

function IzakayaSavedDetail({ pattern }: { pattern: IzakayaPattern }) {
  return <div className="saved-recipe-content"><div className="design-grid"><article><b>コンセプト</b><p>{pattern.concept}</p></article><article><b>味・香り・食感・温度</b><p>{pattern.flavor} ／ {pattern.aroma} ／ {pattern.texture} ／ {pattern.temperature}</p></article><article><b>酒との相性</b><p>{pattern.drinkPairing}</p></article></div>{pattern.qualityReview && <ChefQualityPanel review={pattern.qualityReview} />}<ProfitPanel plan={pattern.profitPlan} operations={pattern.operations} /><p className="recipe-unit">材料は <b>{pattern.recipe.servingYield}</b> です</p><div className="recipe-parts"><article><header><span>01</span><h3>材料と仕込み</h3></header><div><section><h4>材料</h4><ul>{pattern.recipe.ingredients.map((item) => <li key={item}>{item}</li>)}</ul></section><section><h4>仕込み</h4><ol>{pattern.recipe.prepSteps.map((step) => <li key={step}>{step}</li>)}</ol></section></div></article><article><header><span>02</span><h3>注文後の仕上げ</h3></header><div><section><h4>文化の核・色彩</h4><p>{pattern.culturalAnchor}</p><p>{pattern.colorDesign}</p></section><section><h4>仕上げと盛り付け</h4><ol>{pattern.recipe.serviceSteps.map((step) => <li key={step}>{step}</li>)}</ol></section></div></article></div><div className="safety-note"><b>食品安全・アレルゲン</b><p>{pattern.safety}</p><p>アレルゲン: {pattern.allergens.length ? pattern.allergens.join("、") : "特記事項なし"}</p></div></div>;
}

type Profit = { estimatedFoodCostYen: number; packagingCostYen?: number; otherVariableCostYen: number; estimatedGrossProfitYen: number; variableCostRatePercent: number; managementVerdict: string; assumptions: string[] };
type Operations = { orderToServeMinutes: number; prepAhead: string; holdingLimit: string; specialEquipment: string };
function ProfitPanel({ plan, packaging, operations }: { plan: Profit; packaging?: boolean; operations?: Operations }) {
  return <div className="profit-panel"><div className="profit-heading"><div><p className="eyebrow">OPERATION & PROFIT</p><h3>提供設計と採算</h3></div><strong>想定粗利益 ¥{plan.estimatedGrossProfitYen.toLocaleString()}</strong></div><div className="profit-numbers"><dl><dt>食材原価</dt><dd>¥{plan.estimatedFoodCostYen.toLocaleString()}</dd></dl><dl><dt>{packaging ? "容器・包材" : "その他変動費"}</dt><dd>¥{(packaging ? plan.packagingCostYen ?? 0 : plan.otherVariableCostYen).toLocaleString()}</dd></dl><dl><dt>{operations ? "注文後の提供" : "その他変動費"}</dt><dd>{operations ? `${operations.orderToServeMinutes}分` : `¥${plan.otherVariableCostYen.toLocaleString()}`}</dd></dl><dl><dt>変動費率</dt><dd>{plan.variableCostRatePercent.toFixed(1)}%</dd></dl></div><p className="management-verdict">{plan.managementVerdict}</p><details><summary>仕込み・保持・見積もり前提</summary>{operations && <><p>{operations.prepAhead}</p><p>保持限界: {operations.holdingLimit} ／ 設備: {operations.specialEquipment}</p></>}<ul>{plan.assumptions.map((item) => <li key={item}>{item}</li>)}</ul></details></div>;
}
