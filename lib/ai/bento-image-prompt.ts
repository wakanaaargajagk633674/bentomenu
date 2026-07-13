import type { BentoSuggestion } from "./bento-schema";

export const BENTO_IMAGE_PROMPT_VERSION = "bento-photo-v1";

export function buildBentoImagePrompt(suggestion: BentoSuggestion) {
  const container = suggestion.imageSpec.container;
  const recipes = suggestion.recipes.map((recipe, index) => {
    const placement = suggestion.imageSpec.placements.find((item) => item.recipeName === recipe.name);
    return `${index + 1}. ${recipe.name}\nIngredients for exactly one serving: ${recipe.ingredients.join("; ")}\nPreparation: ${recipe.steps.join(" → ")}\nVisible plating: ${placement?.portionGrams ?? "specified"}g at ${placement?.position ?? "assigned compartment"}; footprint ${placement?.footprintPercent ?? "specified"}%; cut ${placement?.cutShape ?? "as prepared"}; pieces ${placement?.pieceCount ?? "one portion"}; maximum height ${placement?.maxHeightMm ?? 40}mm; finish ${placement?.visibleFinish ?? "realistic cooked finish"}; sauce ${placement?.saucePlacement ?? "only as specified"}; garnish ${placement?.garnish ?? "none"}.`;
  }).join("\n\n");

  return `Create one photorealistic commercial inspection photograph of the finished one-serving bento described below. Reproduce the validated recipe and plating specification exactly; this is not a creative variation.

CONTAINER
One lidless ${container.shape} ${container.material} takeaway bento container, ${container.innerColor} interior, ${container.widthMm}mm × ${container.heightMm}mm × ${container.depthMm}mm, ${container.compartments} compartments. The complete container and all four corners must be inside the frame.

EXACT DISHES AND PLACEMENT
${recipes}

REQUIRED VISIBLE ITEMS
${suggestion.imageSpec.requiredVisibleItems.join("; ")}

SERVING STATE AND CULTURAL INTEGRITY
${suggestion.imageSpec.servingState}
The food is fully cooked, cooled for safe bento packing, and shown immediately before closing the lid. No steam, pooled liquid, raw-looking protein, or runny egg. Preserve the cuisine through its actual ingredients, cooking methods, and arrangement—not stereotypical props.

CAMERA AND LIGHT
${suggestion.imageSpec.camera}. Near-overhead 75–85 degree product photography, normal perspective, deep depth of field, every dish clearly visible, soft neutral daylight, realistic color and portion size, restrained natural sheen, plain warm-neutral background, 1:1 square composition.

STRICT EXCLUSIONS
Do not add, omit, merge, duplicate, or substitute any dish, ingredient, garnish, sauce, or compartment. Do not show anything outside the listed recipe. Forbidden: ${suggestion.imageSpec.forbiddenItems.join("; ")}. No text, labels, logo, flags, hands, people, chopsticks, cutlery, flowers, cloth, drinks, tableware, or decorative props. No excessive height; the lid must be able to close. No artificial plastic texture, impossible gloss, exaggerated saturation, or luxury styling.

The result must look like a practical saleable bento made from the exact recipe JSON, not an aspirational serving suggestion.`;
}
