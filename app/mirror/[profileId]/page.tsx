"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { moderateReviewText } from "@/lib/moderation";
import type { Profile, Review } from "@/app/types";

const REVIEW_COOLDOWN_MS = 30000;

type ReviewCategory = "appreciate" | "need_to_work_on" | "just_saying";

const categoryHeader: Record<ReviewCategory, string> = {
  appreciate: "Appreciate",
  need_to_work_on: "Work On",
  just_saying: "Just Saying",
};

const formatReviewDate = (timestamp?: number) => {
  if (!timestamp) return "—";
  const date = new Date(timestamp);
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
};

const renderStars = (rating: number) => (
  <div className="flex items-center gap-1 text-amber-500">
    {[1, 2, 3, 4, 5].map((value) => (
      <span key={value}>{value <= rating ? "★" : "☆"}</span>
    ))}
  </div>
);

export default function MirrorProfilePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const profileId = params?.profileId as string;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [reviewTextAppreciate, setReviewTextAppreciate] = useState("");
  const [reviewTextWorkOn, setReviewTextWorkOn] = useState("");
  const [reviewTextJustSaying, setReviewTextJustSaying] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<ReviewCategory | null>(null);
  const formRef = useRef<HTMLDivElement | null>(null);

  const handleBack = () => {
    if (profileId) {
      router.push(`/app?profile=${profileId}`);
      return;
    }
    router.push("/app");
  };

  useEffect(() => {
    if (!profileId) return;
    let isMounted = true;

    const loadProfile = async () => {
      setLoading(true);
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, owner_id, name, description, bio, visibility, image_data, profile_type")
        .eq("id", profileId)
        .maybeSingle();

      if (!isMounted) return;

      if (profileError || !profileData) {
        setProfile(null);
        setLoading(false);
        return;
      }

      if (profileData.visibility !== "public" || profileData.profile_type !== "mirror") {
        setProfile(null);
        setLoading(false);
        return;
      }

      const mapped: Profile = {
        id: profileData.id,
        ownerId: profileData.owner_id,
        name: profileData.name,
        description: profileData.description || undefined,
        bio: profileData.bio || undefined,
        profileType: profileData.profile_type ?? "express",
        visibility: profileData.visibility,
        createdAt: Date.now(),
        punchCount: 0,
        hugCount: 0,
        kissCount: 0,
        notesCount: 0,
        imageData: profileData.image_data || null,
      };

      setProfile(mapped);
      setLoading(false);
    };

    const loadReviews = async () => {
      const { data } = await supabase
        .from("reviews")
        .select("id, profile_id, rating, review_text, category, submission_id, created_at, status")
        .eq("profile_id", profileId)
        .eq("status", "approved")
        .order("created_at", { ascending: false });

      if (!isMounted) return;
      const mapped = (data || []).map((review) => ({
        id: review.id,
        profileId: review.profile_id,
        rating: review.rating,
        reviewText: review.review_text,
        category: (review.category || "just_saying") as ReviewCategory,
        status: review.status,
        submissionId: review.submission_id ?? null,
        createdAt: review.created_at ? new Date(review.created_at).getTime() : undefined,
      }));
      setReviews(mapped);
    };

    loadProfile();
    loadReviews();

    return () => {
      isMounted = false;
    };
  }, [profileId]);

  useEffect(() => {
    const category = searchParams.get("category") as ReviewCategory | null;
    if (!category) return;
    if (!["appreciate", "need_to_work_on", "just_saying"].includes(category)) return;
    setShowForm(true);
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }, [searchParams]);

  const averageRating = useMemo(() => {
    const ratingBySubmission = new Map<string, number>();
    for (const review of reviews) {
      const key = review.submissionId || review.id;
      if (!ratingBySubmission.has(key)) {
        ratingBySubmission.set(key, review.rating);
      }
    }
    if (ratingBySubmission.size === 0) return 0;
    const sum = Array.from(ratingBySubmission.values()).reduce((acc, rating) => acc + rating, 0);
    return Math.round((sum / ratingBySubmission.size) * 10) / 10;
  }, [reviews]);

  const groupedReviews = useMemo(() => {
    const categoryOrder: Record<ReviewCategory, number> = {
      appreciate: 0,
      need_to_work_on: 1,
      just_saying: 2,
    };
    const groups: {
      key: string;
      rating: number;
      createdAt?: number;
      sections: { category: ReviewCategory; text: string }[];
    }[] = [];
    const byKey = new Map<string, (typeof groups)[number]>();

    for (const review of reviews) {
      const key = review.submissionId || review.id;
      let group = byKey.get(key);
      if (!group) {
        group = { key, rating: review.rating, createdAt: review.createdAt, sections: [] };
        byKey.set(key, group);
        groups.push(group);
      }
      group.sections.push({
        category: (review.category || "just_saying") as ReviewCategory,
        text: review.reviewText,
      });
    }

    for (const group of groups) {
      group.sections.sort((a, b) => categoryOrder[a.category] - categoryOrder[b.category]);
    }

    return groups;
  }, [reviews]);

  const categoryCounts = useMemo(
    () =>
      groupedReviews.reduce(
        (acc, group) => {
          for (const section of group.sections) {
            acc[section.category] += 1;
          }
          return acc;
        },
        { appreciate: 0, need_to_work_on: 0, just_saying: 0 } as Record<ReviewCategory, number>
      ),
    [groupedReviews]
  );

  const filteredGroups = useMemo(() => {
    if (!categoryFilter) return groupedReviews;
    return groupedReviews.filter((group) =>
      group.sections.some((section) => section.category === categoryFilter)
    );
  }, [groupedReviews, categoryFilter]);

  const handleAddReview = () => {
    setShowForm(true);
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmedAppreciate = reviewTextAppreciate.trim();
    const trimmedWorkOn = reviewTextWorkOn.trim();
    const trimmedJustSaying = reviewTextJustSaying.trim();
    const hasAnyFeedback = !!(trimmedAppreciate || trimmedWorkOn || trimmedJustSaying);

    if (!rating && !hasAnyFeedback) {
      setErrorMessage("Please add a rating and write at least one feedback section.");
      return;
    }
    if (!rating) {
      setErrorMessage("Please add a rating.");
      return;
    }
    if (!hasAnyFeedback) {
      setErrorMessage("Please write at least one feedback section.");
      return;
    }

    if (
      trimmedAppreciate.length > 500 ||
      trimmedWorkOn.length > 500 ||
      trimmedJustSaying.length > 500
    ) {
      setErrorMessage("Please keep feedback under 500 characters per section.");
      return;
    }

    const moderationTargets = [
      trimmedAppreciate,
      trimmedWorkOn,
      trimmedJustSaying,
    ].filter((value) => value.length > 0);
    for (const value of moderationTargets) {
      const moderation = moderateReviewText(value);
      if (!moderation.allowed) {
        setErrorMessage("respectful");
        return;
      }
    }

    const cooldownKey = `mirror_review_${profileId}`;
    const lastReviewAt = Number(localStorage.getItem(cooldownKey) || "0");
    if (Date.now() - lastReviewAt < REVIEW_COOLDOWN_MS) {
      setErrorMessage("Please wait a moment before submitting another review.");
      return;
    }

    setSubmitting(true);
    try {
      const requests = [
        trimmedAppreciate
          ? { category: "appreciate" as ReviewCategory, text: trimmedAppreciate }
          : null,
        trimmedWorkOn
          ? { category: "need_to_work_on" as ReviewCategory, text: trimmedWorkOn }
          : null,
        trimmedJustSaying
          ? { category: "just_saying" as ReviewCategory, text: trimmedJustSaying }
          : null,
      ].filter(Boolean) as { category: ReviewCategory; text: string }[];

      const submissionId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

      const responses = await Promise.all(
        requests.map((request) =>
          fetch("/api/reviews", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              profileId,
              rating,
              reviewText: request.text,
              category: request.category,
              submissionId,
            }),
          })
        )
      );

      const firstFailed = responses.find((response) => !response.ok);
      if (firstFailed) {
        let apiError = "submit_failed";
        try {
          const payload = await firstFailed.json();
          apiError = payload?.error ?? apiError;
        } catch {
          apiError = "submit_failed";
        }
        if (apiError === "moderation_failed") {
          setErrorMessage("respectful");
        } else if (apiError === "not_allowed") {
          setErrorMessage("This profile is not accepting feedback.");
        } else if (apiError === "not_found") {
          setErrorMessage("This profile is no longer available.");
        } else {
          setErrorMessage("Unable to submit feedback right now. Please try again.");
        }
        return;
      }

      localStorage.setItem(cooldownKey, Date.now().toString());
      setSuccessMessage("Thanks for sharing your feedback anonymously.");
      setReviewTextAppreciate("");
      setReviewTextWorkOn("");
      setReviewTextJustSaying("");
      setRating(0);

      const { data } = await supabase
        .from("reviews")
        .select("id, profile_id, rating, review_text, category, submission_id, created_at, status")
        .eq("profile_id", profileId)
        .eq("status", "approved")
        .order("created_at", { ascending: false });

      const mapped = (data || []).map((review) => ({
        id: review.id,
        profileId: review.profile_id,
        rating: review.rating,
        reviewText: review.review_text,
        category: (review.category || "just_saying") as ReviewCategory,
        status: review.status,
        submissionId: review.submission_id ?? null,
        createdAt: review.created_at ? new Date(review.created_at).getTime() : undefined,
      }));
      setReviews(mapped);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-white via-blue-50 via-pink-50 to-yellow-50 px-6 py-16">
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="h-10 w-48 bg-white/70 rounded-lg animate-pulse" />
          <div className="h-6 w-72 bg-white/70 rounded-lg animate-pulse" />
          <div className="h-40 w-full bg-white/70 rounded-2xl animate-pulse" />
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-white via-blue-50 via-pink-50 to-yellow-50 px-6 py-16">
        <div className="max-w-3xl mx-auto text-center space-y-3">
          <h1 className="text-2xl font-semibold text-gray-800">Profile not available</h1>
          <p className="text-gray-600">
            This mirror profile is unavailable or not public.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-y-auto bg-gradient-to-br from-white via-blue-50 via-pink-50 to-yellow-50 px-6 py-12">
      <div className="w-full space-y-8">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
        >
          <span aria-hidden>←</span>
          Back
        </button>

        <section className="bg-white/80 backdrop-blur-sm border border-gray-100 rounded-2xl p-4 shadow-md flex items-center justify-between gap-4 relative">
          <div className="flex items-center gap-3 min-w-0">
            {profile.imageData ? (
              <img
                src={profile.imageData}
                alt={profile.name}
                className="w-14 h-14 rounded-2xl object-cover bg-white shrink-0"
              />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-gray-200 flex items-center justify-center text-2xl shrink-0">
                😊
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-gray-800 truncate">{profile.name}</h1>
              {profile.bio && <p className="text-sm text-gray-600 mt-0.5 truncate">{profile.bio}</p>}
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white/70 px-3 py-1.5 text-sm">
              <span className="text-amber-500">★</span>
              <span className="font-semibold text-gray-800">{averageRating || 0}</span>
              <span className="text-gray-300">|</span>
              <span className="text-gray-600">
                {groupedReviews.length} rating{groupedReviews.length === 1 ? "" : "s"}
              </span>
            </div>
            <button
              type="button"
              onClick={handleAddReview}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-pink-500 to-purple-500 text-white text-sm font-semibold shadow-md hover:from-pink-600 hover:to-purple-600 transition-colors whitespace-nowrap"
            >
              Add Review
            </button>
          </div>
        </section>

        {showForm && (
          <section ref={formRef} className="bg-white/80 border border-gray-100 rounded-2xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Share your feedback</h3>
            <p className="text-sm text-gray-600 mb-4">
              Your feedback is anonymous and visible after moderation.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Rating</label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      type="button"
                      key={value}
                      onClick={() => setRating(value)}
                      className={`text-2xl ${value <= rating ? "text-amber-500" : "text-gray-300"}`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">👌🏻 Appreciate</label>
                  <div className="relative">
                    <textarea
                      value={reviewTextAppreciate}
                      onChange={(event) => setReviewTextAppreciate(event.target.value)}
                      rows={4}
                      maxLength={500}
                      className="w-full min-h-[120px] max-h-[216px] overflow-y-auto rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm pr-12"
                      placeholder="What do they do well?"
                    />
                    <span className="absolute bottom-2 right-2 text-xs text-gray-400">
                      {reviewTextAppreciate.trim().length}/500
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">👀 Work On</label>
                  <div className="relative">
                    <textarea
                      value={reviewTextWorkOn}
                      onChange={(event) => setReviewTextWorkOn(event.target.value)}
                      rows={4}
                      maxLength={500}
                      className="w-full min-h-[120px] max-h-[216px] overflow-y-auto rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm pr-12"
                      placeholder="Where can they improve?"
                    />
                    <span className="absolute bottom-2 right-2 text-xs text-gray-400">
                      {reviewTextWorkOn.trim().length}/500
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">💭 Just Saying</label>
                  <div className="relative">
                    <textarea
                      value={reviewTextJustSaying}
                      onChange={(event) => setReviewTextJustSaying(event.target.value)}
                      rows={4}
                      maxLength={500}
                      className="w-full min-h-[120px] max-h-[216px] overflow-y-auto rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm pr-12"
                      placeholder="Any honest thoughts?"
                    />
                    <span className="absolute bottom-2 right-2 text-xs text-gray-400">
                      {reviewTextJustSaying.trim().length}/500
                    </span>
                  </div>
                </div>
              </div>

              {errorMessage && (
                <p className="text-sm text-red-600">
                  {errorMessage === "respectful"
                    ? "Please keep the feedback respectful."
                    : errorMessage}
                </p>
              )}
              {successMessage && <p className="text-sm text-green-600">{successMessage}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-pink-500 to-purple-500 text-white text-sm font-semibold shadow-md hover:from-pink-600 hover:to-purple-600 transition-colors disabled:opacity-70"
              >
                {submitting ? "Submitting..." : "Submit feedback"}
              </button>
            </form>
          </section>
        )}

        <section className="space-y-4">
          <h3 className="text-xl font-semibold text-gray-800">Reviews</h3>
          {reviews.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {([
                { key: "appreciate", label: "⭐ Appreciate" },
                { key: "need_to_work_on", label: "📈 Work On" },
                { key: "just_saying", label: "💭 Just Saying" },
              ] as { key: ReviewCategory; label: string }[]).map((item) => {
                const isActive = categoryFilter === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() =>
                      setCategoryFilter((prev) => (prev === item.key ? null : item.key))
                    }
                    aria-pressed={isActive}
                    className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-colors ${
                      isActive
                        ? "border-purple-400 bg-purple-50 text-purple-700 ring-1 ring-purple-300"
                        : "border-gray-200 bg-white/70 text-gray-600 hover:bg-white"
                    }`}
                  >
                    {item.label} ({categoryCounts[item.key]})
                  </button>
                );
              })}
              {categoryFilter && (
                <button
                  type="button"
                  onClick={() => setCategoryFilter(null)}
                  className="px-3 py-1.5 rounded-full text-sm font-medium text-purple-600 hover:text-purple-700"
                >
                  Clear
                </button>
              )}
            </div>
          )}
          {reviews.length === 0 ? (
            <div className="bg-white/70 border border-gray-100 rounded-2xl p-6 text-gray-600 text-sm">
              No feedback yet. Be the first to share honest thoughts.
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="bg-white/70 border border-gray-100 rounded-2xl p-6 text-gray-600 text-sm">
              No feedback in this category yet.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredGroups.map((group) => (
                <div
                  key={group.key}
                  className="bg-white/80 border border-gray-100 rounded-2xl p-5 shadow-sm space-y-3"
                >
                  {renderStars(group.rating)}
                  <div className="space-y-3">
                    {group.sections.map((section, index) => (
                      <div key={`${section.category}-${index}`} className="space-y-1">
                        <div className="text-sm font-semibold text-purple-700">
                          {categoryHeader[section.category]}
                        </div>
                        <p className="text-sm text-gray-700">{section.text}</p>
                      </div>
                    ))}
                  </div>
                  <div className="text-xs text-gray-500">{formatReviewDate(group.createdAt)}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
