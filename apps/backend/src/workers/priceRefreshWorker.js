import { refreshToken } from "../services/ebayAuth.js";
import { env } from "../config/env.js";

export function startPriceRefreshWorker() {
  const missingCreds =
    !env.ebayClientId ||
    !env.ebayClientSecret ||
    !env.ebayRefreshToken ||
    env.ebayClientId === "x" ||
    env.ebayClientSecret === "x" ||
    env.ebayRefreshToken === "x";

  if (missingCreds) {
    console.warn("[worker:price-refresh] skipped: missing valid eBay credentials");
    return;
  }

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
