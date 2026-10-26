const RATE_LIMITS = {
  hello: { capacity: 6, refill: 1 },
  action: { capacity: 14, refill: 7 },
  input: { capacity: 80, refill: 45 },
  chat: { capacity: 4, refill: 0.7 },
  tag: { capacity: 12, refill: 6 }
};

export class Security {
  constructor({ maxConnectionsPerIp = 24 } = {}) {
    this.buckets = new Map();
    this.connections = new Map();
    this.maxConnectionsPerIp = maxConnectionsPerIp;
    this.cleanupTimer = setInterval(() => this.cleanup(), 60000);
    this.cleanupTimer.unref?.();
  }

  bucketFor(key, type) {
    const id = `${key}:${type}`;
    let bucket = this.buckets.get(id);
    if (!bucket) {
      const config = RATE_LIMITS[type] || RATE_LIMITS.action;
      bucket = { tokens: config.capacity, capacity: config.capacity, refill: config.refill, updated: Date.now() };
      this.buckets.set(id, bucket);
    }
    return bucket;
  }

  consume(key, type, amount = 1) {
    const bucket = this.bucketFor(key, type);
    const now = Date.now();
    const elapsed = (now - bucket.updated) / 1000;
    bucket.tokens = Math.min(bucket.capacity, bucket.tokens + elapsed * bucket.refill);
    bucket.updated = now;
    if (bucket.tokens < amount) {
      return { ok: false, retryAfter: Math.ceil(((amount - bucket.tokens) / bucket.refill) * 1000) };
    }
    bucket.tokens -= amount;
    return { ok: true };
  }

  tryConnect(ip) {
    const count = this.connections.get(ip) || 0;
    if (count >= this.maxConnectionsPerIp) return false;
    this.connections.set(ip, count + 1);
    return true;
  }

  disconnect(ip) {
    const count = this.connections.get(ip) || 0;
    if (count <= 1) this.connections.delete(ip);
    else this.connections.set(ip, count - 1);
  }

  cleanup() {
    const cutoff = Date.now() - 300000;
    for (const [key, bucket] of this.buckets) {
      if (bucket.updated < cutoff) this.buckets.delete(key);
    }
  }

  close() {
    clearInterval(this.cleanupTimer);
  }
}
