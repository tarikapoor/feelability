"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";
import type { Profile, Review } from "@/app/types";

type ReviewCategory = "appreciate" | "need_to_work_on" | "just_saying";

const categoryLabel: Record<ReviewCategory, string> = {
  appreciate: "⭐ Appreciate",
  need_to_work_on: "📈 Need to Work On",
  just_saying: "💭 Just Saying",
};

const categoryHeader: Record<ReviewCategory, string> = {
  appreciate: "Appreciate",
  need_to_work_on: "Need to Work On",
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

export default function MirrorDashboardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login?redirect=/mirror");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    let isMounted = true;

    const loadData = async () => {
      setLoadingProfiles(true);
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, owner_id, name, description, bio, visibility, image_data, profile_type")
        .eq("owner_id", user.id)
        .eq("profile_type", "mirror")
        .order("created_at", { ascending: false });

      if (!isMounted) return;

      const mappedProfiles = (profileData || []).map((p) => ({
        id: p.id,
        ownerId: p.owner_id,
        name: p.name,
        description: p.description || undefined,
        bio: p.bio || undefined,
        profileType: p.profile_type ?? "express",
        visibility: p.visibility,
        createdAt: Date.now(),
        punchCount: 0,
        hugCount: 0,
        kissCount: 0,
        notesCount: 0,
        imageData: p.image_data || null,
      }));

      setProfiles(mappedProfiles);

      if (mappedProfiles.length === 0) {
        setReviews([]);
        setLoadingProfiles(false);
        return;
      }

      const { data: reviewData } = await supabase
        .from("reviews")
        .select("id, profile_id, rating, review_text, category, submission_id, created_at, status")
        .in(
          "profile_id",
          mappedProfiles.map((profile) => profile.id)
        )
        .order("created_at", { ascending: false });

      if (!isMounted) return;
      const mappedReviews = (reviewData || []).map((review) => ({
        id: review.id,
        profileId: review.profile_id,
        rating: review.rating,
        reviewText: review.review_text,
        category: (review.category || "just_saying") as ReviewCategory,
        status: review.status,
        submissionId: review.submission_id ?? null,
        createdAt: review.created_at ? new Date(review.created_at).getTime() : undefined,
      }));
      setReviews(mappedReviews);
      setLoadingProfiles(false);
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [user]);

  const groupedReviews = useMemo(() => {
    return profiles.map((profile) => {
      const profileReviews = reviews.filter((review) => review.profileId === profile.id);
      const approved = profileReviews.filter((review) => review.status === "approved");
      const totalReviews = approved.length;
      const averageRating =
        totalReviews === 0
          ? 0
          : Math.round(
              (approved.reduce((acc, review) => acc + review.rating, 0) / totalReviews) * 10
            ) / 10;

      const ratingDistribution = [1, 2, 3, 4, 5].map((rating) => ({
        rating,
        count: approved.filter((review) => review.rating === rating).length,
      }));

      const categoryCounts: Record<ReviewCategory, number> = {
        appreciate: 0,
        need_to_work_on: 0,
        just_saying: 0,
      };

      approved.forEach((review) => {
        const category = (review.category || "just_saying") as ReviewCategory;
        categoryCounts[category] += 1;
      });

      const categoryOrder: Record<ReviewCategory, number> = {
        appreciate: 0,
        need_to_work_on: 1,
        just_saying: 2,
      };
      const approvedGroups: {
        key: string;
        rating: number;
        createdAt?: number;
        ids: string[];
        sections: { category: ReviewCategory; text: string }[];
      }[] = [];
      const byKey = new Map<string, (typeof approvedGroups)[number]>();
      approved.forEach((review) => {
        const key = review.submissionId || review.id;
        let group = byKey.get(key);
        if (!group) {
          group = { key, rating: review.rating, createdAt: review.createdAt, ids: [], sections: [] };
          byKey.set(key, group);
          approvedGroups.push(group);
        }
        group.ids.push(review.id);
        group.sections.push({
          category: (review.category || "just_saying") as ReviewCategory,
          text: review.reviewText,
        });
      });
      approvedGroups.forEach((group) => {
        group.sections.sort((a, b) => categoryOrder[a.category] - categoryOrder[b.category]);
      });

      return {
        profile,
        approved,
        approvedGroups,
        totalReviews,
        averageRating,
        ratingDistribution,
        categoryCounts,
      };
    });
  }, [profiles, reviews]);

  const handleCopyLink = async (profileId: string) => {
    const link = `${window.location.origin}/mirror/${profileId}`;
    await navigator.clipboard.writeText(link);
    setToastMessage("Mirror link copied.");
    setTimeout(() => setToastMessage(null), 2000);
  };

  const handleDeleteReview = async (reviewIds: string[]) => {
    if (reviewIds.length === 0) return;
    await supabase.from("reviews").delete().in("id", reviewIds);
    setReviews((prev) => prev.filter((review) => !reviewIds.includes(review.id)));
  };

  if (!user && !loading) {
    return null;
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-white via-blue-50 via-pink-50 to-yellow-50 px-6 py-16">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">Mirror dashboard</h1>
            <p className="text-sm text-gray-600">
              Track feedback, share your public link, and manage reviews.
            </p>
          </div>
          {toastMessage && (
            <div className="text-sm text-green-600 bg-white/80 border border-green-100 px-3 py-2 rounded-lg">
              {toastMessage}
            </div>
          )}
        </header>

        {loadingProfiles ? (
          <div className="space-y-4">
            {[...Array(2)].map((_, index) => (
              <div key={index} className="h-32 bg-white/70 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : groupedReviews.length === 0 ? (
          <div className="bg-white/80 border border-gray-100 rounded-2xl p-8 text-center">
            <h2 className="text-lg font-semibold text-gray-800">No mirror profiles yet</h2>
            <p className="text-sm text-gray-600 mt-2">
              Create a mirror profile to collect thoughtful feedback.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedReviews.map(({ profile, approvedGroups, totalReviews, averageRating, ratingDistribution, categoryCounts }) => (
              <section
                key={profile.id}
                className="bg-white/80 border border-gray-100 rounded-3xl p-6 shadow-sm space-y-5"
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {profile.imageData ? (
                      <img
                        src={profile.imageData}
                        alt={profile.name}
                        className="w-12 h-12 rounded-2xl object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-2xl bg-gray-200 flex items-center justify-center">
                        😊
                      </div>
                    )}
                    <div>
                      <h2 className="text-lg font-semibold text-gray-800">{profile.name}</h2>
                      <p className="text-sm text-gray-600">
                        {profile.bio || profile.description || "Mirror profile"}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                    <div className="px-3 py-1 rounded-full bg-purple-50 text-purple-700 font-semibold">
                      {averageRating ? `${averageRating} / 5` : "No ratings yet"}
                    </div>
                    <div>{totalReviews} review{totalReviews === 1 ? "" : "s"}</div>
                    <button
                      onClick={() => handleCopyLink(profile.id)}
                      className="px-3 py-1 rounded-lg border border-purple-200 text-purple-700 text-sm font-semibold hover:bg-white transition-colors"
                    >
                      Copy public link
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {(Object.keys(categoryCounts) as ReviewCategory[]).map((category) => (
                    <div key={category} className="bg-white/70 border border-gray-100 rounded-xl p-3 text-sm text-gray-700">
                      <div className="font-semibold">{categoryLabel[category]}</div>
                      <div className="text-gray-600">{categoryCounts[category]}</div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-sm text-gray-700">
                  {ratingDistribution.map((item) => (
                    <div key={item.rating} className="bg-white/70 border border-gray-100 rounded-xl p-3">
                      <div className="font-semibold">{item.rating} star</div>
                      <div className="text-gray-600">{item.count}</div>
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-700">Latest reviews</h3>
                  {approvedGroups.length === 0 ? (
                    <div className="text-sm text-gray-500">
                      No approved reviews yet.
                    </div>
                  ) : (
                    approvedGroups.slice(0, 5).map((group) => (
                      <div key={group.key} className="bg-white/70 border border-gray-100 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="text-amber-500 text-sm">
                            {"★".repeat(group.rating)}{"☆".repeat(5 - group.rating)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {formatReviewDate(group.createdAt)}
                          </div>
                        </div>
                        <div className="space-y-2">
                          {group.sections.map((section, index) => (
                            <div key={`${section.category}-${index}`} className="space-y-0.5">
                              <div className="text-sm font-semibold text-purple-700">
                                {categoryHeader[section.category]}
                              </div>
                              <p className="text-sm text-gray-700">{section.text}</p>
                            </div>
                          ))}
                        </div>
                        <button
                          onClick={() => handleDeleteReview(group.ids)}
                          className="text-xs text-red-600 hover:text-red-700"
                        >
                          Delete review
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
