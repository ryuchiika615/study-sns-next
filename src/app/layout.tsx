import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ToastProvider";

export const metadata: Metadata = {
  title: "リュッター - 勉強SNS",
  description: "勉強記録を共有するSNS",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "リュッター",
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: "/icon-192.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"
        />
      </head>
      <body>
        <meta name="mobile-web-app-capable" content="yes" />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
