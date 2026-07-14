import OpenAI from "openai";
import { apiCostHeaders, calculateImageCost } from "@/lib/ai/api-cost";
import { buildHomeBentoImagePrompt } from "@/lib/ai/home-bento-image-prompt";
import { verifyHomeBentoSuggestion } from "@/lib/ai/home-bento-image-token";
import { homeBentoImageRequestSchema } from "@/lib/ai/home-bento-schema";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) return Response.json({ error: "OpenAI APIキーが設定されていません。" }, { status: 503 });
  const input = homeBentoImageRequestSchema.safeParse(await request.json().catch(() => null));
  if (!input.success || !verifyHomeBentoSuggestion(input.data.suggestion, input.data.imageToken)) {
    return Response.json({ error: "検証済みの家庭用弁当データではありません。候補から作り直してください。" }, { status: 400 });
  }
  const { suggestion } = input.data;
  const recipes = suggestion.recipes.map((item) => item.name).sort();
  const placements = suggestion.imageSpec.placements.map((item) => item.recipeName).sort();
  if (recipes.length !== placements.length || recipes.some((name, index) => name !== placements[index])) {
    return Response.json({ error: "レシピと家庭用弁当箱の配置が一致しないため、写真を生成できません。" }, { status: 422 });
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 240_000, maxRetries: 0 });
    const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
    const result = await openai.images.generate({
      model,
      prompt: buildHomeBentoImagePrompt(suggestion),
      n: 1,
      size: "1024x1024",
      quality: "low",
      output_format: "webp",
      output_compression: 82,
      background: "opaque",
    });
    const base64 = result.data?.[0]?.b64_json;
    if (!base64) throw new Error("Image response was empty");
    const cost = calculateImageCost("bento", model, result.usage, "low");
    return new Response(Buffer.from(base64, "base64"), {
      headers: { "Content-Type": "image/webp", "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff", ...apiCostHeaders(cost) },
    });
  } catch (error) {
    console.error("Home bento image failed", error instanceof Error ? error.message : "Unknown error");
    if (error instanceof OpenAI.APIConnectionTimeoutError) return Response.json({ error: "家庭用弁当の写真生成が制限時間を超えました。写真だけ再試行してください。" }, { status: 504 });
    if (error instanceof OpenAI.APIError && (error.status === 401 || error.status === 403)) return Response.json({ error: "画像モデルの利用権限またはAPIキーを確認してください。" }, { status: 503 });
    return Response.json({ error: "家庭用弁当の完成写真を生成できませんでした。写真だけ再試行できます。" }, { status: 502 });
  }
}

