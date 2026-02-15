import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import DeferredAnalytics from "@/components/DeferredAnalytics";

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

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://feelability.co";

const structuredData = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Feelability",
    url: siteUrl,
    description: "A safe space for your unspoken emotions.",
  },
  {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Feelability",
    url: siteUrl,
    applicationCategory: "LifestyleApplication",
    operatingSystem: "Web",
    description:
      "Express how you really feel. Private notes, shared profiles, end-to-end encrypted.",
  },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <AuthProvider>{children}</AuthProvider>
        <DeferredAnalytics />
      </body>
    </html>
  );
}

