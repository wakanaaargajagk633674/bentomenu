import type { HomeBentoCandidate } from "./home-bento-schema";

export function normalizeHomeBentoCandidate(candidate: HomeBentoCandidate, budgetYen: number): HomeBentoCandidate {
  const totalEstimatedYen = candidate.budgetPlan.mainIngredientsYen
    + candidate.budgetPlan.vegetablesAndSidesYen
    + candidate.budgetPlan.staplesAndSeasoningsYen;
  if (totalEstimatedYen > budgetYen) throw new Error("Home bento exceeded the household budget");
  return {
    ...candidate,
    budgetYen,
    budgetPlan: {
      ...candidate.budgetPlan,
      totalEstimatedYen,
      remainingYen: budgetYen - totalEstimatedYen,
    },
  };
}

