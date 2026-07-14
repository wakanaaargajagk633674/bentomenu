import { homeBentoAgeLabels } from "@/lib/home-bento-data";
import type { HomeBentoSuggestion } from "./home-bento-schema";

export const HOME_BENTO_IMAGE_PROMPT_VERSION = "home-bento-photo-v1";

export function buildHomeBentoImagePrompt(suggestion: HomeBentoSuggestion) {
  const container = suggestion.imageSpec.container;
  const dishes = suggestion.recipes.map((recipe, index) => {
    const placement = suggestion.imageSpec.placements.find((item) => item.recipeName === recipe.name);
    return `${index + 1}. ${recipe.name}: ${recipe.ingredients.join("; ")}. Place ${placement?.portionGrams ?? "specified"}g at ${placement?.position ?? "assigned section"}, footprint ${placement?.footprintPercent ?? "specified"}%, cut ${placement?.cutShape ?? "as specified"}, ${placement?.pieceCount ?? "one portion"}, maximum height ${placement?.maxHeightMm ?? 35}mm, finish ${placement?.visibleFinish ?? "fully cooked"}, sauce ${placement?.saucePlacement ?? "none pooled"}, garnish ${placement?.garnish ?? "none"}.`;
  }).join("\n");

  return `Create one photorealistic inspection photograph of a homemade Japanese family lunchbox for ${homeBentoAgeLabels[suggestion.targetAgeGroup]}. Reproduce the validated one-serving recipe and layout exactly. It must look carefully made in a normal home kitchen, not commercially packaged or restaurant styled.

LUNCHBOX
One clean, lidless, reusable household bento box: ${container.shape}, ${container.material}, ${container.innerColor} interior, ${container.widthMm}mm × ${container.heightMm}mm × ${container.depthMm}mm, ${container.compartments} sections. Rounded practical form, removable dividers or plain food-safe silicone cups only where needed. The complete lunchbox and all four corners are visible.

EXACT FOOD AND LAYOUT
${dishes}

REQUIRED VISIBLE ITEMS
${suggestion.imageSpec.requiredVisibleItems.join("; ")}

SAFE FINISHED STATE
Everything is fully cooked and cooled for safe packing. Age-appropriate bite sizes. No visible steam, pooled liquid, raw-looking protein, pink meat or fish, bones, runny or soft-boiled egg, sharp food picks, toothpicks, flags, character decorations, choking-size round hard foods, or food outside the box.

CAMERA AND SETTING
Near-overhead 80 degree view, normal perspective, deep depth of field, complete box in frame, soft neutral morning daylight, realistic color and household portions, restrained natural sheen, clean pale wooden kitchen table, 1:1 square composition.

STRICT EXCLUSIONS
Do not add, omit, merge, duplicate, or substitute any dish, ingredient, garnish, sauce, or section. No disposable takeaway tray, commercial black plastic container, price label, store packaging, logo, text, hand, person, chopsticks, cutlery, cup, drink, cloth, flower, decorative prop, excessive height, artificial plastic food texture, impossible gloss, or luxury styling.`;
}

