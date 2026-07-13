import type { ChefQualityReview } from "@/lib/ai/chef-quality";

const scoreLabels: Record<keyof ChefQualityReview["scores"], string> = {
  concept: "コンセプト",
  deliciousness: "おいしさ",
  culturalIntegrity: "文化",
  seasonality: "季節",
  visual: "視覚",
  feasibility: "実現性",
  serviceQuality: "提供品質",
  safety: "安全",
  originality: "独自性",
};

export function ChefQualityPanel({ review }: { review: ChefQualityReview }) {
  return <section className="chef-quality-panel">
    <div className="chef-quality-heading"><div><p className="eyebrow">10-EXPERT QUALITY GATE</p><h3>料理人チームの品質審査</h3></div><strong>9軸すべて4点以上</strong></div>
    <p className="chef-thesis">{review.chefThesis}</p>
    <div className="chef-identity-line"><b>{review.culinaryIdentity.regionOrTradition}</b><span>{review.culinaryIdentity.traditionalFlavorProfile}</span><span>{review.culinaryIdentity.coreTechnique}</span></div>
    <div className="chef-quality-grid">
      <article><b>文化の核</b><p>{review.culturalCore}</p></article>
      <article><b>素材と技法の必然</b><p>{review.ingredientLogic}</p><p>{review.techniqueLogic}</p></article>
      <article><b>味覚・香り・食感の流れ</b><p>{review.sensoryArc}</p></article>
      <article><b>温度・時間・現場再現</b><p>{review.timeAndTemperature}</p><p>{review.operationalProof}</p></article>
    </div>
    <div className="chef-sensory-summary"><div><b>味の頂点</b><p>{review.sensoryTarget.peak}</p></div><div><b>口の休符</b><p>{review.sensoryTarget.pause}</p></div><div><b>目標温度</b><p>{review.sensoryTarget.targetTemperatureC}℃</p></div></div>
    <details><summary>提供時点までの品質窓</summary><ul>{review.qualityWindow.evaluationPoints.map((point) => <li key={point.timing}><b>{point.timing}</b><span>{point.expectedQuality}</span><small>合格: {point.passCriteria}</small></li>)}</ul><p>劣化リスク: {review.qualityWindow.degradationRisks.join(" ／ ")}</p><p>制御: {review.qualityWindow.controls.join(" ／ ")}</p></details>
    <details><summary>却下した案・修正理由・試作ポイント</summary><dl><div><dt>却下</dt><dd>{review.rejectedAlternative}</dd></div><div><dt>修正</dt><dd>{review.revisionReason}</dd></div><div><dt>試作</dt><dd>{review.testPoint}</dd></div><div><dt>最弱点</dt><dd>{review.weakestScoreReason}</dd></div></dl></details>
    <div className="chef-score-grid" aria-label="料理品質9軸評価">{Object.entries(review.scores).map(([key, score]) => <div key={key}><span>{scoreLabels[key as keyof ChefQualityReview["scores"]]}</span><b>{score}<small>/5</small></b></div>)}</div>
  </section>;
}
