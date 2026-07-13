"use client";

import Image from "next/image";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { seasonLabels, type BentoPattern } from "@/lib/bento-menu-data";
import type { IzakayaSuggestion } from "@/lib/ai/izakaya-schema";
import { getSavedMenu, SavedMenuDetail } from "@/lib/saved-menus";
import { ChefQualityPanel } from "@/app/components/chef-quality-panel";

type IzakayaPattern = IzakayaSuggestion & { imageToken?: string };

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
      <div className="saved-detail-hero"><div className="saved-detail-image">{menu.imageUrl ? <Image src={menu.imageUrl} alt={menu.image_alt} fill sizes="(max-width:800px) 100vw, 50vw" priority unoptimized /> : <div className="saved-image-pending"><span aria-hidden="true">写真</span><b>{menu.image_status === "failed" ? "画像を保存できませんでした" : "画像を保存しています"}</b></div>}</div><div className="saved-detail-intro"><div className="saved-card-meta"><span className={menu.kind}>{menu.kind === "bento" ? "弁当" : "居酒屋"}</span><time dateTime={menu.created_at}>{savedDate} 保存</time></div><p className="eyebrow">SAVED RECIPE</p><h1>{menu.name}</h1><p>{menu.tagline}</p><dl><div><dt>売価</dt><dd>¥{menu.price_yen.toLocaleString()}</dd></div><div><dt>保存形式</dt><dd>生成時点の完全版</dd></div></dl></div></div>
      <p className="saved-safety-banner">AIによる提案・完成イメージです。実際の調理・提供では、記載された加熱・冷却・保存・アレルゲン条件を現場で再確認してください。</p>
      {menu.kind === "bento" ? <BentoSavedDetail pattern={menu.payload as unknown as BentoPattern} /> : <IzakayaSavedDetail pattern={menu.payload as unknown as IzakayaPattern} />}
      <Link className="detail-return-button saved-return" href="/saved">保存したメニュー一覧へ戻る</Link>
    </article>
  </main>;
}

function BentoSavedDetail({ pattern }: { pattern: BentoPattern }) {
  return <div className="saved-recipe-content"><div className="design-grid"><article><b>味の設計</b><p>{pattern.flavor}</p></article><article><b>食感の設計</b><p>{pattern.texture}</p></article><article><b>{pattern.season ? `${seasonLabels[pattern.season]}の季節設計` : "献立構成"}</b>{pattern.seasonalDesign && <p>{pattern.seasonalDesign}</p>}<p>{pattern.contents.join(" ／ ")}</p></article></div>{pattern.qualityReview && <ChefQualityPanel review={pattern.qualityReview} />}<ProfitPanel plan={pattern.profitPlan} packaging /><p className="recipe-unit">材料はすべて <b>1食分</b> です</p><div className="recipe-parts">{pattern.recipes.map((part, index) => <article key={part.name}><header><span>0{index + 1}</span><h3>{part.name}</h3></header><div><section><h4>材料</h4><ul>{part.ingredients.map((item) => <li key={item}>{item}</li>)}</ul></section><section><h4>作り方</h4><ol>{part.steps.map((step) => <li key={step}>{step}</li>)}</ol></section></div></article>)}</div><div className="safety-note"><b>お弁当の安全ポイント</b><p>{pattern.safety}</p></div></div>;
}

function IzakayaSavedDetail({ pattern }: { pattern: IzakayaPattern }) {
  return <div className="saved-recipe-content"><div className="design-grid"><article><b>コンセプト</b><p>{pattern.concept}</p></article><article><b>味・香り・食感・温度</b><p>{pattern.flavor} ／ {pattern.aroma} ／ {pattern.texture} ／ {pattern.temperature}</p></article><article><b>酒との相性</b><p>{pattern.drinkPairing}</p></article></div>{pattern.qualityReview && <ChefQualityPanel review={pattern.qualityReview} />}<ProfitPanel plan={pattern.profitPlan} operations={pattern.operations} /><p className="recipe-unit">材料は <b>{pattern.recipe.servingYield}</b> です</p><div className="recipe-parts"><article><header><span>01</span><h3>材料と仕込み</h3></header><div><section><h4>材料</h4><ul>{pattern.recipe.ingredients.map((item) => <li key={item}>{item}</li>)}</ul></section><section><h4>仕込み</h4><ol>{pattern.recipe.prepSteps.map((step) => <li key={step}>{step}</li>)}</ol></section></div></article><article><header><span>02</span><h3>注文後の仕上げ</h3></header><div><section><h4>文化の核・色彩</h4><p>{pattern.culturalAnchor}</p><p>{pattern.colorDesign}</p></section><section><h4>仕上げと盛り付け</h4><ol>{pattern.recipe.serviceSteps.map((step) => <li key={step}>{step}</li>)}</ol></section></div></article></div><div className="safety-note"><b>食品安全・アレルゲン</b><p>{pattern.safety}</p><p>アレルゲン: {pattern.allergens.length ? pattern.allergens.join("、") : "特記事項なし"}</p></div></div>;
}

type Profit = { estimatedFoodCostYen: number; packagingCostYen?: number; otherVariableCostYen: number; estimatedGrossProfitYen: number; variableCostRatePercent: number; managementVerdict: string; assumptions: string[] };
type Operations = { orderToServeMinutes: number; prepAhead: string; holdingLimit: string; specialEquipment: string };
function ProfitPanel({ plan, packaging, operations }: { plan: Profit; packaging?: boolean; operations?: Operations }) {
  return <div className="profit-panel"><div className="profit-heading"><div><p className="eyebrow">OPERATION & PROFIT</p><h3>提供設計と採算</h3></div><strong>想定粗利益 ¥{plan.estimatedGrossProfitYen.toLocaleString()}</strong></div><div className="profit-numbers"><dl><dt>食材原価</dt><dd>¥{plan.estimatedFoodCostYen.toLocaleString()}</dd></dl><dl><dt>{packaging ? "容器・包材" : "その他変動費"}</dt><dd>¥{(packaging ? plan.packagingCostYen ?? 0 : plan.otherVariableCostYen).toLocaleString()}</dd></dl><dl><dt>{operations ? "注文後の提供" : "その他変動費"}</dt><dd>{operations ? `${operations.orderToServeMinutes}分` : `¥${plan.otherVariableCostYen.toLocaleString()}`}</dd></dl><dl><dt>変動費率</dt><dd>{plan.variableCostRatePercent.toFixed(1)}%</dd></dl></div><p className="management-verdict">{plan.managementVerdict}</p><details><summary>仕込み・保持・見積もり前提</summary>{operations && <><p>{operations.prepAhead}</p><p>保持限界: {operations.holdingLimit} ／ 設備: {operations.specialEquipment}</p></>}<ul>{plan.assumptions.map((item) => <li key={item}>{item}</li>)}</ul></details></div>;
}
