import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../../.env") });

const ebayEnvRaw = (process.env.EBAY_ENV || "sandbox").toLowerCase();
const ebayEnv = ebayEnvRaw === "production" ? "production" : "sandbox";

const required = [
  "EBAY_CLIENT_ID",
  "EBAY_CLIENT_SECRET",
  "MONGO_URI",
  "REDIS_URL",
  "JWT_SECRET",
];

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 4000),
  ebayEnv,
  ebayIdentityBaseUrl:
    ebayEnv === "production"
      ? "https://api.ebay.com"
      : "https://api.sandbox.ebay.com",
  ebayBrowseBaseUrl:
    ebayEnv === "production"
      ? "https://api.ebay.com"
      : "https://api.sandbox.ebay.com",
  ebayClientId: process.env.EBAY_CLIENT_ID || "",
  ebayClientSecret: process.env.EBAY_CLIENT_SECRET || "",
  ebayRefreshToken: process.env.EBAY_REFRESH_TOKEN || "",
  mongoUri: process.env.MONGO_URI || "",
  redisUrl: process.env.REDIS_URL || "",
  googleVisionKey: process.env.GOOGLE_VISION_KEY || "",
  jwtSecret: process.env.JWT_SECRET || "",
  scanApiUrl: process.env.SCAN_API_URL || "http://localhost:3001/api/scan-card-v2",
  matcherApiUrl: process.env.MATCHER_API_URL || "http://localhost:3002",
};

export function validateEnv() {
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }
}
