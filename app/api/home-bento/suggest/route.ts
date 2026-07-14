import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { calculateTextCost } from "@/lib/ai/api-cost";
import { assertDistinctChefSuggestions } from "@/lib/ai/chef-quality";
import { normalizeHomeBentoCandidate } from "@/lib/ai/home-bento-budget";
import { buildHomeBentoCandidatePrompt, HOME_BENTO_CANDIDATE_SYSTEM_PROMPT } from "@/lib/ai/home-bento-prompt";
import { homeBentoCandidatesResponseSchema, homeBentoRequestSchema } from "@/lib/ai/home-bento-schema";
import { resolveMealSeason } from "@/lib/season-data";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) return Response.json({ error: "OpenAI APIキーが設定されていません。" }, { status: 503 });
  const input = homeBentoRequestSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return Response.json({ error: "家庭用弁当の条件が正しくありません。" }, { status: 400 });

  try {
    const referenceDate = new Date();
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 240_000, maxRetries: 0 });
    const model = process.env.OPENAI_CANDIDATE_MODEL || process.env.OPENAI_TEXT_MODEL || "gpt-5.6-luna";
    const response = await openai.responses.parse({
      model,
      service_tier: "flex",
      reasoning: { effort: "medium" },
      input: [
        { role: "system", content: HOME_BENTO_CANDIDATE_SYSTEM_PROMPT },
        { role: "user", content: buildHomeBentoCandidatePrompt(input.data, referenceDate) },
      ],
      text: { format: zodTextFormat(homeBentoCandidatesResponseSchema, "home_bento_candidates") },
      max_output_tokens: 8000,
    });
    if (!response.output_parsed) throw new Error("Structured response was empty");
    const suggestions = response.output_parsed.suggestions.map((candidate) => {
      if (candidate.targetAgeGroup !== input.data.ageGroup || candidate.season !== resolveMealSeason(input.data.season, referenceDate)) throw new Error("Home bento conditions mismatch");
      return normalizeHomeBentoCandidate(candidate, input.data.budgetYen);
    });
    assertDistinctChefSuggestions(suggestions, (item) => item.name, (item) => `${item.tagline}${item.distinctiveFeature}`);
    return Response.json({
      suggestions,
      usageCost: response.usage ? calculateTextCost("bento", "candidate", model, response.usage, response.service_tier) : undefined,
    });
  } catch (error) {
    console.error("Home bento suggestion failed", error instanceof Error ? error.message : "Unknown error");
    if (error instanceof OpenAI.APIConnectionTimeoutError) return Response.json({ error: "家庭用弁当の候補生成が制限時間を超えました。もう一度お試しください。" }, { status: 504 });
    if (error instanceof OpenAI.APIError && error.status === 429) return Response.json({ error: "現在Flex Processingが混雑しています。少し時間を置いて再度お試しください。" }, { status: 503 });
    if (error instanceof OpenAI.APIError && (error.status === 401 || error.status === 403)) return Response.json({ error: "OpenAI APIキーまたはモデルの利用権限を確認してください。" }, { status: 503 });
    return Response.json({ error: "家庭用弁当の候補を生成できませんでした。条件を確認して再度お試しください。" }, { status: 502 });
  }
}
