import { startPriceRefreshWorker } from "./priceRefreshWorker.js";
import { startCacheCleanupWorker } from "./cacheCleanupWorker.js";
import { startTrendWorker } from "./trendsWorker.js";

console.log("[workers] starting...");

startPriceRefreshWorker();
startCacheCleanupWorker();
startTrendWorker();
