import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { IZAKAYA_CANDIDATE_SYSTEM_PROMPT, buildIzakayaUserPrompt } from "@/lib/ai/izakaya-prompt";
import { izakayaRequestSchema, izakayaResponseSchema } from "@/lib/ai/izakaya-schema";
import { assertDistinctChefSuggestions } from "@/lib/ai/chef-quality";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) return Response.json({ error: "OpenAI APIキーが設定されていません。" }, { status: 503 });
  const input = izakayaRequestSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return Response.json({ error: "入力条件が正しくありません。" }, { status: 400 });

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 240_000, maxRetries: 0 });
    const response = await openai.responses.parse({
      model: process.env.OPENAI_TEXT_MODEL || "gpt-5.5",
      service_tier: "flex",
      reasoning: { effort: "medium" },
      input: [
        { role: "system", content: IZAKAYA_CANDIDATE_SYSTEM_PROMPT },
        { role: "user", content: buildIzakayaUserPrompt(input.data, new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "full" }).format(new Date())) },
      ],
      text: { format: zodTextFormat(izakayaResponseSchema, "izakaya_daily_specials") },
      max_output_tokens: 8000,
    });
    if (!response.output_parsed) throw new Error("Structured response was empty");

    assertDistinctChefSuggestions(response.output_parsed.suggestions, (item) => item.name, (item) => `${item.composition}${item.distinctiveFeature}`);

    return Response.json({ suggestions: response.output_parsed.suggestions.map((suggestion) => {
      const totalVariableCostYen = suggestion.profitPlan.estimatedFoodCostYen + suggestion.profitPlan.otherVariableCostYen;
      const estimatedGrossProfitYen = input.data.price - totalVariableCostYen;
      const variableCostRatePercent = Number(((totalVariableCostYen / input.data.price) * 100).toFixed(1));
      return { ...suggestion, basePrice: input.data.price, menuType: "daily-special" as const, profitPlan: { ...suggestion.profitPlan, totalVariableCostYen, estimatedGrossProfitYen, variableCostRatePercent } };
    }) });
  } catch (error) {
    console.error("Izakaya suggestion failed", error instanceof Error ? error.message : "Unknown error");
    if (error instanceof OpenAI.APIConnectionTimeoutError) return Response.json({ error: "AIの応答が制限時間を超えました。もう一度お試しください。" }, { status: 504 });
    if (error instanceof OpenAI.APIError && error.status === 429) return Response.json({ error: "現在Flex Processingが混雑しています。少し時間を置いて再度お試しください。" }, { status: 503 });
    if (error instanceof OpenAI.APIError && (error.status === 401 || error.status === 403)) return Response.json({ error: "OpenAI APIキーまたはモデルの利用権限を確認してください。" }, { status: 503 });
    return Response.json({ error: "日替わりの逸品を生成できませんでした。少し時間を置いて再度お試しください。" }, { status: 502 });
  }
}
