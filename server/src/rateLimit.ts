export type TokenBucket = {
  tokens: number;
  lastRefillAt: number;
  exceeded: boolean;
};

export function createTokenBucket(burst: number, now: number): TokenBucket {
  return {
    tokens: burst,
    lastRefillAt: now,
    exceeded: false,
  };
}

export function consumeMessageToken(
  bucket: TokenBucket,
  now: number,
  burst: number,
  tokensPerSecond: number,
): boolean {
  if (bucket.exceeded) {
    return false;
  }

  const elapsedSeconds = (now - bucket.lastRefillAt) / 1000;
  bucket.tokens = Math.min(
    burst,
    bucket.tokens + elapsedSeconds * tokensPerSecond,
  );
  bucket.lastRefillAt = now;

  if (bucket.tokens < 1) {
    bucket.exceeded = true;
    return false;
  }

  bucket.tokens -= 1;
  return true;
}
