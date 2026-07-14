import type { DinnerCandidate } from "./dinner-schema";

export function normalizeDinnerCandidate(candidate: DinnerCandidate, budgetYen: number): DinnerCandidate {
  const totalEstimatedYen = candidate.budgetPlan.mainDishYen
    + candidate.budgetPlan.sideDishesYen
    + candidate.budgetPlan.soupAndStaplesYen;
  if (totalEstimatedYen > budgetYen) throw new Error("Dinner exceeded the household budget");
  return {
    ...candidate,
    budgetPlan: {
      ...candidate.budgetPlan,
      totalEstimatedYen,
      remainingYen: budgetYen - totalEstimatedYen,
    },
  };
}
