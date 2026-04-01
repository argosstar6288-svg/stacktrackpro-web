import { redis } from "../services/cache.js";

export function startCacheCleanupWorker() {
  const run = async () => {
    try {
      const keys = await redis.keys("price:*");
      if (keys.length > 50000) {
        const stale = keys.slice(0, Math.floor(keys.length * 0.1));
        if (stale.length > 0) {
          await redis.del(...stale);
          console.log(`[worker:cache-cleanup] removed ${stale.length} keys`);
        }
      }
    } catch (error) {
      console.error("[worker:cache-cleanup] failed", error);
    }
  };

  setInterval(run, 60 * 60 * 1000);
}
