"use client";

/**
 * ARCHITECTURE LOCK — DO NOT MODIFY WITHOUT REVIEW
 * Core pages must remain separate: Login (Page 0), Home/Profile Selection (Page 1), Character (Page 2).
 * Single source of truth: profiles[] + activeProfileId (stored in localStorage for selection only).
 * Profiles are loaded from Supabase only. Sharing/permissions must remain intact.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/components/AuthProvider";
import Navbar from "@/components/Navbar";
import { supabase } from "@/lib/supabaseClient";
import type { Profile } from "./types";

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showProfileSelector, setShowProfileSelector] = useState(false);
  
  // Create profile state
  const [newProfileName, setNewProfileName] = useState("");
  const [newProfileDesc, setNewProfileDesc] = useState("");
  const [newProfileImage, setNewProfileImage] = useState<string | null>(null);
  const [newProfileIsPublic, setNewProfileIsPublic] = useState(false);
  const [profileImages, setProfileImages] = useState<Record<string, string>>({});
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);

  // Redirect unauthenticated users to /login
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  // Helper to scope storage by user id (only for current profile pointer)
  const storageKey = (base: string) => `u:${user?.id}:${base}`;

  const mapProfile = (p: any): Profile => ({
    id: p.id,
    ownerId: p.owner_id,
    name: p.name,
    description: p.description || undefined,
    visibility: p.visibility === "public" ? "public" : "private",
    imageData: p.image_data || null,
    createdAt: p.created_at ? new Date(p.created_at).getTime() : Date.now(),
    punchCount: p.punch_count ?? 0,
    hugCount: p.hug_count ?? 0,
    kissCount: p.kiss_count ?? 0,
    notesCount: p.notes_count ?? 0,
  });

  useEffect(() => {
    const loadProfiles = async () => {
      if (!user) return;
      setProfilesLoading(true);
      try {
        const { data: owned, error: ownedError } = await supabase
          .from("profiles")
          .select(
            "id, owner_id, name, description, visibility, image_data, punch_count, hug_count, kiss_count, notes_count, created_at"
          )
          .eq("owner_id", user.id)
          .order("created_at", { ascending: false });

        if (ownedError) {
          console.error("Error loading owned profiles:", ownedError);
          return;
        }

        const ownedProfiles = (owned || []).map(mapProfile);

        const { data: sharedIds, error: sharedIdsError } = await supabase
          .from("profile_collaborators")
          .select("profile_id")
          .eq("user_id", user.id);

        if (sharedIdsError) {
          console.error("Error loading collaborator ids:", sharedIdsError);
        }

        const sharedProfileIds = (sharedIds || []).map((r) => r.profile_id);
        let sharedProfiles: Profile[] = [];
        if (sharedProfileIds.length > 0) {
          const { data: shared, error: sharedError } = await supabase
            .from("profiles")
            .select(
              "id, owner_id, name, description, visibility, image_data, punch_count, hug_count, kiss_count, notes_count, created_at"
            )
            .in("id", sharedProfileIds)
            .order("created_at", { ascending: false });

          if (sharedError) {
            console.error("Error loading shared profiles:", sharedError);
          } else {
            sharedProfiles = (shared || []).map(mapProfile);
          }
        }

        const mergedMap = new Map<string, Profile>();
        for (const p of [...ownedProfiles, ...sharedProfiles]) {
          mergedMap.set(p.id, p);
        }
        const merged = Array.from(mergedMap.values()).sort(
          (a, b) => b.createdAt - a.createdAt
        );

        setProfiles(merged);

        const images: Record<string, string> = {};
        for (const profile of merged) {
          if (profile.imageData) images[profile.id] = profile.imageData;
        }
        setProfileImages(images);
      } finally {
        setProfilesLoading(false);
      }
    };
    loadProfiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (loading || !user || profilesLoading || profiles.length === 0) return;

    const storedCurrentId = localStorage.getItem(storageKey("currentProfileId"));
    const nextProfileId =
      storedCurrentId && profiles.some((p) => p.id === storedCurrentId)
        ? storedCurrentId
        : profiles[0].id;

    localStorage.setItem(storageKey("currentProfileId"), nextProfileId);
    router.replace("/character");
  }, [loading, user, profilesLoading, profiles, router]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      setImageUploading(true);
      reader.onloadend = () => {
        setNewProfileImage(reader.result as string);
        setImageUploading(false);
      };
      reader.readAsDataURL(file);
    } 
  };

  const handleCreateProfile = async () => {
    if (!newProfileName.trim() || !user || imageUploading) return;

    const { data, error } = await supabase
      .from("profiles")
      .insert({
        owner_id: user.id,
        name: newProfileName.trim(),
        description: newProfileDesc.trim() || null,
        visibility: newProfileIsPublic ? "public" : "private",
        image_data: newProfileImage,
        punch_count: 0,
        hug_count: 0,
        kiss_count: 0,
        notes_count: 0,
      })
      .select()
      .single();

    if (error || !data) {
      console.error("Error creating profile:", error);
      return;
    }

    const newProfile: Profile = {
      id: data.id,
      ownerId: data.owner_id,
      name: data.name,
      description: data.description || undefined,
      visibility: data.visibility === "public" ? "public" : "private",
      imageData: data.image_data || null,
      createdAt: data.created_at ? new Date(data.created_at).getTime() : Date.now(),
      punchCount: data.punch_count ?? 0,
      hugCount: data.hug_count ?? 0,
      kissCount: data.kiss_count ?? 0,
      notesCount: data.notes_count ?? 0,
    };

    const updated = [newProfile, ...profiles];
    setProfiles(updated);
    localStorage.setItem(storageKey("currentProfileId"), newProfile.id);

    if (newProfile.imageData) {
      setProfileImages((prev) => ({ ...prev, [newProfile.id]: newProfile.imageData as string }));
    }

    // Reset form
    setNewProfileName("");
    setNewProfileDesc("");
    setNewProfileImage(null);
    setNewProfileIsPublic(false);
    setShowCreateModal(false);

    // Navigate to character page with new profile
    router.push("/character");
  };

  const handleSelectProfile = (profileId: string) => {
    localStorage.setItem(storageKey("currentProfileId"), profileId);
    router.push("/character");
  };

  return (
    <>
      <Navbar />
      <main className="min-h-screen flex flex-col items-center justify-center p-8 pt-24 bg-gradient-to-br from-white via-blue-50 via-pink-50 to-yellow-50">
      <div className="w-full max-w-md space-y-8">
        <h1 className="text-4xl font-bold text-center text-gray-800">Say what you never could</h1>

        {profilesLoading && (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={`profile-skeleton-${i}`}
                className="w-full h-14 rounded-lg bg-white/60 backdrop-blur-sm border border-gray-100 animate-pulse"
              />
            ))}
          </div>
        )}

        {!profilesLoading && profiles.length > 0 && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setShowProfileSelector(true)}
              className="w-full py-3 px-4 bg-white/80 backdrop-blur-sm rounded-lg shadow-md hover:shadow-lg transition-all text-center font-medium text-gray-700"
            >
              Select Existing Profile
            </button>
          </div>
        )}

        <div className="space-y-4">
          <button
            type="button"
            onClick={() => {
              console.log("Button clicked, setting showCreateModal to true");
              setShowCreateModal(true);
            }}
            className="w-full py-3 px-4 bg-gradient-to-r from-pink-400 to-pink-500 text-white rounded-lg font-medium hover:from-pink-500 hover:to-pink-600 transition-all shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
          >
            + Create New Profile
          </button>
        </div>
      </div>

      {/* Profile Selector Modal */}
      <AnimatePresence>
        {showProfileSelector && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => setShowProfileSelector(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-xl p-6 w-full max-w-md space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-gray-800">Select Profile</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {profiles.map((profile) => (
                  <button
                    key={profile.id}
                    type="button"
                    onClick={() => handleSelectProfile(profile.id)}
                    className="w-full text-left p-3 rounded-lg transition-all bg-gray-50 hover:bg-gray-100 border-2 border-transparent hover:border-pink-200 flex items-center gap-3"
                  >
                    {profileImages[profile.id] ? (
                      <img
                        src={profileImages[profile.id]}
                        alt={profile.name}
                        className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-800">{profile.name}</div>
                      {profile.description && (
                        <div className="text-sm text-gray-600 mt-1 truncate">{profile.description}</div>
                      )}
                      <div className="text-xs text-gray-500 mt-1">
                        {profile.visibility === "public" ? "Public" : "Private"}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Profile Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white rounded-xl p-6 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
            <h3 className="text-xl font-bold text-gray-800">Create New Profile</h3>
            
            {/* Image Upload */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Profile Image (optional)</label>
              <div className="border-2 border-dashed border-blue-200 rounded-lg p-4 text-center bg-gray-50">
                {newProfileImage ? (
                  <div className="space-y-2">
                    <img
                      src={newProfileImage}
                      alt="Preview"
                      className="max-w-full max-h-32 mx-auto rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => setNewProfileImage(null)}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Remove image
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer block">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <div className="space-y-2">
                      {imageUploading ? (
                        <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                          <span className="h-4 w-4 rounded-full border-2 border-gray-300 border-t-gray-500 animate-spin" />
                          Uploading...
                        </div>
                      ) : (
                        <p className="text-gray-500 text-sm">Click to upload an image</p>
                      )}
                      <p className="text-xs text-gray-400">PNG, JPG, or GIF</p>
                    </div>
                  </label>
                )}
              </div>
            </div>

            <input
              type="text"
              value={newProfileName}
              onChange={(e) => setNewProfileName(e.target.value)}
              placeholder="Profile name (e.g., Manager, Parents)"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-300"
            />
            <textarea
              value={newProfileDesc}
              onChange={(e) => setNewProfileDesc(e.target.value)}
              placeholder="Description (optional)"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-300 min-h-20 resize-none"
            />

            {/* Public/Private Toggle */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">Visibility</span>
              <button
                type="button"
                onClick={() => setNewProfileIsPublic(!newProfileIsPublic)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  newProfileIsPublic ? "bg-pink-500" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    newProfileIsPublic ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
              <span className="text-sm text-gray-600">{newProfileIsPublic ? "Public" : "Private"}</span>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="flex-1 py-2 px-4 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateProfile}
                disabled={!newProfileName.trim() || imageUploading}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                  newProfileName.trim() && !imageUploading
                    ? "bg-gradient-to-r from-pink-400 to-pink-500 text-white hover:from-pink-500 hover:to-pink-600 shadow-lg hover:shadow-xl"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
              >
                {imageUploading ? "Uploading..." : "Create"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
      </main>
    </>
  );
}
