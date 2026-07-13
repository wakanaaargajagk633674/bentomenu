import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { BENTO_CANDIDATE_SYSTEM_PROMPT, buildBentoUserPrompt, resolveBentoSeason } from "@/lib/ai/bento-prompt";
import { bentoRequestSchema, bentoResponseSchema } from "@/lib/ai/bento-schema";
import { assertDistinctChefSuggestions } from "@/lib/ai/chef-quality";
import { calculateTextCost } from "@/lib/ai/api-cost";

export const runtime = "nodejs";
export const maxDuration = 300;

const OPENAI_TIMEOUT_MS = 240_000;

export async function POST(request: Request) {
  const input = bentoRequestSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) {
    return Response.json({ error: "入力条件が正しくありません。" }, { status: 400 });
  }
  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: "OpenAI APIキーが設定されていません。" }, { status: 503 });
  }

  try {
    const referenceDate = new Date();
    const resolvedSeason = resolveBentoSeason(input.data.season, referenceDate);
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: OPENAI_TIMEOUT_MS,
      maxRetries: 0,
    });
    const model = process.env.OPENAI_TEXT_MODEL || "gpt-5.5";
    const response = await openai.responses.parse({
      model,
      service_tier: "flex",
      reasoning: { effort: "medium" },
      input: [
        { role: "system", content: BENTO_CANDIDATE_SYSTEM_PROMPT },
        { role: "user", content: buildBentoUserPrompt(input.data, referenceDate) },
      ],
      text: { format: zodTextFormat(bentoResponseSchema, "bento_suggestions") },
      max_output_tokens: 8000,
    });

    if (!response.output_parsed) {
      console.error("Bento structured response empty", {
        status: response.status,
        incompleteDetails: response.incomplete_details,
        outputTypes: response.output.map((item) => item.type),
      });
      throw new Error("Structured response was empty");
    }

    assertDistinctChefSuggestions(response.output_parsed.suggestions, (item) => item.name, (item) => `${item.tagline}${item.distinctiveFeature}`);

    const normalized = {
      suggestions: response.output_parsed.suggestions.map((suggestion) => {
        const totalVariableCostYen = suggestion.profitPlan.estimatedFoodCostYen
          + suggestion.profitPlan.packagingCostYen
          + suggestion.profitPlan.otherVariableCostYen;
        const estimatedGrossProfitYen = input.data.price - totalVariableCostYen;
        const variableCostRatePercent = Number(((totalVariableCostYen / input.data.price) * 100).toFixed(1));
        return {
          ...suggestion,
          basePrice: input.data.price,
          season: resolvedSeason,
          profitPlan: { ...suggestion.profitPlan, totalVariableCostYen, estimatedGrossProfitYen, variableCostRatePercent },
        };
      }),
    };

    return Response.json({ ...normalized, usageCost: response.usage ? calculateTextCost("bento", "candidate", model, response.usage, response.service_tier) : undefined });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Bento suggestion failed", message);

    if (error instanceof OpenAI.APIConnectionTimeoutError) {
      return Response.json(
        { error: "AIの応答が制限時間を超えました。条件を変えずに、もう一度お試しください。" },
        { status: 504 },
      );
    }

    if (error instanceof OpenAI.APIError) {
      if (error.status === 429) {
        return Response.json({ error: "現在Flex Processingが混雑しています。少し時間を置いて再度お試しください。" }, { status: 503 });
      }
      const status = error.status === 401 || error.status === 403 ? 503 : 502;
      const detail = error.status === 401 || error.status === 403
        ? "OpenAI APIキーまたはモデルの利用権限を確認してください。"
        : "OpenAI APIとの通信に失敗しました。少し時間を置いて再度お試しください。";
      return Response.json({ error: detail }, { status });
    }

    return Response.json(
      { error: "弁当候補の生成に失敗しました。少し時間を置いて再度お試しください。" },
      { status: 502 },
    );
  }
}
