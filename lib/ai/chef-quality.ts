import { z } from "zod";

export const chefQualityReviewSchema = z.object({
  chefThesis: z.string(),
  culinaryIdentity: z.object({
    regionOrTradition: z.string(),
    traditionalFlavorProfile: z.string(),
    coreTechnique: z.string(),
    creativeChanges: z.array(z.string()).min(1).max(2),
  }),
  sensoryTarget: z.object({
    primaryTaste: z.string(),
    supportingTastes: z.array(z.string()).min(1).max(2),
    contourTaste: z.string(),
    aroma: z.object({ beforeEating: z.string(), firstBite: z.string(), finish: z.string() }),
    textures: z.array(z.string()).min(2).max(4),
    targetTemperatureC: z.number().min(0).max(100),
    peak: z.string(),
    pause: z.string(),
  }),
  qualityWindow: z.object({
    evaluationPoints: z.array(z.object({ timing: z.string(), expectedQuality: z.string(), passCriteria: z.string() })).min(2).max(4),
    degradationRisks: z.array(z.string()).min(1).max(4),
    controls: z.array(z.string()).min(1).max(4),
  }),
  culturalCore: z.string(),
  ingredientLogic: z.string(),
  techniqueLogic: z.string(),
  sensoryArc: z.string(),
  timeAndTemperature: z.string(),
  operationalProof: z.string(),
  testPoint: z.string(),
});

export type ChefQualityReview = z.infer<typeof chefQualityReviewSchema>;

export const SHARED_CHEF_QUALITY_PROMPT = `
料理人チームの品質規律:
- 「世界一」「本格的」などの肩書きを品質の根拠にしない。素材、技法、比率、温度、時間、食べる時点の変化で説明する。
- 和食は出汁・五法・走り盛り名残・切る技術・余白、洋食は主素材・ソース・付け合わせ・抽出と還元・火入れ、韓国料理は醤と発酵・五味・五方色・飯との関係、中華は地域と味型・香りの投入順・水分制御・火入れを具体的な核にする。
- 定番の調味料を付け替えただけの安易な融合、目的のない高級食材、全品同じ濃さ、飾りだけの薬味、曖昧な「適量」「火が通るまで」を禁止する。
- 主役は原則1つ。脇役には主役を強める、対比、口直し、季節提示のいずれかの役割を与え、役割を説明できない要素は削る。
- 主味、支持味、輪郭の味、提供前・口中・余韻の香り、最低2つの食感、提供時点の温度を一つの食体験として設計する。
- 素材の個体差、歩留まり、切り方、投入順、中心温度または油温、加熱時間、休ませ・冷却・保持時間のうち品質を左右する数値をレシピへ入れる。
- 提案後、文化、官能、弁当時間経過、居酒屋提供、食品安全、原価、量産、視覚、AI整合性を簡潔に内部確認し、完成案だけを出す。自己採点、却下案、修正過程、架空の会話、長い思考過程は出力しない。
- qualityReviewには最終案の料理人としての一文、文化の核、素材と技法の必然、食べ始めから余韻までの感覚、温度・時間、現場再現根拠、試作で最初に検証する変数を具体的に記録する。
- culinaryIdentityでは国名だけでなく地域・伝統・味型・核となる技法を特定し、創作変更は最大2点に絞る。混合でも借用元双方の核を説明する。
- sensoryTargetでは主味1、支持味1〜2、輪郭味1、食前・一口目・余韻の香り、最低2食感、目標喫食温度、味の頂点と口を休める要素を構造化する。
- qualityWindowは弁当なら調理直後と想定2〜4時間後、居酒屋なら盛付け直後と提供・卓上上限時を必ず含め、劣化リスク、制御方法、合格基準を記録する。
`;

export function assertDistinctChefSuggestions<T>(suggestions: T[], getName: (item: T) => string, getConcept: (item: T) => string) {
  const normalizedNames = suggestions.map((item) => getName(item).normalize("NFKC").replace(/\s/g, "").toLocaleLowerCase("ja"));
  const normalizedConcepts = suggestions.map((item) => getConcept(item).normalize("NFKC").replace(/[\s、。・]/g, "").toLocaleLowerCase("ja"));
  if (new Set(normalizedNames).size !== suggestions.length || new Set(normalizedConcepts).size !== suggestions.length) {
    throw new Error("Chef team returned duplicate menu concepts");
  }
}

export function assertChefQualityReviews(reviews: ChefQualityReview[]) {
  reviews.forEach((review, index) => {
    const timings = review.qualityWindow.evaluationPoints.map((point) => point.timing.normalize("NFKC").replace(/\s/g, ""));
    const textures = review.sensoryTarget.textures.map((texture) => texture.normalize("NFKC").replace(/\s/g, ""));
    if (new Set(timings).size !== timings.length || new Set(textures).size !== textures.length) {
      throw new Error(`Chef ${index + 1} returned duplicate quality checkpoints`);
    }
  });
}
