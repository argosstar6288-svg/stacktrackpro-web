import type { MetadataRoute } from "next";

const siteUrl = "https://www.stacktrackpro.com";
const siteHost = "www.stacktrackpro.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin/",
          "/dashboard/",
          "/env-test",
          "/firebase-test",
          "/test-auth",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteHost,
  };
}