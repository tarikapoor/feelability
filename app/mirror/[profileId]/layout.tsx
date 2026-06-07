import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ profileId: string }>;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
});

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { profileId } = await params;
  try {
    const { data } = await supabase
      .from("profiles")
      .select("name, bio, visibility, profile_type, image_data")
      .eq("id", profileId)
      .maybeSingle();

    if (!data || data.visibility !== "public" || data.profile_type !== "mirror") {
      return {
        title: "Profile not available | Feelability",
        description: "This profile is not available.",
      };
    }

    const name = data.name || "Mirror Profile";
    const description = `See what people are saying about ${name} and leave anonymous feedback.`;
    const image = data.image_data || undefined;

    return {
      title: `${name} | Feelability`,
      description,
      openGraph: {
        title: `${name} | Feelability`,
        description,
        images: image ? [{ url: image }] : undefined,
      },
    };
  } catch {
    return {
      title: "Feelability",
      description: "See what people are saying and leave anonymous feedback.",
    };
  }
}

export default function MirrorProfileLayout({ children }: LayoutProps) {
  return children;
}
