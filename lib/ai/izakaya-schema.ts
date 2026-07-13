import { z } from "zod";
import { chefQualityReviewSchema } from "./chef-quality";

const cuisineSchema = z.enum(["japanese", "western", "korean", "chinese", "mixed"]);
const drinkSchema = z.enum(["beer", "sake", "shochu", "wine", "any"]);
const seasonSchema = z.enum(["auto", "spring", "summer", "autumn", "winter"]);

export const izakayaRequestSchema = z.object({
  menuType: z.literal("daily-special"),
  cuisines: z.array(cuisineSchema).min(1).max(5),
  price: z.number().int().min(300).max(3000),
  drink: drinkSchema,
  season: seasonSchema,
});

const izakayaProfitSummarySchema = z.object({
  estimatedFoodCostYen: z.number().int().nonnegative(),
  otherVariableCostYen: z.number().int().nonnegative(),
  totalVariableCostYen: z.number().int().nonnegative(),
  estimatedGrossProfitYen: z.number().int(),
  variableCostRatePercent: z.number().nonnegative(),
});

export const izakayaCandidateSchema = z.object({
  id: z.string(),
  cuisine: cuisineSchema,
  name: z.string(),
  tagline: z.string(),
  basePrice: z.number().int(),
  menuType: z.literal("daily-special"),
  composition: z.string(),
  flavor: z.string(),
  drinkPairing: z.string(),
  distinctiveFeature: z.string(),
  orderToServeMinutes: z.number().int().min(1).max(30),
  profitPlan: izakayaProfitSummarySchema,
});

export const izakayaSuggestionSchema = z.object({
  id: z.string(),
  cuisine: cuisineSchema,
  name: z.string(),
  tagline: z.string(),
  basePrice: z.number().int(),
  menuType: z.literal("daily-special"),
  drinkPairing: z.string(),
  concept: z.string(),
  flavor: z.string(),
  aroma: z.string(),
  texture: z.string(),
  temperature: z.string(),
  colorDesign: z.string(),
  culturalAnchor: z.string(),
  qualityReview: chefQualityReviewSchema,
  recipe: z.object({
    servingYield: z.string(),
    ingredients: z.array(z.string()).min(4),
    prepSteps: z.array(z.string()).min(2),
    serviceSteps: z.array(z.string()).min(2),
  }),
  operations: z.object({
    prepAhead: z.string(),
    orderToServeMinutes: z.number().int().min(1).max(30),
    holdingLimit: z.string(),
    specialEquipment: z.string(),
  }),
  photoSpec: z.object({
    plate: z.object({
      shape: z.string(),
      material: z.string(),
      color: z.string(),
      sizeMm: z.number().int().min(100).max(450),
    }),
    mainPlacement: z.string(),
    portionGrams: z.number().int().positive(),
    footprintPercent: z.number().int().min(15).max(85),
    cutShape: z.string(),
    pieceCount: z.string(),
    maxHeightMm: z.number().int().min(5).max(120),
    visibleFinish: z.string(),
    saucePlacement: z.string(),
    garnish: z.string(),
    camera: z.string(),
    servingState: z.string(),
    requiredVisibleItems: z.array(z.string()).min(1),
    forbiddenItems: z.array(z.string()).min(3),
    altText: z.string(),
  }),
  allergens: z.array(z.string()),
  safety: z.string(),
  profitPlan: z.object({
    estimatedFoodCostYen: z.number().int().nonnegative(),
    otherVariableCostYen: z.number().int().nonnegative(),
    totalVariableCostYen: z.number().int().nonnegative(),
    estimatedGrossProfitYen: z.number().int(),
    variableCostRatePercent: z.number().nonnegative(),
    assumptions: z.array(z.string()).min(1),
    managementVerdict: z.string(),
  }),
});

export const izakayaResponseSchema = z.object({ suggestions: z.array(izakayaCandidateSchema).length(4) });
export const izakayaDetailRequestSchema = z.object({ conditions: izakayaRequestSchema, candidate: izakayaCandidateSchema });
export const izakayaImageRequestSchema = z.object({ suggestion: izakayaSuggestionSchema, imageToken: z.string().min(32) });

export type IzakayaRequest = z.infer<typeof izakayaRequestSchema>;
export type IzakayaCandidate = z.infer<typeof izakayaCandidateSchema>;
export type IzakayaSuggestion = z.infer<typeof izakayaSuggestionSchema>;
