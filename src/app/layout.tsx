import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "リュッター - 勉強SNS",
  description: "勉強記録を共有するSNS",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <script src="https://cdn.jsdelivr.net/npm/chart.js" defer></script>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
