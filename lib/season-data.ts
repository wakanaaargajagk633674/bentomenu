export type MealSeason = "auto" | "spring" | "summer" | "autumn" | "winter";
export type ResolvedMealSeason = Exclude<MealSeason, "auto">;

export const mealSeasonLabels: Record<MealSeason, string> = {
  auto: "おまかせ",
  spring: "春",
  summer: "夏",
  autumn: "秋",
  winter: "冬",
};

export function resolveMealSeason(season: MealSeason, referenceDate = new Date()): ResolvedMealSeason {
  if (season !== "auto") return season;
  const month = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", month: "numeric" }).format(referenceDate));
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}

export function mealSeasonMatches(selection: MealSeason, resolved: ResolvedMealSeason) {
  return selection === "auto" || selection === resolved;
}
