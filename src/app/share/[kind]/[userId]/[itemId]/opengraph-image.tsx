import { ImageResponse } from "next/og";
import { getShareCardData } from "@/lib/share-data";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: { kind: string; userId: string; itemId: string } }) {
  const data = await getShareCardData(params.kind, params.userId, params.itemId);
  const title = data?.title || "リュッター";
  return new ImageResponse(<div style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column", padding: "62px", background: "linear-gradient(135deg, #102a65, #07152e)", color: "white", fontFamily: "sans-serif" }}><div style={{ display: "flex", fontSize: 27, color: "#93c5fd", letterSpacing: 5 }}>LYUTTER</div><div style={{ display: "flex", fontSize: 56, fontWeight: 700, marginTop: 70 }}>{title}</div><div style={{ display: "flex", fontSize: 31, color: "#bfdbfe", marginTop: 20 }}>{data?.subtitle || "学習を記録しよう"}</div><div style={{ display: "flex", fontSize: 86, fontWeight: 800, marginTop: 75 }}>{data?.metric || "STUDY"}</div><div style={{ display: "flex", fontSize: 28, color: "#fdba74", marginTop: 20 }}>{data?.label || ""}</div></div>, size);
}
