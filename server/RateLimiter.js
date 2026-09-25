export class RateLimiter {
  constructor(capacity, perSecond) {
    this.capacity = capacity;
    this.perSecond = perSecond;
    this.entries = new Map();
  }
  allow(key, cost = 1, now = Date.now()) {
    const previous = this.entries.get(key) || {
      tokens: this.capacity,
      time: now,
    };
    const tokens = Math.min(
      this.capacity,
      previous.tokens + ((now - previous.time) / 1000) * this.perSecond,
    );
    this.entries.set(key, { tokens: Math.max(0, tokens - cost), time: now });
    return tokens >= cost;
  }
  prune(now = Date.now()) {
    for (const [key, value] of this.entries)
      if (now - value.time > 120000) this.entries.delete(key);
  }
}
