/**
 * Cryptographic helpers for LendLoop HMAC SHA-256 webhook signatures and verification.
 * Implements constant-time comparison to prevent timing side-channel attacks.
 */

/**
 * Deterministically formats the canonical payload string to sign.
 * Canonical format: `${timestamp}.${eventId}.${rawBodyJSON}`
 */
export function formatCanonicalPayload(
  timestamp: number,
  eventId: string,
  payload: unknown
): string {
  const jsonStr = typeof payload === "string" ? payload : JSON.stringify(payload);
  return `${timestamp}.${eventId}.${jsonStr}`;
}

/**
 * Computes an HMAC SHA-256 signature over a message using the provided secret.
 * Uses Web Crypto API which is natively available in Node 18+, Edge, and Convex runtimes.
 */
export async function computeHmacSha256(
  secret: string,
  message: string
): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
  const hashArray = Array.from(new Uint8Array(signatureBuffer));
  return hashArray.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Constant-time string comparison to defend against timing attacks.
 * Iterates through the entire maximum length without early return on length mismatch
 * to prevent leaking token or secret length through timing side-channels.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const lenA = a.length;
  const lenB = b.length;
  const maxLen = Math.max(lenA, lenB);
  let mismatch = lenA ^ lenB;
  for (let i = 0; i < maxLen; i++) {
    const charA = i < lenA ? a.charCodeAt(i) : 0;
    const charB = i < lenB ? b.charCodeAt(i) : 0;
    mismatch |= charA ^ charB;
  }
  return mismatch === 0;
}

/**
 * Signs an outbound webhook event.
 */
export async function signWebhookPayload(
  secret: string,
  timestamp: number,
  eventId: string,
  payload: unknown
): Promise<{ signature: string; timestamp: number; eventId: string }> {
  const canonical = formatCanonicalPayload(timestamp, eventId, payload);
  const signature = await computeHmacSha256(secret, canonical);
  return { signature, timestamp, eventId };
}

/**
 * Verifies an inbound or outbound webhook signature with timestamp tolerance.
 * Default max age: 5 minutes (300,000 ms).
 */
export async function verifyWebhookSignature(
  secret: string,
  receivedSignature: string,
  timestamp: number,
  eventId: string,
  payload: unknown,
  options: { maxAgeMs?: number; currentTimeMs?: number } = {}
): Promise<{ valid: boolean; reason?: string }> {
  const maxAgeMs = options.maxAgeMs ?? 300_000;
  const currentTimeMs = options.currentTimeMs ?? Date.now();

  if (!receivedSignature || typeof receivedSignature !== "string") {
    return { valid: false, reason: "Missing or invalid signature format" };
  }
  if (!timestamp || typeof timestamp !== "number" || isNaN(timestamp)) {
    return { valid: false, reason: "Missing or invalid timestamp" };
  }
  if (!eventId || typeof eventId !== "string") {
    return { valid: false, reason: "Missing or invalid eventId" };
  }

  // Reject expired timestamps (older than maxAge) or future timestamps (clock skew > maxAge)
  const timeDifference = Math.abs(currentTimeMs - timestamp);
  if (timeDifference > maxAgeMs) {
    return {
      valid: false,
      reason: `Timestamp outside tolerance window (${timeDifference}ms > ${maxAgeMs}ms)`,
    };
  }

  const canonical = formatCanonicalPayload(timestamp, eventId, payload);
  const expectedSignature = await computeHmacSha256(secret, canonical);

  if (!timingSafeEqual(expectedSignature.toLowerCase(), receivedSignature.toLowerCase())) {
    return { valid: false, reason: "Signature mismatch" };
  }

  return { valid: true };
}
