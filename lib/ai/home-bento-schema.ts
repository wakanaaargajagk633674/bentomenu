import { z } from "zod";
import { chefQualityReviewSchema } from "./chef-quality";

export const homeBentoAgeGroupSchema = z.enum([
  "toddler", "elementary-low", "elementary-middle", "elementary-high",
  "junior-high", "high-school", "twenties", "thirties", "forties",
  "fifties", "sixties", "seventies", "eighties",
]);

export const homeBentoGenderSchema = z.enum(["male", "female", "all"]);
const mealSeasonSchema = z.enum(["auto", "spring", "summer", "autumn", "winter"]);
const resolvedMealSeasonSchema = z.enum(["spring", "summer", "autumn", "winter"]);

export const homeBentoRequestSchema = z.object({
  ageGroup: homeBentoAgeGroupSchema,
  gender: homeBentoGenderSchema,
  largePortion: z.boolean(),
  budgetYen: z.number().int().min(100).max(3000),
  season: mealSeasonSchema,
});

const homeBudgetPlanSchema = z.object({
  mainIngredientsYen: z.number().int().nonnegative(),
  vegetablesAndSidesYen: z.number().int().nonnegative(),
  staplesAndSeasoningsYen: z.number().int().nonnegative(),
  totalEstimatedYen: z.number().int().nonnegative(),
  remainingYen: z.number().int(),
  assumptions: z.array(z.string()).min(1).max(3),
});

export const homeBentoCandidateSchema = z.object({
  id: z.string(),
  name: z.string(),
  tagline: z.string(),
  budgetYen: z.number().int(),
  targetAgeGroup: homeBentoAgeGroupSchema,
  season: resolvedMealSeasonSchema,
  portionPlan: z.string(),
  seasonalDesign: z.string(),
  colors: z.array(z.string()).min(5).max(5),
  flavor: z.string(),
  texture: z.string(),
  contents: z.array(z.string()).min(4).max(7),
  distinctiveFeature: z.string(),
  budgetPlan: homeBudgetPlanSchema,
});

export const homeBentoCandidatesResponseSchema = z.object({
  suggestions: z.array(homeBentoCandidateSchema).length(4),
});

const homeRecipePartSchema = z.object({
  name: z.string(),
  ingredients: z.array(z.string()).min(2),
  steps: z.array(z.string()).min(2),
});

const homeImagePlacementSchema = z.object({
  recipeName: z.string(),
  position: z.enum(["top-left", "top-center", "top-right", "center-left", "center", "center-right", "bottom-left", "bottom-center", "bottom-right"]),
  portionGrams: z.number().int().positive(),
  footprintPercent: z.number().int().min(5).max(70),
  cutShape: z.string(),
  pieceCount: z.string(),
  maxHeightMm: z.number().int().min(8).max(55),
  visibleFinish: z.string(),
  saucePlacement: z.string(),
  garnish: z.string(),
});

export const homeBentoSuggestionSchema = homeBentoCandidateSchema.extend({
  qualityReview: chefQualityReviewSchema,
  recipes: z.array(homeRecipePartSchema).min(3).max(7),
  familyFit: z.object({
    totalPortionGrams: z.number().int().min(100).max(1200),
    stapleGrams: z.number().int().min(30).max(600),
    mainDishGrams: z.number().int().min(20).max(350),
    sideDishGrams: z.number().int().min(20).max(350),
    biteSizeGuidance: z.string(),
    ageAndGenderConsideration: z.string(),
    largePortionAdjustment: z.string(),
    nutritionBalance: z.string(),
  }),
  imageSpec: z.object({
    container: z.object({
      shape: z.string(),
      material: z.string(),
      innerColor: z.string(),
      widthMm: z.number().int().min(110).max(260),
      heightMm: z.number().int().min(80).max(200),
      depthMm: z.number().int().min(25).max(70),
      compartments: z.number().int().min(1).max(7),
    }),
    placements: z.array(homeImagePlacementSchema).min(3).max(7),
    requiredVisibleItems: z.array(z.string()).min(3).max(7),
  }),
  safety: z.string(),
  shoppingTips: z.array(z.string()).min(1).max(3),
});

export const homeBentoDetailRequestSchema = z.object({
  conditions: homeBentoRequestSchema,
  candidate: homeBentoCandidateSchema,
});

export const homeBentoImageRequestSchema = z.object({
  suggestion: homeBentoSuggestionSchema,
  imageToken: z.string().length(64),
});

export type HomeBentoRequest = z.infer<typeof homeBentoRequestSchema>;
export type HomeBentoCandidate = z.infer<typeof homeBentoCandidateSchema>;
export type HomeBentoSuggestion = z.infer<typeof homeBentoSuggestionSchema>;
