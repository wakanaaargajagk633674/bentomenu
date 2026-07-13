export type Cuisine = "japanese" | "western" | "korean" | "chinese" | "mixed";
export type Gender = "male" | "female" | "all";
export type Area = "residential" | "office" | "station";

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
  colors: string[];
  flavor: string;
  texture: string;
  contents: string[];
  recipes: RecipePart[];
  safety: string;
};

export const cuisineLabels: Record<Cuisine, string> = {
  japanese: "和食",
  western: "洋食",
  korean: "韓国",
  chinese: "中華",
  mixed: "混合",
};
