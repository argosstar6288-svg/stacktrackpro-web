import type { MetadataRoute } from "next";

const siteUrl = "https://www.stacktrackpro.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const routes = [
    "",
    "/auction",
    "/auction-rules",
    "/auction/id",
    "/auctions/create",
    "/auctions/live",
    "/catalogue",
    "/create-account",
    "/legal",
    "/legal/auction-rules",
    "/legal/community-guidelines",
    "/legal/founding-member",
    "/legal/payout",
    "/legal/privacy",
    "/legal/refund-dispute",
    "/legal/terms",
    "/login",
    "/signup",
    "/verify-age",
  ];

  return routes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: now,
    changeFrequency: route === "" ? "daily" : "weekly",
    priority: route === "" ? 1 : 0.7,
  }));
}