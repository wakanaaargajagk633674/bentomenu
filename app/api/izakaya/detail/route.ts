import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { IZAKAYA_DETAIL_SYSTEM_PROMPT, buildIzakayaDetailUserPrompt } from "@/lib/ai/izakaya-prompt";
import { izakayaDetailRequestSchema, izakayaSuggestionSchema } from "@/lib/ai/izakaya-schema";
import { signIzakayaSuggestion } from "@/lib/ai/izakaya-image-token";
import { assertChefQualityReviews } from "@/lib/ai/chef-quality";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) return Response.json({ error: "OpenAI APIキーが設定されていません。" }, { status: 503 });
  const input = izakayaDetailRequestSchema.safeParse(await request.json().catch(() => null));
  if (!input.success || input.data.candidate.basePrice !== input.data.conditions.price) {
    return Response.json({ error: "選択した候補または条件が正しくありません。" }, { status: 400 });
  }

  try {
    const { conditions, candidate } = input.data;
    const currentDate = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "full" }).format(new Date());
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 240_000, maxRetries: 0 });
    const response = await openai.responses.parse({
      model: process.env.OPENAI_TEXT_MODEL || "gpt-5.5",
      service_tier: "flex",
      reasoning: { effort: "medium" },
      input: [
        { role: "system", content: IZAKAYA_DETAIL_SYSTEM_PROMPT },
        { role: "user", content: buildIzakayaDetailUserPrompt(conditions, candidate, currentDate) },
      ],
      text: { format: zodTextFormat(izakayaSuggestionSchema, "selected_izakaya_detail") },
      max_output_tokens: 16000,
    });
    if (!response.output_parsed) throw new Error("Structured response was empty");
    assertChefQualityReviews([response.output_parsed.qualityReview]);

    const totalVariableCostYen = candidate.profitPlan.estimatedFoodCostYen + candidate.profitPlan.otherVariableCostYen;
    const estimatedGrossProfitYen = conditions.price - totalVariableCostYen;
    const variableCostRatePercent = Number(((totalVariableCostYen / conditions.price) * 100).toFixed(1));
    const normalized = {
      ...response.output_parsed,
      id: candidate.id,
      cuisine: candidate.cuisine,
      name: candidate.name,
      tagline: candidate.tagline,
      basePrice: conditions.price,
      menuType: "daily-special" as const,
      drinkPairing: candidate.drinkPairing,
      concept: `${candidate.composition}／特徴: ${candidate.distinctiveFeature}`,
      flavor: candidate.flavor,
      operations: { ...response.output_parsed.operations, orderToServeMinutes: candidate.orderToServeMinutes },
      profitPlan: {
        ...response.output_parsed.profitPlan,
        ...candidate.profitPlan,
        totalVariableCostYen,
        estimatedGrossProfitYen,
        variableCostRatePercent,
      },
    };
    return Response.json({ suggestion: { ...normalized, imageToken: signIzakayaSuggestion(normalized) } });
  } catch (error) {
    console.error("Izakaya detail failed", error instanceof Error ? error.message : "Unknown error");
    if (error instanceof OpenAI.APIConnectionTimeoutError) return Response.json({ error: "詳細レシピの生成が制限時間を超えました。もう一度お試しください。" }, { status: 504 });
    if (error instanceof OpenAI.APIError && error.status === 429) return Response.json({ error: "現在Flex Processingが混雑しています。少し時間を置いて再度お試しください。" }, { status: 503 });
    if (error instanceof OpenAI.APIError && (error.status === 401 || error.status === 403)) return Response.json({ error: "OpenAI APIキーまたはモデルの利用権限を確認してください。" }, { status: 503 });
    return Response.json({ error: "選択した逸品の詳細レシピを生成できませんでした。再度お試しください。" }, { status: 502 });
  }
}
