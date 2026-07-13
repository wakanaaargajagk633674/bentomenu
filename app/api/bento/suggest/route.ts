import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { BENTO_SYSTEM_PROMPT, buildBentoUserPrompt } from "@/lib/ai/bento-prompt";
import { bentoRequestSchema, bentoResponseSchema } from "@/lib/ai/bento-schema";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: "OpenAI APIキーが設定されていません。" }, { status: 503 });
  }

  const input = bentoRequestSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) {
    return Response.json({ error: "入力条件が正しくありません。" }, { status: 400 });
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.responses.parse({
      model: "gpt-5.5",
      reasoning: { effort: "high" },
      input: [
        { role: "system", content: BENTO_SYSTEM_PROMPT },
        { role: "user", content: buildBentoUserPrompt(input.data) },
      ],
      text: { format: zodTextFormat(bentoResponseSchema, "bento_suggestions") },
      max_output_tokens: 12000,
    });

    if (!response.output_parsed) {
      throw new Error("Structured response was empty");
    }

    return Response.json(response.output_parsed);
  } catch (error) {
    console.error("Bento suggestion failed", error instanceof Error ? error.message : "Unknown error");
    return Response.json({ error: "弁当候補の生成に失敗しました。少し時間を置いて再度お試しください。" }, { status: 502 });
  }
}

