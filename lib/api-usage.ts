import { ensureMenuLibraryUser } from "@/lib/saved-menus";
import { supabase } from "@/lib/supabase/client";
import type { ApiCostRecord } from "@/lib/ai/api-cost";

export type ApiUsageRow = {
  id: string;
  menu_kind: "bento" | "izakaya" | "dinner";
  operation: "candidate" | "detail" | "image";
  model: string;
  service_tier: string;
  input_tokens: number;
  cached_input_tokens: number;
  output_tokens: number;
  estimated_cost_usd: number;
  usd_jpy_rate: number;
  estimated_cost_jpy: number;
  is_estimate: boolean;
  pricing_basis: string;
  pricing_source: string;
  created_at: string;
};

export async function recordApiUsage(cost: ApiCostRecord) {
  const user = await ensureMenuLibraryUser();
  const { error } = await supabase.from("api_usage_records").insert({
    owner_id: user.id,
    menu_kind: cost.menuKind,
    operation: cost.operation,
    model: cost.model,
    service_tier: cost.serviceTier,
    input_tokens: cost.inputTokens,
    cached_input_tokens: cost.cachedInputTokens,
    output_tokens: cost.outputTokens,
    estimated_cost_usd: cost.estimatedCostUsd,
    usd_jpy_rate: cost.usdJpyRate,
    estimated_cost_jpy: cost.estimatedCostJpy,
    is_estimate: cost.isEstimate,
    pricing_basis: cost.pricingBasis,
    pricing_source: cost.pricingSource,
  });
  if (error) throw error;
}

export async function listApiUsage() {
  await ensureMenuLibraryUser();
  const { data, error } = await supabase.from("api_usage_records")
    .select("id,menu_kind,operation,model,service_tier,input_tokens,cached_input_tokens,output_tokens,estimated_cost_usd,usd_jpy_rate,estimated_cost_jpy,is_estimate,pricing_basis,pricing_source,created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ApiUsageRow[];
}

export function readImageCostHeaders(headers: Headers, menuKind: "bento" | "izakaya" | "dinner"): ApiCostRecord | null {
  const usd = Number(headers.get("X-API-Cost-USD"));
  const jpy = Number(headers.get("X-API-Cost-JPY"));
  const rate = Number(headers.get("X-API-Cost-Rate"));
  if (!Number.isFinite(usd) || !Number.isFinite(jpy) || !Number.isFinite(rate)) return null;
  return {
    menuKind,
    operation: "image",
    model: headers.get("X-API-Model") || "gpt-image-2",
    serviceTier: "standard",
    inputTokens: Number(headers.get("X-API-Input-Tokens")) || 0,
    cachedInputTokens: Number(headers.get("X-API-Cached-Tokens")) || 0,
    outputTokens: Number(headers.get("X-API-Output-Tokens")) || 0,
    estimatedCostUsd: usd,
    usdJpyRate: rate,
    estimatedCostJpy: jpy,
    isEstimate: headers.get("X-API-Cost-Estimated") === "1",
    pricingBasis: decodeURIComponent(headers.get("X-API-Cost-Basis") || ""),
    pricingSource: headers.get("X-API-Pricing-Source") || "https://developers.openai.com/api/docs/pricing",
  };
}
