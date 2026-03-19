export const APP_CHROME_PUBLIC_ROUTES = new Set([
  "/",
  "/login",
  "/signup",
  "/create-account",
]);

export const APP_CHROME_INTERNAL_PREFIXES = [
  "/dashboard",
  "/marketplace",
  "/collection",
  "/scan",
  "/auctions",
  "/auction",
  "/inbox",
  "/chat",
  "/community-chat",
  "/catalogue",
  "/overview",
  "/verify-age",
  "/admin",
];

export function shouldUseInternalChrome(pathname?: string | null) {
  if (!pathname) return false;
  if (APP_CHROME_PUBLIC_ROUTES.has(pathname)) return false;

  return APP_CHROME_INTERNAL_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function shouldHideFooter(pathname?: string | null) {
  if (!pathname) return false;
  return APP_CHROME_PUBLIC_ROUTES.has(pathname) || shouldUseInternalChrome(pathname);
}
