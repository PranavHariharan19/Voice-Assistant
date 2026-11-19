import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import LiveScoreWidget from "@/components/live-score-widget";

export const metadata: Metadata = {
  title: "Mint Assistant & Calendar",
  description: "Your AI-powered personal assistant, dynamic calendar, sports schedule tracker, and secure vault.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Mint Assistant",
  },
};

export const viewport: Viewport = {
  themeColor: "#00A19B",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          {children}
          <LiveScoreWidget />
        </AuthProvider>
      </body>
    </html>
  );
}
