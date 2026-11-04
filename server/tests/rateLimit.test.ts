import { describe, expect, it } from "vitest";
import { consumeMessageToken, createTokenBucket } from "../src/rateLimit.ts";

describe("token-bucket rate limiter", () => {
  it("allows a burst and then rejects until tokens refill", () => {
    const bucket = createTokenBucket(2, 0);

    expect(consumeMessageToken(bucket, 0, 2, 10)).toBe(true);
    expect(consumeMessageToken(bucket, 0, 2, 10)).toBe(true);
    expect(consumeMessageToken(bucket, 0, 2, 10)).toBe(false);
    expect(bucket.exceeded).toBe(true);
    expect(consumeMessageToken(bucket, 1_000, 2, 10)).toBe(false);
  });

  it("refills tokens over time while under the burst cap", () => {
    const bucket = createTokenBucket(1, 0);

    expect(consumeMessageToken(bucket, 0, 1, 10)).toBe(true);
    expect(consumeMessageToken(bucket, 50, 1, 10)).toBe(false);
    expect(bucket.exceeded).toBe(true);
  });

  it("restores a token after one second at 1 token/s when not exceeded", () => {
    const bucket = createTokenBucket(1, 0);
    expect(consumeMessageToken(bucket, 0, 1, 1)).toBe(true);
    bucket.exceeded = false;
    expect(consumeMessageToken(bucket, 1_000, 1, 1)).toBe(true);
  });
});
