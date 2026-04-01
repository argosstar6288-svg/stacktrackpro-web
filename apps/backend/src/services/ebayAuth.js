import axios from "axios";
import { env } from "../config/env.js";

let tokenCache = {
  accessToken: "",
  expiresAt: 0,
};

export async function refreshToken() {
  const res = await axios.post(
    "https://api.ebay.com/identity/v1/oauth2/token",
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: env.ebayRefreshToken,
      scope: "https://api.ebay.com/oauth/api_scope",
    }),
    {
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(`${env.ebayClientId}:${env.ebayClientSecret}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  const accessToken = res.data.access_token;
  const expiresIn = Number(res.data.expires_in || 7200);

  tokenCache = {
    accessToken,
    expiresAt: Date.now() + (expiresIn - 60) * 1000,
  };

  return accessToken;
}

export async function getAccessToken() {
  if (tokenCache.accessToken && Date.now() < tokenCache.expiresAt) {
    return tokenCache.accessToken;
  }

  return refreshToken();
}
