import type { ChefQualityReview } from "@/lib/ai/chef-quality";

export type Cuisine = "japanese" | "western" | "korean" | "chinese" | "mixed";
export type Gender = "male" | "female" | "all";
export type Area = "residential" | "office" | "station";
export type BentoSeason = "auto" | "spring" | "summer" | "autumn" | "winter";
export type ResolvedBentoSeason = Exclude<BentoSeason, "auto">;

export type RecipePart = {
  name: string;
  ingredients: string[];
  steps: string[];
};

export type BentoPattern = {
  id: string;
  cuisine: Cuisine;
  name: string;
  tagline: string;
  basePrice: number;
  genders: Gender[];
  areas: Area[];
  season: ResolvedBentoSeason;
  seasonalDesign: string;
  qualityReview: ChefQualityReview;
  colors: string[];
  flavor: string;
  texture: string;
  contents: string[];
  recipes: RecipePart[];
  imageToken: string;
  imageSpec: {
    container: { shape: string; material: string; innerColor: string; widthMm: number; heightMm: number; depthMm: number; compartments: number };
    placements: Array<{ recipeName: string; position: string; portionGrams: number; footprintPercent: number; cutShape: string; pieceCount: string; maxHeightMm: number; visibleFinish: string; saucePlacement: string; garnish: string }>;
    camera: string;
    requiredVisibleItems: string[];
    forbiddenItems: string[];
    servingState: string;
    altText: string;
  };
  safety: string;
  profitPlan: {
    estimatedFoodCostYen: number;
    packagingCostYen: number;
    otherVariableCostYen: number;
    totalVariableCostYen: number;
    estimatedGrossProfitYen: number;
    variableCostRatePercent: number;
    assumptions: string[];
    managementVerdict: string;
  };
};

export const cuisineLabels: Record<Cuisine, string> = {
  japanese: "和食",
  western: "洋食",
  korean: "韓国",
  chinese: "中華",
  mixed: "混合",
};

export const seasonLabels: Record<BentoSeason, string> = {
  auto: "おまかせ",
  spring: "春",
  summer: "夏",
  autumn: "秋",
  winter: "冬",
};
