import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { calculateTextCost } from "@/lib/ai/api-cost";
import { normalizeDinnerCandidate } from "@/lib/ai/dinner-budget";
import { buildDinnerDetailPrompt, DINNER_DETAIL_SYSTEM_PROMPT } from "@/lib/ai/dinner-prompt";
import { dinnerDetailRequestSchema, dinnerSuggestionSchema } from "@/lib/ai/dinner-schema";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) return Response.json({ error: "OpenAI APIキーが設定されていません。" }, { status: 503 });
  const input = dinnerDetailRequestSchema.safeParse(await request.json().catch(() => null));
  if (!input.success || input.data.candidate.people !== input.data.conditions.people || input.data.candidate.cuisine !== input.data.conditions.cuisine) {
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
    const mainRecipes = response.output_parsed.recipes.filter((item) => item.role === "main");
    const sideRecipes = response.output_parsed.recipes.filter((item) => item.role === "side");
    const soupRecipes = response.output_parsed.recipes.filter((item) => item.role === "soup");
    if (mainRecipes.length !== 1 || sideRecipes.length !== candidate.sideDishes.length || soupRecipes.length !== 1) {
      throw new Error("Dinner recipe roles do not match the required structure");
    }
    const normalizedRecipes = [
      { ...mainRecipes[0], name: candidate.mainDish },
      ...sideRecipes.map((recipe, index) => ({ ...recipe, name: candidate.sideDishes[index] })),
      { ...soupRecipes[0], name: candidate.soup },
    ];

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
      expertConclusion: response.output_parsed.expertConclusion,
    });
    return Response.json({
      suggestion: checked,
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
