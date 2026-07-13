import { z } from "zod";
import { chefQualityReviewSchema } from "./chef-quality";

const cuisineSchema = z.enum(["japanese", "western", "korean", "chinese", "mixed"]);
const seasonSchema = z.enum(["auto", "spring", "summer", "autumn", "winter"]);
const resolvedSeasonSchema = z.enum(["spring", "summer", "autumn", "winter"]);

export const bentoRequestSchema = z.object({
  cuisines: z.array(cuisineSchema).min(1).max(5),
  price: z.number().int().min(500).max(3000),
  gender: z.enum(["male", "female", "all"]),
  area: z.enum(["residential", "office", "station"]),
  season: seasonSchema,
});

const recipePartSchema = z.object({
  name: z.string(),
  ingredients: z.array(z.string()).min(2),
  steps: z.array(z.string()).min(2),
});

const imagePlacementSchema = z.object({
  recipeName: z.string(),
  position: z.enum(["top-left", "top-center", "top-right", "center-left", "center", "center-right", "bottom-left", "bottom-center", "bottom-right"]),
  portionGrams: z.number().int().positive(),
  footprintPercent: z.number().int().min(5).max(70),
  cutShape: z.string(),
  pieceCount: z.string(),
  maxHeightMm: z.number().int().min(10).max(55),
  visibleFinish: z.string(),
  saucePlacement: z.string(),
  garnish: z.string(),
});

export const bentoSuggestionSchema = z.object({
  id: z.string(),
  cuisine: cuisineSchema,
  name: z.string(),
  tagline: z.string(),
  basePrice: z.number().int(),
  genders: z.array(z.enum(["male", "female", "all"])),
  areas: z.array(z.enum(["residential", "office", "station"])),
  season: resolvedSeasonSchema,
  seasonalDesign: z.string(),
  qualityReview: chefQualityReviewSchema,
  colors: z.array(z.string()).min(5).max(5),
  flavor: z.string(),
  texture: z.string(),
  contents: z.array(z.string()).min(4),
  recipes: z.array(recipePartSchema).min(2),
  imageSpec: z.object({
    container: z.object({
      shape: z.string(),
      material: z.string(),
      innerColor: z.string(),
      widthMm: z.number().int().min(140).max(300),
      heightMm: z.number().int().min(100).max(240),
      depthMm: z.number().int().min(25).max(60),
      compartments: z.number().int().min(1).max(9),
    }),
    placements: z.array(imagePlacementSchema).min(2),
    camera: z.string(),
    requiredVisibleItems: z.array(z.string()).min(2),
    forbiddenItems: z.array(z.string()).min(3),
    servingState: z.string(),
    altText: z.string(),
  }),
  safety: z.string(),
  profitPlan: z.object({
    estimatedFoodCostYen: z.number().int().nonnegative(),
    packagingCostYen: z.number().int().nonnegative(),
    otherVariableCostYen: z.number().int().nonnegative(),
    totalVariableCostYen: z.number().int().nonnegative(),
    estimatedGrossProfitYen: z.number().int(),
    variableCostRatePercent: z.number().nonnegative(),
    assumptions: z.array(z.string()).min(1),
    managementVerdict: z.string(),
  }),
});

export const bentoResponseSchema = z.object({
  suggestions: z.array(bentoSuggestionSchema).length(4),
});

export const bentoImageRequestSchema = z.object({
  suggestion: bentoSuggestionSchema,
  imageToken: z.string().min(32),
});

export type BentoRequest = z.infer<typeof bentoRequestSchema>;
export type BentoResponse = z.infer<typeof bentoResponseSchema>;
export type BentoSuggestion = z.infer<typeof bentoSuggestionSchema>;
export type BentoSeason = z.infer<typeof seasonSchema>;
export type ResolvedBentoSeason = z.infer<typeof resolvedSeasonSchema>;
