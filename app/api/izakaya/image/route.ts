import OpenAI from "openai";
import { izakayaImageRequestSchema } from "@/lib/ai/izakaya-schema";
import { buildIzakayaImagePrompt } from "@/lib/ai/izakaya-image-prompt";
import { verifyIzakayaSuggestion } from "@/lib/ai/izakaya-image-token";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) return Response.json({ error: "OpenAI APIキーが設定されていません。" }, { status: 503 });
  const input = izakayaImageRequestSchema.safeParse(await request.json().catch(() => null));
  if (!input.success || !verifyIzakayaSuggestion(input.data.suggestion, input.data.imageToken)) {
    return Response.json({ error: "検証済みの逸品データではありません。逸品案から作り直してください。" }, { status: 400 });
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 240_000, maxRetries: 0 });
    const result = await openai.images.generate({
      model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
      prompt: buildIzakayaImagePrompt(input.data.suggestion),
      n: 1,
      size: "1024x1024",
      quality: "medium",
      output_format: "webp",
      output_compression: 82,
      background: "opaque",
    });
    const base64 = result.data?.[0]?.b64_json;
    if (!base64) throw new Error("Image response was empty");
    return new Response(Buffer.from(base64, "base64"), { headers: { "Content-Type": "image/webp", "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    console.error("Izakaya image failed", error instanceof Error ? error.message : "Unknown error");
    if (error instanceof OpenAI.APIConnectionTimeoutError) return Response.json({ error: "写真生成が制限時間を超えました。写真だけ再試行してください。" }, { status: 504 });
    if (error instanceof OpenAI.APIError && (error.status === 401 || error.status === 403)) return Response.json({ error: "画像モデルの利用権限を確認してください。" }, { status: 503 });
    return Response.json({ error: "完成写真を生成できませんでした。写真だけ再試行できます。" }, { status: 502 });
  }
}
