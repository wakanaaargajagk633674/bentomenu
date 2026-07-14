import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { BENTO_DETAIL_SYSTEM_PROMPT, buildBentoDetailUserPrompt, resolveBentoSeason } from "@/lib/ai/bento-prompt";
import { bentoDetailRequestSchema, bentoSuggestionSchema } from "@/lib/ai/bento-schema";
import { signBentoSuggestion } from "@/lib/ai/bento-image-token";
import { assertChefQualityReviews } from "@/lib/ai/chef-quality";
import { calculateTextCost } from "@/lib/ai/api-cost";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) return Response.json({ error: "OpenAI APIキーが設定されていません。" }, { status: 503 });
  const input = bentoDetailRequestSchema.safeParse(await request.json().catch(() => null));
  if (!input.success || input.data.candidate.basePrice !== input.data.conditions.price) {
    return Response.json({ error: "選択した候補または条件が正しくありません。" }, { status: 400 });
  }

  try {
    const referenceDate = new Date();
    const { conditions, candidate } = input.data;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 240_000, maxRetries: 0 });
    const model = process.env.OPENAI_DETAIL_MODEL || process.env.OPENAI_TEXT_MODEL || "gpt-5.6-terra";
    const response = await openai.responses.parse({
      model,
      service_tier: "flex",
      reasoning: { effort: "medium" },
      input: [
        { role: "system", content: BENTO_DETAIL_SYSTEM_PROMPT },
        { role: "user", content: buildBentoDetailUserPrompt(conditions, candidate, referenceDate) },
      ],
      text: { format: zodTextFormat(bentoSuggestionSchema, "selected_bento_detail") },
      max_output_tokens: 16000,
    });
    if (!response.output_parsed) throw new Error("Structured response was empty");
    assertChefQualityReviews([response.output_parsed.qualityReview]);

    const totalVariableCostYen = candidate.profitPlan.estimatedFoodCostYen
      + candidate.profitPlan.packagingCostYen
      + candidate.profitPlan.otherVariableCostYen;
    const estimatedGrossProfitYen = conditions.price - totalVariableCostYen;
    const variableCostRatePercent = Number(((totalVariableCostYen / conditions.price) * 100).toFixed(1));
    const normalized = {
      ...response.output_parsed,
      id: candidate.id,
      cuisine: candidate.cuisine,
      name: candidate.name,
      tagline: candidate.tagline,
      basePrice: conditions.price,
      genders: [conditions.gender],
      areas: [conditions.area],
      season: resolveBentoSeason(conditions.season, referenceDate),
      seasonalDesign: candidate.seasonalDesign,
      colors: candidate.colors,
      flavor: candidate.flavor,
      texture: candidate.texture,
      contents: candidate.contents,
      profitPlan: {
        ...response.output_parsed.profitPlan,
        ...candidate.profitPlan,
        totalVariableCostYen,
        estimatedGrossProfitYen,
        variableCostRatePercent,
      },
    };
    return Response.json({
      suggestion: { ...normalized, imageToken: signBentoSuggestion(normalized) },
      usageCost: response.usage ? calculateTextCost("bento", "detail", model, response.usage, response.service_tier) : undefined,
    });
  } catch (error) {
    console.error("Bento detail failed", error instanceof Error ? error.message : "Unknown error");
    if (error instanceof OpenAI.APIConnectionTimeoutError) return Response.json({ error: "詳細レシピの生成が制限時間を超えました。もう一度お試しください。" }, { status: 504 });
    if (error instanceof OpenAI.APIError && error.status === 429) return Response.json({ error: "現在Flex Processingが混雑しています。少し時間を置いて再度お試しください。" }, { status: 503 });
    if (error instanceof OpenAI.APIError && (error.status === 401 || error.status === 403)) return Response.json({ error: "OpenAI APIキーまたはモデルの利用権限を確認してください。" }, { status: 503 });
    return Response.json({ error: "選択した弁当の詳細レシピを生成できませんでした。再度お試しください。" }, { status: 502 });
  }
}
