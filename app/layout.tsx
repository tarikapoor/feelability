import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://feelability.co"),
  title: {
    default: "Feelability - A Safe Space for Your Unspoken Emotions",
    template: "%s | Feelability",
  },
  description:
    "Vent, love, appreciate - express how you really feel about people in your life. Private notes, shared profiles, end-to-end encrypted. No judgment, just authenticity.",
  openGraph: {
    title: "Feelability - A Safe Space for Your Unspoken Emotions",
    description: "Express yourself freely. Private notes, shared profiles. End-to-end encrypted.",
    url: "/",
    siteName: "Feelability",
    type: "website",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Feelability - A Safe Space for Your Unspoken Emotions",
    description: "Express yourself freely. Private notes, shared profiles. End-to-end encrypted.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}

