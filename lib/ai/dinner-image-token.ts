import { createHmac, timingSafeEqual } from "node:crypto";
import type { DinnerSuggestion } from "./dinner-schema";

const tokenKey = () => process.env.DINNER_IMAGE_SIGNING_SECRET || process.env.BENTO_IMAGE_SIGNING_SECRET || process.env.OPENAI_API_KEY || "";

export function signDinnerSuggestion(suggestion: DinnerSuggestion) {
  return createHmac("sha256", tokenKey()).update(JSON.stringify(suggestion)).digest("hex");
}

export function verifyDinnerSuggestion(suggestion: DinnerSuggestion, token: string) {
  const expected = signDinnerSuggestion(suggestion);
  if (expected.length !== token.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(token));
}
