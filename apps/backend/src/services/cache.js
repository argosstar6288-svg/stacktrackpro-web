import Redis from "ioredis";
import { env } from "../config/env.js";

export const redis = new Redis(env.redisUrl, {
  maxRetriesPerRequest: 1,
  enableReadyCheck: false,
  lazyConnect: true,
});

redis.on("error", () => {
  // suppress – unavailability is expected in local dev without Redis
});

function isConnected() {
  return redis.status === "ready";
}

async function ensureConnected() {
  if (redis.status === "wait") {
    try {
      await redis.connect();
    } catch {
      return false;
    }
  }
  return isConnected();
}

export async function getCache(key) {
  try {
    if (!(await ensureConnected())) return null;
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export async function setCache(key, value, ttlSeconds = 43200) {
  try {
    if (!(await ensureConnected())) return;
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch {
    // cache write failure is non-fatal
  }
}

export async function delCache(key) {
  try {
    if (!(await ensureConnected())) return;
    await redis.del(key);
  } catch {
    // cache delete failure is non-fatal
  }
}
