import { dinnerCuisineLabels } from "@/lib/dinner-menu-data";
import { mealSeasonLabels } from "@/lib/season-data";
import type { DinnerSuggestion } from "./dinner-schema";

export const DINNER_IMAGE_PROMPT_VERSION = "family-dinner-table-v1";

export function buildDinnerImagePrompt(suggestion: DinnerSuggestion) {
  const dishes = suggestion.photoPlan.dishes.map((dish, index) => (
    `${index + 1}. ${dish.dishId} — ${dish.recipeName}. Finished appearance: ${dish.visualAppearance}. Serveware: ${dish.serveware}. Visible serving count: ${dish.servingCount}.`
  )).join("\n");

  return `Create one photorealistic inspection photograph of a complete homemade family dinner for ${suggestion.people} people. Cuisine: ${dinnerCuisineLabels[suggestion.cuisine]}. Season: ${mealSeasonLabels[suggestion.season]}. Reproduce the validated menu exactly and make every listed dish clearly identifiable. The result must look achievable in a normal Japanese home kitchen, not restaurant luxury styling.

EXACT MENU
${dishes}

MENU DESIGN
The eight-expert meeting selected ${suggestion.photoPlan.focalDishId} as the visual focus.
Table arrangement: ${suggestion.photoPlan.tableArrangement}
Color and texture contrast: ${suggestion.photoPlan.colorContrast}
Portion cue: ${suggestion.photoPlan.portionCue}
Cultural presentation: ${suggestion.photoPlan.culturalPresentation}
Staple food: ${suggestion.photoPlan.staple.name}; ${suggestion.photoPlan.staple.presentation}; visible serving count ${suggestion.photoPlan.staple.servingCount}.
Preserve the cultural presentation logic of ${dinnerCuisineLabels[suggestion.cuisine]}; for mixed cuisine, keep each named dish recognizable instead of blending them into an invented fusion. Reflect this seasonal design: ${suggestion.seasonalDesign}

FAMILY TABLE LAYOUT
Show the entire coordinated meal on a clean household dining table, ready to serve ${suggestion.people} people. Service style: ${suggestion.photoPlan.serviceStyle}. Use ordinary household plates and bowls exactly as specified. Keep realistic portions and practical serving space. Show every dish and the staple with the specified visible serving count; do not hide, merge, duplicate beyond that count, omit, or substitute dishes.

SAFE FINISHED STATE
All meat, fish, eggs, and other proteins are visibly fully cooked. No raw-looking center, pink poultry or ground meat, runny or soft-boiled egg, pooled grease, spilled soup, excessive sauce puddles, or unsafe cross-contamination cues.

CAMERA AND SETTING
Near-overhead 70 degree view, normal perspective, complete table setting in frame, deep depth of field, soft neutral evening window light with warm household ambience, realistic food color, restrained natural sheen, pale wood dining table, 1:1 square composition.

STRICT EXCLUSIONS
No text, logo, price label, store packaging, disposable takeaway containers, hands, people, alcohol, drink, chopsticks crossing food, decorative flowers, cloth props, candles, excessive garnish, impossible gloss, fake plastic food, luxury restaurant plating, visible steam, or food outside its dish.`;
}
