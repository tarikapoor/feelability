import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import DeferredAnalytics from "@/components/DeferredAnalytics";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://feelability.co"),
  alternates: { canonical: "/" },
  title: {
    default: "Feelability — Private Emotional Journal & Anonymous Feedback App",
    template: "%s | Feelability",
  },
  description:
    "Feelability is a private, end-to-end encrypted space to express what you feel about people in your life — and collect anonymous heartfelt feedback through your Mirror Profile. Say what you've always held back.",
  keywords: [
    "private emotional journal",
    "anonymous feedback app",
    "express feelings privately",
    "end-to-end encrypted journal",
    "emotional wellness app",
    "mirror profile feedback",
    "unspoken feelings",
    "mental wellness journaling",
  ],
  robots: { index: true, follow: true },
  openGraph: {
    title: "Feelability — Say What You've Always Held Back",
    description:
      "A private, encrypted space to express your real feelings — and hear what others feel about you anonymously.",
    url: "/",
    siteName: "Feelability",
    type: "website",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Feelability — Say What You've Always Held Back",
    description:
      "A private, encrypted space to express your real feelings — and hear what others feel about you anonymously.",
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

