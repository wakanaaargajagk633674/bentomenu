import { createHmac, timingSafeEqual } from "node:crypto";
import type { IzakayaSuggestion } from "./izakaya-schema";

const key = () => process.env.IZAKAYA_IMAGE_SIGNING_SECRET || process.env.OPENAI_API_KEY || "";

export function signIzakayaSuggestion(suggestion: IzakayaSuggestion) {
  return createHmac("sha256", key()).update(JSON.stringify(suggestion)).digest("hex");
}

export function verifyIzakayaSuggestion(suggestion: IzakayaSuggestion, token: string) {
  const expected = signIzakayaSuggestion(suggestion);
  return expected.length === token.length && timingSafeEqual(Buffer.from(expected), Buffer.from(token));
}
