import { describe, it, expect } from "vitest";
import {
  computeHmacSha256,
  signWebhookPayload,
  verifyWebhookSignature,
  timingSafeEqual,
} from "../../convex/lib/crypto";

describe("Webhook Cryptography & Security", () => {
  const secret = "test-secret-key-32-bytes-long-min!!";
  const eventId = "123e4567-e89b-12d3-a456-426614174000";
  const payload = {
    eventType: "borrow_request.created",
    toolName: "Cordless Drill",
    status: "pending",
  };

  it("computes reproducible HMAC SHA-256 signatures", async () => {
    const sig1 = await computeHmacSha256(secret, "sample-message");
    const sig2 = await computeHmacSha256(secret, "sample-message");
    expect(sig1).toBe(sig2);
    expect(sig1.length).toBe(64); // 256 bits = 64 hex characters
  });

  it("signs and verifies valid webhook payloads", async () => {
    const timestamp = Date.now();
    const { signature } = await signWebhookPayload(secret, timestamp, eventId, payload);

    const verification = await verifyWebhookSignature(
      secret,
      signature,
      timestamp,
      eventId,
      payload,
      { currentTimeMs: timestamp + 1000 } // 1 second later
    );

    expect(verification.valid).toBe(true);
  });

  it("rejects tampered payloads", async () => {
    const timestamp = Date.now();
    const { signature } = await signWebhookPayload(secret, timestamp, eventId, payload);

    const tamperedPayload = { ...payload, toolName: "Hacked Tool" };
    const verification = await verifyWebhookSignature(
      secret,
      signature,
      timestamp,
      eventId,
      tamperedPayload,
      { currentTimeMs: timestamp }
    );

    expect(verification.valid).toBe(false);
    expect(verification.reason).toContain("Signature mismatch");
  });

  it("rejects expired timestamps (replay attack prevention)", async () => {
    const timestamp = Date.now() - 400_000; // 400 seconds ago (tolerance is 300s)
    const { signature } = await signWebhookPayload(secret, timestamp, eventId, payload);

    const verification = await verifyWebhookSignature(
      secret,
      signature,
      timestamp,
      eventId,
      payload,
      { currentTimeMs: Date.now(), maxAgeMs: 300_000 }
    );

    expect(verification.valid).toBe(false);
    expect(verification.reason).toContain("Timestamp outside tolerance window");
  });

  it("performs constant-time string comparison", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true);
    expect(timingSafeEqual("abc", "abd")).toBe(false);
    expect(timingSafeEqual("abc", "abcd")).toBe(false);
  });
});
