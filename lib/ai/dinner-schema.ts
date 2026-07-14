import { z } from "zod";

export const dinnerGenderMixSchema = z.enum(["male-heavy", "female-heavy", "balanced", "male-only", "female-only"]);
export const dinnerCuisineSchema = z.enum(["japanese", "western", "korean", "chinese", "mixed"]);
const mealSeasonSchema = z.enum(["auto", "spring", "summer", "autumn", "winter"]);
const resolvedMealSeasonSchema = z.enum(["spring", "summer", "autumn", "winter"]);

export const dinnerRequestSchema = z.object({
  people: z.number().int().min(1).max(6),
  genderMix: dinnerGenderMixSchema,
  cuisine: dinnerCuisineSchema,
  budgetYen: z.number().int().min(500).max(30000),
  season: mealSeasonSchema,
  requestEnabled: z.boolean(),
  requestText: z.string().max(500),
}).superRefine((value, context) => {
  if (value.requestEnabled && !value.requestText.trim()) {
    context.addIssue({ code: "custom", path: ["requestText"], message: "細かい指示を入力してください。" });
  }
});

const dinnerBudgetPlanSchema = z.object({
  mainDishYen: z.number().int().nonnegative(),
  sideDishesYen: z.number().int().nonnegative(),
  soupAndStaplesYen: z.number().int().nonnegative(),
  totalEstimatedYen: z.number().int().nonnegative(),
  remainingYen: z.number().int(),
  assumptions: z.array(z.string()).min(1).max(3),
});

export const dinnerCandidateSchema = z.object({
  id: z.string(),
  name: z.string(),
  tagline: z.string(),
  cuisine: dinnerCuisineSchema,
  people: z.number().int().min(1).max(6),
  season: resolvedMealSeasonSchema,
  mainDish: z.string(),
  sideDishes: z.array(z.string()).min(2).max(6),
  soup: z.string(),
  flavorDesign: z.string(),
  textureDesign: z.string(),
  seasonalDesign: z.string(),
  estimatedCookingMinutes: z.number().int().min(10).max(180),
  budgetPlan: dinnerBudgetPlanSchema,
});

export const dinnerCandidatesResponseSchema = z.object({
  suggestions: z.array(dinnerCandidateSchema).length(4),
});

const dinnerRecipeSchema = z.object({
  name: z.string(),
  role: z.enum(["main", "side", "soup"]),
  ingredients: z.array(z.string()).min(2).max(18),
  steps: z.array(z.string()).min(2).max(10),
});

export const dinnerSuggestionSchema = dinnerCandidateSchema.extend({
  recipes: z.array(dinnerRecipeSchema).min(4).max(8),
  cookingSchedule: z.object({
    totalMinutes: z.number().int().min(10).max(180),
    parallelSteps: z.array(z.string()).min(3).max(8),
  }),
  servingPlan: z.string(),
  nutritionBalance: z.string(),
  shoppingTips: z.array(z.string()).min(1).max(4),
  safety: z.string(),
  allergens: z.array(z.string()).max(12),
  expertConclusion: z.object({
    finalConcept: z.string(),
    tasteAndTexture: z.string(),
    nutritionAndPortion: z.string(),
    budgetAndShopping: z.string(),
    workflowAndSafety: z.string(),
    culturalIntegrity: z.string(),
    finalDecision: z.string(),
  }),
});

export const dinnerDetailRequestSchema = z.object({
  conditions: dinnerRequestSchema,
  candidate: dinnerCandidateSchema,
});

export type DinnerRequest = z.infer<typeof dinnerRequestSchema>;
export type DinnerCandidate = z.infer<typeof dinnerCandidateSchema>;
export type DinnerSuggestion = z.infer<typeof dinnerSuggestionSchema>;
