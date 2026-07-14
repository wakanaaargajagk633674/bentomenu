export type DinnerGenderMix = "male-heavy" | "female-heavy" | "balanced" | "male-only" | "female-only";
export type DinnerCuisine = "japanese" | "western" | "korean" | "chinese" | "mixed";

export const dinnerGenderLabels: Record<DinnerGenderMix, string> = {
  "male-heavy": "男性多め",
  "female-heavy": "女性多め",
  balanced: "半々ぐらい",
  "male-only": "男性だけ",
  "female-only": "女性だけ",
};

export const dinnerCuisineLabels: Record<DinnerCuisine, string> = {
  japanese: "和食",
  western: "洋食",
  korean: "韓国料理",
  chinese: "中華料理",
  mixed: "混合",
};
