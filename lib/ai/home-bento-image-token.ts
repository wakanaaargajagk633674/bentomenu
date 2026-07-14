import { createHmac, timingSafeEqual } from "node:crypto";
import type { HomeBentoSuggestion } from "./home-bento-schema";

const tokenKey = () => process.env.BENTO_IMAGE_SIGNING_SECRET || process.env.OPENAI_API_KEY || "";

export function signHomeBentoSuggestion(suggestion: HomeBentoSuggestion) {
  return createHmac("sha256", tokenKey()).update(JSON.stringify(suggestion)).digest("hex");
}

export function verifyHomeBentoSuggestion(suggestion: HomeBentoSuggestion, token: string) {
  const expected = signHomeBentoSuggestion(suggestion);
  if (expected.length !== token.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(token));
}

