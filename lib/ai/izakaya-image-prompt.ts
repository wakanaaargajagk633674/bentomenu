import type { IzakayaSuggestion } from "./izakaya-schema";

export function buildIzakayaImagePrompt(item: IzakayaSuggestion) {
  const spec = item.photoSpec;
  return `Create one photorealistic commercial inspection photograph of this exact Japanese izakaya daily-special dish. It is one standalone à-la-carte plate, not a bento, set meal, tasting menu, or multiple dishes.

DISH
${item.name}. Concept: ${item.concept}. Exact one-plate ingredients: ${item.recipe.ingredients.join("; ")}. Preparation: ${item.recipe.prepSteps.join(" → ")}. Final service: ${item.recipe.serviceSteps.join(" → ")}.

PLATE AND COMPOSITION
One ${spec.plate.color} ${spec.plate.material} ${spec.plate.shape} plate, ${spec.plate.sizeMm}mm. Plate exactly ${spec.portionGrams}g at ${spec.mainPlacement}, occupying ${spec.footprintPercent}% of the plate. Cut: ${spec.cutShape}; pieces: ${spec.pieceCount}; maximum height ${spec.maxHeightMm}mm. Surface: ${spec.visibleFinish}. Sauce: ${spec.saucePlacement}. Garnish: ${spec.garnish}.

REQUIRED VISIBLE ITEMS
${spec.requiredVisibleItems.join("; ")}

SERVING STATE
${spec.servingState}. Serve at ${item.temperature}. Show realistic freshly finished restaurant food with the correct cooked state, practical portion, and edible garnish only. Preserve cultural integrity through ingredients and technique, not stereotypical props. ${item.culturalAnchor}.

CAMERA
${spec.camera}. Near-overhead 55–70 degree commercial food photography, the complete plate and rim visible, all food in focus, soft neutral restaurant light, realistic color, restrained natural sheen, plain dark-warm tabletop, square composition.

STRICT EXCLUSIONS
Do not add, omit, merge, duplicate, or substitute any ingredient, garnish, sauce, side dish, bowl, or plate. Forbidden: ${spec.forbiddenItems.join("; ")}. No bento container, rice set, soup, pickles, menu card, text, logo, hands, people, chopsticks, cutlery, alcohol glass, flowers, cloth, flags, or decorative props. No raw-looking protein, runny egg unless explicitly in the recipe, artificial plastic texture, excessive steam, gloss, height, or saturation.`;
}
