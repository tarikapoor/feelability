import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { moderateReviewText } from "@/lib/moderation";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const profileId = (body?.profileId as string | undefined) ?? "";
    const rating = Number(body?.rating);
    const reviewText = (body?.reviewText as string | undefined) ?? "";
    const category = (body?.category as string | undefined) ?? "just_saying";
    const submissionIdRaw = (body?.submissionId as string | undefined) ?? "";
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const submissionId = uuidPattern.test(submissionIdRaw) ? submissionIdRaw : null;

    if (!profileId || !Number.isFinite(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
    }

    const trimmed = reviewText.trim();
    if (!trimmed || trimmed.length > 500) {
      return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
    }

    const allowedCategories = new Set(["appreciate", "need_to_work_on", "just_saying"]);
    if (!allowedCategories.has(category)) {
      return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
    }

    const moderation = moderateReviewText(trimmed);
    if (!moderation.allowed) {
      return NextResponse.json({ error: "moderation_failed" }, { status: 400 });
    }

    const { error } = await supabase.from("reviews").insert({
      profile_id: profileId,
      rating,
      review_text: trimmed,
      category,
      status: "approved",
      submission_id: submissionId,
    });

    if (error) {
      if (error.message?.toLowerCase().includes("row-level security")) {
        return NextResponse.json({ error: "not_allowed" }, { status: 403 });
      }
      console.error("Review insert failed:", error);
      return NextResponse.json(
        { error: "insert_failed", detail: error.message, code: error.code },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
