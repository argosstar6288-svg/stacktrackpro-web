const axios = require("axios");
const qs = require("qs");

const BASE = process.env.EBAY_ENV === "PRODUCTION"
  ? "https://api.ebay.com"
  : "https://api.sandbox.ebay.com";

let cachedToken = null;
let expiresAt = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < expiresAt) return cachedToken;

  if (!process.env.EBAY_CLIENT_ID || !process.env.EBAY_CLIENT_SECRET) {
    throw new Error("Missing EBAY_CLIENT_ID or EBAY_CLIENT_SECRET in stacktrack-backend/.env");
  }

  const auth = Buffer.from(
    `${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`
  ).toString("base64");

  const res = await axios.post(
    `${BASE}/identity/v1/oauth2/token`,
    qs.stringify({
      grant_type: "client_credentials",
      scope: "https://api.ebay.com/oauth/api_scope"
    }),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${auth}`
      }
    }
  );

  cachedToken = res.data.access_token;
  expiresAt = Date.now() + (res.data.expires_in - 60) * 1000;
  return cachedToken;
}

module.exports = { getAccessToken, BASE };
