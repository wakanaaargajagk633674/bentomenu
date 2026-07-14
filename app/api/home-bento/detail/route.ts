import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { calculateTextCost } from "@/lib/ai/api-cost";
import { assertChefQualityReviews } from "@/lib/ai/chef-quality";
import { normalizeHomeBentoCandidate } from "@/lib/ai/home-bento-budget";
import { signHomeBentoSuggestion } from "@/lib/ai/home-bento-image-token";
import { buildHomeBentoDetailPrompt, HOME_BENTO_DETAIL_SYSTEM_PROMPT } from "@/lib/ai/home-bento-prompt";
import { homeBentoDetailRequestSchema, homeBentoSuggestionSchema } from "@/lib/ai/home-bento-schema";
import { mealSeasonMatches } from "@/lib/season-data";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) return Response.json({ error: "OpenAI APIキーが設定されていません。" }, { status: 503 });
  const input = homeBentoDetailRequestSchema.safeParse(await request.json().catch(() => null));
  if (!input.success || input.data.candidate.budgetYen !== input.data.conditions.budgetYen || input.data.candidate.targetAgeGroup !== input.data.conditions.ageGroup || !mealSeasonMatches(input.data.conditions.season, input.data.candidate.season)) {
    return Response.json({ error: "選択した家庭用弁当または条件が正しくありません。" }, { status: 400 });
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
        { role: "system", content: HOME_BENTO_DETAIL_SYSTEM_PROMPT },
        { role: "user", content: buildHomeBentoDetailPrompt(conditions, candidate) },
      ],
      text: { format: zodTextFormat(homeBentoSuggestionSchema, "selected_home_bento_detail") },
      max_output_tokens: 16000,
    });
    if (!response.output_parsed) throw new Error("Structured response was empty");
    assertChefQualityReviews([response.output_parsed.qualityReview]);
    const recipeNames = response.output_parsed.recipes.map((item) => item.name).sort();
    const placementNames = response.output_parsed.imageSpec.placements.map((item) => item.recipeName).sort();
    if (recipeNames.length !== placementNames.length || recipeNames.some((name, index) => name !== placementNames[index])) {
      throw new Error("Home bento recipes and image placements do not match");
    }
    const normalizedCandidate = normalizeHomeBentoCandidate(candidate, conditions.budgetYen);
    const totalPortionGrams = response.output_parsed.familyFit.stapleGrams
      + response.output_parsed.familyFit.mainDishGrams
      + response.output_parsed.familyFit.sideDishGrams;
    const normalized = {
      ...response.output_parsed,
      ...normalizedCandidate,
      qualityReview: response.output_parsed.qualityReview,
      recipes: response.output_parsed.recipes,
      familyFit: { ...response.output_parsed.familyFit, totalPortionGrams },
      imageSpec: response.output_parsed.imageSpec,
      safety: response.output_parsed.safety,
      shoppingTips: response.output_parsed.shoppingTips,
    };
    const checked = homeBentoSuggestionSchema.parse(normalized);
    return Response.json({
      suggestion: { ...checked, imageToken: signHomeBentoSuggestion(checked) },
      usageCost: response.usage ? calculateTextCost("bento", "detail", model, response.usage, response.service_tier) : undefined,
    });
  } catch (error) {
    console.error("Home bento detail failed", error instanceof Error ? error.message : "Unknown error");
    if (error instanceof OpenAI.APIConnectionTimeoutError) return Response.json({ error: "家庭用弁当の詳細生成が制限時間を超えました。もう一度お試しください。" }, { status: 504 });
    if (error instanceof OpenAI.APIError && error.status === 429) return Response.json({ error: "現在Flex Processingが混雑しています。少し時間を置いて再度お試しください。" }, { status: 503 });
    if (error instanceof OpenAI.APIError && (error.status === 401 || error.status === 403)) return Response.json({ error: "OpenAI APIキーまたはモデルの利用権限を確認してください。" }, { status: 503 });
    return Response.json({ error: "選択した家庭用弁当の詳細を生成できませんでした。再度お試しください。" }, { status: 502 });
  }
}
