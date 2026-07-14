import OpenAI from "openai";
import { apiCostHeaders, calculateImageCost } from "@/lib/ai/api-cost";
import { buildDinnerImagePrompt } from "@/lib/ai/dinner-image-prompt";
import { verifyDinnerSuggestion } from "@/lib/ai/dinner-image-token";
import { dinnerImageRequestSchema } from "@/lib/ai/dinner-schema";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) return Response.json({ error: "OpenAI APIキーが設定されていません。" }, { status: 503 });
  const input = dinnerImageRequestSchema.safeParse(await request.json().catch(() => null));
  if (!input.success || !verifyDinnerSuggestion(input.data.suggestion, input.data.imageToken)) {
    return Response.json({ error: "検証済みの夜ご飯データではありません。候補から作り直してください。" }, { status: 400 });
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 240_000, maxRetries: 0 });
    const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
    const result = await openai.images.generate({
      model,
      prompt: buildDinnerImagePrompt(input.data.suggestion),
      n: 1,
      size: "1024x1024",
      quality: "low",
      output_format: "webp",
      output_compression: 82,
      background: "opaque",
    });
    const base64 = result.data?.[0]?.b64_json;
    if (!base64) throw new Error("Image response was empty");
    const cost = calculateImageCost("dinner", model, result.usage, "low");
    return new Response(Buffer.from(base64, "base64"), {
      headers: { "Content-Type": "image/webp", "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff", ...apiCostHeaders(cost) },
    });
  } catch (error) {
    console.error("Dinner image failed", error instanceof Error ? error.message : "Unknown error");
    if (error instanceof OpenAI.APIConnectionTimeoutError) return Response.json({ error: "夜ご飯の写真生成が制限時間を超えました。写真だけ再試行してください。" }, { status: 504 });
    if (error instanceof OpenAI.APIError && (error.status === 401 || error.status === 403)) return Response.json({ error: "画像モデルの利用権限またはAPIキーを確認してください。" }, { status: 503 });
    return Response.json({ error: "夜ご飯の完成写真を生成できませんでした。写真だけ再試行できます。" }, { status: 502 });
  }
}
