import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ToastProvider";
import { ThemeProvider } from "@/components/ThemeProvider";

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
    <html lang="ja" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"
        />
      </head>
      <body>
        <meta name="mobile-web-app-capable" content="yes" />
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
