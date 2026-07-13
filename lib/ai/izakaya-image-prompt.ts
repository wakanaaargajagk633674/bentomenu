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
Serve at ${item.temperature}. Show realistic freshly finished restaurant food with a fully cooked, food-safe appearance, practical portion, and edible garnish only. No visible steam, unintended pooled liquid, raw-looking protein, pink or undercooked meat or fish, soft-boiled egg, runny egg, or unset egg. Preserve cultural integrity through ingredients and technique, not stereotypical props. ${item.culturalAnchor}.

CAMERA
Near-overhead 65 degree commercial food photography, normal perspective, the complete plate and rim visible, all food in focus, soft neutral restaurant light, realistic color and portion size, restrained natural sheen, plain dark-warm tabletop background, square composition.

STRICT EXCLUSIONS
Do not add, omit, merge, duplicate, or substitute any ingredient, garnish, sauce, side dish, bowl, or plate. No extra food, bento container, rice set, soup, pickles, condiment, menu card, text, label, logo, hand, person, chopstick, cutlery, alcohol glass, cup, flower, cloth, flag, package, or decorative prop. No artificial plastic texture, excessive gloss, height, saturation, or luxury styling.`;
}
