import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Feelability - a safe space for your unspoken emotions.",
  alternates: { canonical: "/login" },
  openGraph: {
    title: "Sign in | Feelability",
    description: "Sign in to Feelability - a safe space for your unspoken emotions.",
    url: "/login",
    siteName: "Feelability",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sign in | Feelability",
    description: "Sign in to Feelability - a safe space for your unspoken emotions.",
  },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white via-blue-50 via-pink-50 to-yellow-50">
          <div className="h-12 w-12 rounded-full border-4 border-pink-200 border-t-pink-500 animate-spin" />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}
