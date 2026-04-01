import Redis from "ioredis";
import { env } from "../config/env.js";

export const redis = new Redis(env.redisUrl, {
  maxRetriesPerRequest: 2,
  enableReadyCheck: true,
  lazyConnect: true,
});

redis.on("error", (error) => {
  console.warn("[cache] redis unavailable:", error.message);
});

export async function getCache(key) {
  if (redis.status === "wait") {
    try {
      await redis.connect();
    } catch {
      return null;
    }
  }

  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
}

export async function setCache(key, value, ttlSeconds = 43200) {
  await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
}

export async function delCache(key) {
  await redis.del(key);
}
