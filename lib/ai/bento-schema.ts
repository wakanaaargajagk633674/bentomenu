import { z } from "zod";

const cuisineSchema = z.enum(["japanese", "western", "korean", "chinese", "mixed"]);

export const bentoRequestSchema = z.object({
  cuisines: z.array(cuisineSchema).min(1).max(5),
  price: z.number().int().min(500).max(3000),
  gender: z.enum(["male", "female", "all"]),
  area: z.enum(["residential", "office", "station"]),
});

const recipePartSchema = z.object({
  name: z.string(),
  ingredients: z.array(z.string()).min(2),
  steps: z.array(z.string()).min(2),
});

export const bentoResponseSchema = z.object({
  suggestions: z.array(z.object({
    id: z.string(),
    cuisine: cuisineSchema,
    name: z.string(),
    tagline: z.string(),
    basePrice: z.number().int(),
    genders: z.array(z.enum(["male", "female", "all"])),
    areas: z.array(z.enum(["residential", "office", "station"])),
    colors: z.array(z.string()).min(5).max(5),
    flavor: z.string(),
    texture: z.string(),
    contents: z.array(z.string()).min(4),
    recipes: z.array(recipePartSchema).min(2),
    safety: z.string(),
  })).length(4),
});

export type BentoRequest = z.infer<typeof bentoRequestSchema>;
export type BentoResponse = z.infer<typeof bentoResponseSchema>;

