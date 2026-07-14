import { dinnerCuisineLabels } from "@/lib/dinner-menu-data";
import { mealSeasonLabels } from "@/lib/season-data";
import type { DinnerSuggestion } from "./dinner-schema";

export const DINNER_IMAGE_PROMPT_VERSION = "family-dinner-table-v1";

export function buildDinnerImagePrompt(suggestion: DinnerSuggestion) {
  const dishes = suggestion.recipes.map((recipe, index) => (
    `${index + 1}. ${recipe.role === "main" ? "MAIN DISH" : recipe.role === "soup" ? "SOUP" : "SIDE DISH"} — ${recipe.name}: ${recipe.ingredients.join("; ")}.`
  )).join("\n");

  return `Create one photorealistic inspection photograph of a complete homemade family dinner for ${suggestion.people} people. Cuisine: ${dinnerCuisineLabels[suggestion.cuisine]}. Season: ${mealSeasonLabels[suggestion.season]}. Reproduce the validated menu exactly and make every listed dish clearly identifiable. The result must look achievable in a normal Japanese home kitchen, not restaurant luxury styling.

EXACT MENU
${dishes}

MENU DESIGN
Main dish is the visual focus. Side dishes create deliberate contrasts in color, texture, and intensity. Soup is visibly separate in appropriate household bowls. Preserve the cultural presentation logic of ${dinnerCuisineLabels[suggestion.cuisine]}; for mixed cuisine, keep each named dish recognizable instead of blending them into an invented fusion. Reflect this seasonal design: ${suggestion.seasonalDesign}

FAMILY TABLE LAYOUT
Show the entire coordinated meal on a clean household dining table, ready to serve ${suggestion.people} people. Use ordinary ceramic plates and bowls appropriate to the cuisine. Shared dishes may be centered with sensible individual bowls where culturally appropriate. Keep realistic household portions and practical serving space. Every recipe appears exactly once as a distinct dish; do not hide, merge, duplicate, omit, or substitute dishes.

SAFE FINISHED STATE
All meat, fish, eggs, and other proteins are visibly fully cooked. No raw-looking center, pink poultry or ground meat, runny or soft-boiled egg, pooled grease, spilled soup, excessive sauce puddles, or unsafe cross-contamination cues.

CAMERA AND SETTING
Near-overhead 70 degree view, normal perspective, complete table setting in frame, deep depth of field, soft neutral evening window light with warm household ambience, realistic food color, restrained natural sheen, pale wood dining table, 1:1 square composition.

STRICT EXCLUSIONS
No text, logo, price label, store packaging, disposable takeaway containers, hands, people, alcohol, drink, chopsticks crossing food, decorative flowers, cloth props, candles, excessive garnish, impossible gloss, fake plastic food, luxury restaurant plating, visible steam, or food outside its dish.`;
}
