import { refreshToken } from "../services/ebayAuth.js";

export function startPriceRefreshWorker() {
  const run = async () => {
    try {
      await refreshToken();
      console.log("[worker:price-refresh] eBay token refreshed");
    } catch (error) {
      console.error("[worker:price-refresh] token refresh failed", error);
    }
  };

  void run();
  setInterval(run, 2 * 60 * 60 * 1000);
}
