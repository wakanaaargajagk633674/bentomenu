import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { calculateTextCost } from "@/lib/ai/api-cost";
import { normalizeDinnerCandidate } from "@/lib/ai/dinner-budget";
import { buildDinnerCandidatePrompt, DINNER_CANDIDATE_SYSTEM_PROMPT } from "@/lib/ai/dinner-prompt";
import { dinnerCandidatesResponseSchema, dinnerRequestSchema } from "@/lib/ai/dinner-schema";
import { resolveMealSeason } from "@/lib/season-data";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) return Response.json({ error: "OpenAI APIキーが設定されていません。" }, { status: 503 });
  const input = dinnerRequestSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return Response.json({ error: "夜ご飯の条件が正しくありません。" }, { status: 400 });

  try {
    const referenceDate = new Date();
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 240_000, maxRetries: 0 });
    const model = process.env.OPENAI_CANDIDATE_MODEL || process.env.OPENAI_TEXT_MODEL || "gpt-5.6-luna";
    const response = await openai.responses.parse({
      model,
      service_tier: "flex",
      reasoning: { effort: "medium" },
      input: [
        { role: "system", content: DINNER_CANDIDATE_SYSTEM_PROMPT },
        { role: "user", content: buildDinnerCandidatePrompt(input.data, referenceDate) },
      ],
      text: { format: zodTextFormat(dinnerCandidatesResponseSchema, "dinner_candidates") },
      max_output_tokens: 6000,
    });
    if (!response.output_parsed) throw new Error("Structured response was empty");
    const suggestions = response.output_parsed.suggestions.map((candidate) => {
      if (candidate.people !== input.data.people || candidate.cuisine !== input.data.cuisine || candidate.season !== resolveMealSeason(input.data.season, referenceDate)) throw new Error("Dinner conditions mismatch");
      return normalizeDinnerCandidate(candidate, input.data.budgetYen);
    });
    const names = new Set(suggestions.map((item) => item.name.trim()));
    if (names.size !== suggestions.length) throw new Error("Dinner candidates were not distinct");
    return Response.json({
      suggestions,
      usageCost: response.usage ? calculateTextCost("dinner", "candidate", model, response.usage, response.service_tier) : undefined,
    });
  } catch (error) {
    console.error("Dinner suggestion failed", error instanceof Error ? error.message : "Unknown error");
    if (error instanceof OpenAI.APIConnectionTimeoutError) return Response.json({ error: "夜ご飯の候補生成が制限時間を超えました。もう一度お試しください。" }, { status: 504 });
    if (error instanceof OpenAI.APIError && error.status === 429) return Response.json({ error: "現在Flex Processingが混雑しています。少し時間を置いて再度お試しください。" }, { status: 503 });
    if (error instanceof OpenAI.APIError && (error.status === 401 || error.status === 403)) return Response.json({ error: "OpenAI APIキーまたはモデルの利用権限を確認してください。" }, { status: 503 });
    return Response.json({ error: "夜ご飯の候補を生成できませんでした。条件を確認して再度お試しください。" }, { status: 502 });
  }
}
