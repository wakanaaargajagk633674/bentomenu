import type { ResponseUsage } from "openai/resources/responses/responses";

export type ApiUsageOperation = "candidate" | "detail" | "image";
export type ApiUsageMenuKind = "bento" | "izakaya";

export type ApiCostRecord = {
  menuKind: ApiUsageMenuKind;
  operation: ApiUsageOperation;
  model: string;
  serviceTier: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  usdJpyRate: number;
  estimatedCostJpy: number;
  isEstimate: boolean;
  pricingBasis: string;
  pricingSource: string;
};

const PRICING_SOURCE = "https://developers.openai.com/api/docs/pricing";
const IMAGE_PRICING_SOURCE = "https://developers.openai.com/api/docs/guides/image-generation#calculating-costs";
const GPT_55_RATES = {
  flex: { input: 2.5, cachedInput: 0.25, output: 15, label: "Flex" },
  default: { input: 5, cachedInput: 0.5, output: 30, label: "Standard" },
  priority: { input: 12.5, cachedInput: 1.25, output: 75, label: "Priority" },
} as const;
const GPT_IMAGE_2 = { textInput: 5, imageInput: 8, output: 30, mediumSquareEstimate: 0.053 };

function usdJpyRate() {
  const configured = Number(process.env.OPENAI_COST_USD_JPY_RATE || "160");
  return Number.isFinite(configured) && configured > 0 ? configured : 160;
}

function finish(record: Omit<ApiCostRecord, "usdJpyRate" | "estimatedCostJpy">): ApiCostRecord {
  const rate = usdJpyRate();
  return {
    ...record,
    estimatedCostUsd: Number(record.estimatedCostUsd.toFixed(8)),
    usdJpyRate: rate,
    estimatedCostJpy: Number((record.estimatedCostUsd * rate).toFixed(4)),
  };
}

export function calculateTextCost(menuKind: ApiUsageMenuKind, operation: "candidate" | "detail", model: string, usage: ResponseUsage, actualServiceTier: string | null | undefined = "flex"): ApiCostRecord {
  const cachedInputTokens = Math.min(usage.input_tokens, Math.max(0, usage.input_tokens_details.cached_tokens || 0));
  const uncachedInputTokens = usage.input_tokens - cachedInputTokens;
  const resolvedServiceTier = actualServiceTier || "flex";
  const hasExactTierPrice = resolvedServiceTier === "flex" || resolvedServiceTier === "default" || resolvedServiceTier === "priority";
  const rateKey = resolvedServiceTier === "priority" ? "priority" : resolvedServiceTier === "flex" ? "flex" : "default";
  const rates = GPT_55_RATES[rateKey];
  const estimatedCostUsd = (
    uncachedInputTokens * rates.input
    + cachedInputTokens * rates.cachedInput
    + usage.output_tokens * rates.output
  ) / 1_000_000;
  return finish({
    menuKind,
    operation,
    model,
    serviceTier: resolvedServiceTier,
    inputTokens: usage.input_tokens,
    cachedInputTokens,
    outputTokens: usage.output_tokens,
    estimatedCostUsd,
    isEstimate: model !== "gpt-5.5" || !hasExactTierPrice,
    pricingBasis: model === "gpt-5.5" && hasExactTierPrice
      ? `gpt-5.5 ${rates.label}短コンテキスト: 入力$${rates.input.toFixed(2)}・キャッシュ入力$${rates.cachedInput.toFixed(2)}・出力$${rates.output.toFixed(2)} / 100万トークン`
      : `gpt-5.5 ${rates.label}単価による暫定計算（設定モデルまたは処理tierの単価確認が必要）`,
    pricingSource: PRICING_SOURCE,
  });
}

type ImageUsage = {
  input_tokens?: number;
  output_tokens?: number;
  input_tokens_details?: { text_tokens?: number; image_tokens?: number };
};

export function calculateImageCost(menuKind: ApiUsageMenuKind, model: string, usage?: ImageUsage): ApiCostRecord {
  const textTokens = usage?.input_tokens_details?.text_tokens || usage?.input_tokens || 0;
  const imageTokens = usage?.input_tokens_details?.image_tokens || 0;
  const outputTokens = usage?.output_tokens || 0;
  const hasUsage = textTokens > 0 || imageTokens > 0 || outputTokens > 0;
  const estimatedCostUsd = hasUsage
    ? (textTokens * GPT_IMAGE_2.textInput + imageTokens * GPT_IMAGE_2.imageInput + outputTokens * GPT_IMAGE_2.output) / 1_000_000
    : GPT_IMAGE_2.mediumSquareEstimate;
  return finish({
    menuKind,
    operation: "image",
    model,
    serviceTier: "standard",
    inputTokens: textTokens + imageTokens,
    cachedInputTokens: 0,
    outputTokens,
    estimatedCostUsd,
    isEstimate: !hasUsage || model !== "gpt-image-2",
    pricingBasis: hasUsage
      ? "GPT Image 2: テキスト入力$5・画像入力$8・出力$30 / 100万トークン"
      : "GPT Image 2・1024×1024・mediumの公式1枚見積 $0.053（API usage未返却）",
    pricingSource: hasUsage ? PRICING_SOURCE : IMAGE_PRICING_SOURCE,
  });
}

export function apiCostHeaders(cost: ApiCostRecord) {
  return {
    "X-API-Cost-USD": String(cost.estimatedCostUsd),
    "X-API-Cost-JPY": String(cost.estimatedCostJpy),
    "X-API-Cost-Rate": String(cost.usdJpyRate),
    "X-API-Input-Tokens": String(cost.inputTokens),
    "X-API-Cached-Tokens": String(cost.cachedInputTokens),
    "X-API-Output-Tokens": String(cost.outputTokens),
    "X-API-Cost-Estimated": cost.isEstimate ? "1" : "0",
    "X-API-Cost-Basis": encodeURIComponent(cost.pricingBasis),
    "X-API-Pricing-Source": cost.pricingSource,
    "X-API-Model": cost.model,
  };
}
