import type { ChefQualityReview } from "@/lib/ai/chef-quality";

export function ChefQualityPanel({ review }: { review: ChefQualityReview }) {
  return <section className="chef-quality-panel">
    <div className="chef-quality-heading"><div><p className="eyebrow">CHEF QUALITY REVIEW</p><h3>料理人チームの品質審査</h3></div><strong>文化・官能・現場品質を確認</strong></div>
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
    <details><summary>最初の試作ポイント</summary><p>{review.testPoint}</p></details>
  </section>;
}
