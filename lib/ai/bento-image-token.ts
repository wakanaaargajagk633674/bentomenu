import { createHmac, timingSafeEqual } from "node:crypto";
import type { BentoSuggestion } from "./bento-schema";

const tokenKey = () => process.env.BENTO_IMAGE_SIGNING_SECRET || process.env.OPENAI_API_KEY || "";

export function signBentoSuggestion(suggestion: BentoSuggestion) {
  return createHmac("sha256", tokenKey()).update(JSON.stringify(suggestion)).digest("hex");
}

export function verifyBentoSuggestion(suggestion: BentoSuggestion, token: string) {
  const expected = signBentoSuggestion(suggestion);
  if (expected.length !== token.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(token));
}
