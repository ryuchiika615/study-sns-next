export function formatMinutes(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}時間${m ? `${m}分` : ""}` : `${m}分`;
}

export function appUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${base.replace(/\/$/, "")}${path}`;
}

export function xIntentUrl(text: string, url: string) {
  return `https://twitter.com/intent/tweet?${new URLSearchParams({ text, url }).toString()}`;
}
