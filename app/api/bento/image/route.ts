import OpenAI from "openai";
import { bentoImageRequestSchema } from "@/lib/ai/bento-schema";
import { buildBentoImagePrompt } from "@/lib/ai/bento-image-prompt";
import { verifyBentoSuggestion } from "@/lib/ai/bento-image-token";
import { apiCostHeaders, calculateImageCost } from "@/lib/ai/api-cost";

export const runtime = "nodejs";
export const maxDuration = 300;

const OPENAI_TIMEOUT_MS = 240_000;

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: "OpenAI APIキーが設定されていません。" }, { status: 503 });
  }

  const input = bentoImageRequestSchema.safeParse(await request.json().catch(() => null));
  if (!input.success || !verifyBentoSuggestion(input.data.suggestion, input.data.imageToken)) {
    return Response.json({ error: "検証済みの献立データではありません。献立から作り直してください。" }, { status: 400 });
  }

  const { suggestion } = input.data;
  const recipeNames = suggestion.recipes.map((item) => item.name).sort();
  const placementNames = suggestion.imageSpec.placements.map((item) => item.recipeName).sort();
  if (recipeNames.length !== placementNames.length || recipeNames.some((name, index) => name !== placementNames[index])) {
    return Response.json({ error: "レシピと盛り付け仕様が一致しないため、写真を生成できません。" }, { status: 422 });
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: OPENAI_TIMEOUT_MS, maxRetries: 0 });
    const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
    const result = await openai.images.generate({
      model,
      prompt: buildBentoImagePrompt(suggestion),
      n: 1,
      size: "1024x1024",
      quality: "medium",
      output_format: "webp",
      output_compression: 82,
      background: "opaque",
    });
    const base64 = result.data?.[0]?.b64_json;
    if (!base64) throw new Error("Image response was empty");

    const cost = calculateImageCost("bento", model, result.usage);
    return new Response(Buffer.from(base64, "base64"), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
        ...apiCostHeaders(cost),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Bento image generation failed", message);
    if (error instanceof OpenAI.APIConnectionTimeoutError) {
      return Response.json({ error: "写真生成が制限時間を超えました。写真だけ再試行してください。" }, { status: 504 });
    }
    if (error instanceof OpenAI.APIError && (error.status === 401 || error.status === 403)) {
      return Response.json({ error: "画像モデルの利用権限またはAPIキーを確認してください。" }, { status: 503 });
    }
    return Response.json({ error: "完成写真を生成できませんでした。写真だけ再試行できます。" }, { status: 502 });
  }
}
