/** Keep post-auth navigation on this site, including group invitation queries. */
export function safeAuthNext(value: string | null | undefined, fallback = "/") {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020]/.test(value)) return fallback;
  try {
    const url = new URL(value, "https://ryutter.invalid");
    if (url.origin !== "https://ryutter.invalid" || url.pathname.startsWith("/auth/")) return fallback;
    return url.pathname + url.search + url.hash;
  } catch { return fallback; }
}
