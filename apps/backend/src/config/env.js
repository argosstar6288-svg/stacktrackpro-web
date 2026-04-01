import dotenv from "dotenv";

dotenv.config();

const required = [
  "EBAY_CLIENT_ID",
  "EBAY_CLIENT_SECRET",
  "EBAY_REFRESH_TOKEN",
  "MONGO_URI",
  "REDIS_URL",
  "JWT_SECRET",
];

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 4000),
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
