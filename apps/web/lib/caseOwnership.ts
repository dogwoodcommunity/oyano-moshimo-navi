export const ANONYMOUS_CASE_TOKEN_PATTERN = /^anon_[a-f0-9]{64}$/i;

export function createAnonymousCaseToken(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  const randomPart = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `anon_${randomPart}`;
}
