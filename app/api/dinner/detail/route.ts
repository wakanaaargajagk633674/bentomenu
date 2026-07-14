import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { calculateTextCost } from "@/lib/ai/api-cost";
import { normalizeDinnerCandidate } from "@/lib/ai/dinner-budget";
import { signDinnerSuggestion } from "@/lib/ai/dinner-image-token";
import { buildDinnerDetailPrompt, DINNER_DETAIL_SYSTEM_PROMPT } from "@/lib/ai/dinner-prompt";
import { dinnerDetailRequestSchema, dinnerSuggestionSchema, type DinnerSuggestion } from "@/lib/ai/dinner-schema";
import { mealSeasonMatches } from "@/lib/season-data";
import { DINNER_CLIENT_VERSION } from "@/lib/dinner-client-version";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) return Response.json({ error: "OpenAI APIキーが設定されていません。" }, { status: 503 });
  if (request.headers.get("X-Dinner-Client-Version") !== DINNER_CLIENT_VERSION) {
    return Response.json({ error: "画面が更新前の状態です。夜ご飯ページを再読み込みしてから、もう一度お試しください。", reloadRequired: true }, { status: 409 });
  }
  const input = dinnerDetailRequestSchema.safeParse(await request.json().catch(() => null));
  if (!input.success || input.data.candidate.people !== input.data.conditions.people || input.data.candidate.cuisine !== input.data.conditions.cuisine || !mealSeasonMatches(input.data.conditions.season, input.data.candidate.season)) {
    return Response.json({ error: "選択した夜ご飯または条件が正しくありません。" }, { status: 400 });
  }

  try {
    const { conditions, candidate } = input.data;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 240_000, maxRetries: 0 });
    const model = process.env.OPENAI_DETAIL_MODEL || process.env.OPENAI_TEXT_MODEL || "gpt-5.6-terra";
    const response = await openai.responses.parse({
      model,
      service_tier: "flex",
      reasoning: { effort: "medium" },
      input: [
        { role: "system", content: DINNER_DETAIL_SYSTEM_PROMPT },
        { role: "user", content: buildDinnerDetailPrompt(conditions, candidate) },
      ],
      text: { format: zodTextFormat(dinnerSuggestionSchema, "selected_dinner_detail") },
      max_output_tokens: 10000,
    });
    if (!response.output_parsed) throw new Error("Structured response was empty");

    const normalizedCandidate = normalizeDinnerCandidate(candidate, conditions.budgetYen);
    const sideDishIds = ["side-1", "side-2", "side-3", "side-4", "side-5", "side-6"] as const;
    const expectedDishes: Array<{ dishId: DinnerSuggestion["recipes"][number]["dishId"]; name: string; role: DinnerSuggestion["recipes"][number]["role"] }> = [
      { dishId: "main", name: candidate.mainDish, role: "main" },
      ...candidate.sideDishes.map((name, index) => ({ dishId: sideDishIds[index], name, role: "side" as const })),
      { dishId: "soup", name: candidate.soup, role: "soup" },
    ];
    const recipeMap = new Map(response.output_parsed.recipes.map((recipe) => [recipe.dishId, recipe]));
    const photoDishMap = new Map(response.output_parsed.photoPlan.dishes.map((dish) => [dish.dishId, dish]));
    if (recipeMap.size !== expectedDishes.length || photoDishMap.size !== expectedDishes.length || response.output_parsed.photoPlan.focalDishId !== "main" || response.output_parsed.photoPlan.staple.servingCount !== conditions.people) {
      throw new Error("Dinner recipes and photo plan do not match the selected menu");
    }
    const normalizedRecipes = expectedDishes.map((expected) => {
      const recipe = recipeMap.get(expected.dishId);
      if (!recipe || recipe.role !== expected.role) throw new Error("Dinner recipe dish IDs do not match");
      return { ...recipe, name: expected.name };
    });
    const normalizedPhotoDishes = expectedDishes.map((expected) => {
      const dish = photoDishMap.get(expected.dishId);
      if (!dish) throw new Error("Dinner photo dish IDs do not match");
      return { ...dish, recipeName: expected.name };
    });

    const checked = dinnerSuggestionSchema.parse({
      ...response.output_parsed,
      ...normalizedCandidate,
      recipes: normalizedRecipes,
      cookingSchedule: response.output_parsed.cookingSchedule,
      servingPlan: response.output_parsed.servingPlan,
      nutritionBalance: response.output_parsed.nutritionBalance,
      shoppingTips: response.output_parsed.shoppingTips,
      safety: response.output_parsed.safety,
      allergens: response.output_parsed.allergens,
      photoPlan: { ...response.output_parsed.photoPlan, dishes: normalizedPhotoDishes },
      expertConclusion: response.output_parsed.expertConclusion,
    });
    return Response.json({
      suggestion: { ...checked, imageToken: signDinnerSuggestion(checked) },
      usageCost: response.usage ? calculateTextCost("dinner", "detail", model, response.usage, response.service_tier) : undefined,
    });
  } catch (error) {
    console.error("Dinner detail failed", error instanceof Error ? error.message : "Unknown error");
    if (error instanceof OpenAI.APIConnectionTimeoutError) return Response.json({ error: "夜ご飯の詳細生成が制限時間を超えました。もう一度お試しください。" }, { status: 504 });
    if (error instanceof OpenAI.APIError && error.status === 429) return Response.json({ error: "現在Flex Processingが混雑しています。少し時間を置いて再度お試しください。" }, { status: 503 });
    if (error instanceof OpenAI.APIError && (error.status === 401 || error.status === 403)) return Response.json({ error: "OpenAI APIキーまたはモデルの利用権限を確認してください。" }, { status: 503 });
    return Response.json({ error: "選択した夜ご飯の詳細を生成できませんでした。再度お試しください。" }, { status: 502 });
  }
}
