import { Rarity } from "./types";

export const SUBJECT_COLORS = [
  "#1877f2", "#ff6b6b", "#20c997", "#f59f00",
  "#845ef7", "#12b886", "#e64980", "#15aabf",
  "#fd7e14", "#5c7cfa", "#82c91e", "#be4bdb",
];

export const RARITY_ORDER: Record<Rarity, number> = {
  N: 1, R: 2, SR: 3, SSR: 4, UR: 5, LR: 6,
};

export const RARITY_LABELS: Record<Rarity, string> = {
  N: "N", R: "R", SR: "SR", SSR: "SSR", UR: "UR", LR: "LR",
};

export const SELL_VALUES: Record<Rarity, number> = {
  N: 1, R: 4, SR: 15, SSR: 60, UR: 180, LR: 650,
};

export const BUY_COSTS: Record<Rarity, number> = {
  N: 5, R: 15, SR: 60, SSR: 240, UR: 720, LR: 2600,
};

export function formatStudyTime(minutes: number | null | undefined): string {
  const m = minutes ?? 0;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h > 0 && rest > 0) return `${h}時間${rest}分`;
  if (h > 0) return `${h}時間`;
  return `${rest}分`;
}

export function subjectColor(subject: string): string {
  const total = subject.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return SUBJECT_COLORS[total % SUBJECT_COLORS.length];
}

export function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffDay > 0) {
    return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  }
  if (diffMin < 1) return "たった今";
  if (diffHour < 1) return `${diffMin}分前`;
  return `${diffHour}時間前`;
}

export function getTodayDateString(): string {
  const d = new Date();
  d.setHours(d.getHours() + 9); // JST
  return d.toISOString().split("T")[0];
}

export function getDateNDaysAgo(n: number): string {
  const d = new Date();
  d.setHours(d.getHours() + 9);
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

export function rarityClass(rarity: Rarity | null | undefined): string {
  return rarity ?? "N";
}

export function isIconItem(itemName: string): boolean {
  return itemName.startsWith("【アイコン】") || itemName.includes("アイコン");
}

export function itemDisplayName(name: string): string {
  return name.replace("精錬:", "").replace("邊ｾ骭ｬ:", "");
}

const SUPABASE_STORAGE_RE = /^https:\/\/([^.]+)\.supabase\.co\/storage\/v1\/object\/public\/(.+)$/;

export function compressImage(file: File, quality = 0.8, maxWidth = 1920): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const w = Math.min(img.width, maxWidth);
      const h = (img.height / img.width) * w;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("compression failed"));
      }, "image/jpeg", quality);
    };
    img.onerror = () => reject(new Error("failed to load image"));
    img.src = URL.createObjectURL(file);
  });
}

export function vibrateDevice(pattern: number | number[] = [200, 100, 200]) {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch {}
}

export function getOptimizedIconUrl(url: string | null | undefined, size = 96): string {
  if (!url) return "";
  const m = url.match(SUPABASE_STORAGE_RE);
  if (m) {
    return `https://${m[1]}.supabase.co/storage/v1/render/image/public/${m[2]}?width=${size}&height=${size}&resize=cover`;
  }
  return url;
}
