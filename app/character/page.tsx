"use client";

/**
 * ARCHITECTURE LOCK — DO NOT MODIFY WITHOUT REVIEW
 * Core pages: Login + Character (single-page experience).
 * Single source of truth: profiles[] + activeProfileId.
 * Profiles are loaded from Supabase only. Sharing/permissions must remain intact.
 */
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import Navbar from "@/components/Navbar";
import { supabase } from "@/lib/supabaseClient";
import {
  validateProfileName,
  validateProfileDescription,
  validateNoteText,
  validateEmotionType,
  sanitizeText,
  rateLimiter,
  getRateLimitKey,
  RATE_LIMITS,
} from "@/lib/security";
import { QUERY_LIMITS } from "@/lib/query-helpers";
import {
  isE2EEAvailable,
  ensureUserEncryptionKeys,
  getOrCreateProfileKeyForUser,
  ensureKeySharesForCollaborators,
  loadAndDecryptNotes,
  createEncryptedNote,
} from "@/lib/e2ee-notes";
import type { Profile, Note, Review } from "../types";

const NotesPanel = dynamic(() => import("@/components/NotesPanel"), { ssr: false });
const WriteNoteModal = dynamic(() => import("@/components/WriteNoteModal"), { ssr: false });

export default function CharacterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const sharedProfileId = searchParams.get("profile");
  const isGuestMode = !user && searchParams.get("guest") === "1";
  const shouldPromptCreate = searchParams.get("create") === "1";
  const createProfileType = searchParams.get("type") === "mirror" ? "mirror" : "express";
  const [guestSeed] = useState(() => Math.floor(Math.random() * 1000000));
  const guestProfile = useMemo<Profile>(
    () => ({
      id: "guest-profile",
      ownerId: "guest",
      name: "John Doe",
      description: "Guest mode",
      profileType: "express",
      visibility: "private",
      createdAt: Date.now(),
      punchCount: 0,
      hugCount: 0,
      kissCount: 0,
      notesCount: 0,
      imageData: `https://i.pravatar.cc/900?img=${(guestSeed % 70) + 1}`,
    }),
    [guestSeed]
  );
  // Profile management
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [newProfileDesc, setNewProfileDesc] = useState("");
  const [newProfileBio, setNewProfileBio] = useState("");
  const [newProfileImage, setNewProfileImage] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [newProfileIsPublic, setNewProfileIsPublic] = useState(false);
  const [newProfileType, setNewProfileType] = useState<"express" | "mirror">("express");
  const [showProfileSelector, setShowProfileSelector] = useState(false);
  const [profileImages, setProfileImages] = useState<Record<string, string>>({});
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [deleteConfirmProfileId, setDeleteConfirmProfileId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [collaborators, setCollaborators] = useState<
    { id: string; user_id: string; display_name: string | null; avatar_url: string | null }[]
  >([]);
  const [accessDenied, setAccessDenied] = useState(false);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [switchingProfile, setSwitchingProfile] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  const [mirrorReviews, setMirrorReviews] = useState<Review[]>([]);
  const [mirrorReviewsLoading, setMirrorReviewsLoading] = useState(false);
  const [collabActionId, setCollabActionId] = useState<string | null>(null);
  const [shareCopying, setShareCopying] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [isProfilesSheetOpen, setIsProfilesSheetOpen] = useState(false);
  const [sheetDragStartY, setSheetDragStartY] = useState<number | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deletingNotesRef = useRef<Record<string, boolean>>({});
  const lastNotesProfileIdRef = useRef<string | null>(null);
  const imageLoadInProgressRef = useRef<string | null>(null);
  
  // Sidebar state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  
  // Mobile notes
  const [isMobile, setIsMobile] = useState(false);
  const [showNotesSheet, setShowNotesSheet] = useState(false);

  // Character data
  const [image, setImage] = useState<string | null>(null);
  const [characterName, setCharacterName] = useState<string>("");

  // Interactions
  const [isPunching, setIsPunching] = useState(false);
  const [isHugging, setIsHugging] = useState(false);
  const [isKissing, setIsKissing] = useState(false);
  const [showWriteModal, setShowWriteModal] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteEmotionType, setNoteEmotionType] = useState<"anger" | "feelings" | "appreciation">(
    "feelings"
  );
  const [notes, setNotes] = useState<Note[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const noteInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [showGuestPrompt, setShowGuestPrompt] = useState(false);
  const [hasAutoOpenedCreate, setHasAutoOpenedCreate] = useState(false);
  const [profileFilter, setProfileFilter] = useState<"express" | "mirror">("express");

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      // Auto-collapse sidebar on mobile
      if (mobile) {
        setIsSidebarCollapsed(true);
      }
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (!isMobile) return;
    const shouldLock =
      isProfilesSheetOpen ||
      showNotesSheet ||
      showWriteModal ||
      showProfileModal ||
      showProfileSelector;
    document.body.style.overflow = shouldLock ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [
    isMobile,
    isProfilesSheetOpen,
    showNotesSheet,
    showWriteModal,
    showProfileModal,
    showProfileSelector,
  ]);

  useEffect(() => {
    if (!isGuestMode) return;
    const timer = setTimeout(() => {
      setShowGuestPrompt(true);
    }, 60000);
    return () => clearTimeout(timer);
  }, [isGuestMode]);

  useEffect(() => {
    if (!isGuestMode) return;
    setProfiles([guestProfile]);
    setProfileImages(
      guestProfile.imageData ? { [guestProfile.id]: guestProfile.imageData } : {}
    );
    setCurrentProfileId(guestProfile.id);
    setCharacterName(guestProfile.name);
    setImage(guestProfile.imageData || null);
    setNotes([]);
    setProfilesLoading(false);
  }, [isGuestMode, guestProfile]);

  useEffect(() => {
    if (!user || isGuestMode || !isE2EEAvailable()) return;
    ensureUserEncryptionKeys(supabase, user.id).catch(console.warn);
  }, [user, isGuestMode]);

  useEffect(() => {
    if (isMobile) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isMobile]);

  const resetEditMode = () => {
    setEditingProfileId(null);
    setNewProfileName("");
    setNewProfileDesc("");
    setNewProfileBio("");
    setNewProfileImage(null);
    setNewProfileIsPublic(false);
    setNewProfileType("express");
    setImageUploadError(null);
  };

  const openCreateModal = useCallback((type: "express" | "mirror") => {
    resetEditMode();
    setNewProfileType(type);
    setNewProfileIsPublic(type === "mirror");
    setShowProfileModal(true);
  }, []);

  useEffect(() => {
    if (hasAutoOpenedCreate || !user || profilesLoading || !shouldPromptCreate) {
      return;
    }
    openCreateModal(createProfileType);
    setHasAutoOpenedCreate(true);
    // Remove the create/type params so refreshing doesn't reopen the modal.
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    params.delete("create");
    params.delete("type");
    const query = params.toString();
    router.replace(query ? `/app?${query}` : "/app");
  }, [
    hasAutoOpenedCreate,
    user,
    profilesLoading,
    shouldPromptCreate,
    createProfileType,
    openCreateModal,
    searchParams,
    router,
  ]);

  // Redirect unauthenticated users
  useEffect(() => {
    if (!loading && !user && !isGuestMode) {
      const redirectPath = sharedProfileId ? `/app?profile=${sharedProfileId}` : "/app";
      router.replace(`/login?redirect=${encodeURIComponent(redirectPath)}`);
    }
  }, [loading, user, router, sharedProfileId, isGuestMode]);

  // Storage key helpers scoped per user (current profile pointer only)
  const storageKey = (base: string) => `u:${user?.id}:${base}`;
  const profilesCacheKey = () => storageKey("profilesCache");
  const profileImagesCacheKey = () => storageKey("profileImagesCache");
  const sharedProfilesCacheKey = () => storageKey("sharedProfilesCache");
  const notesCacheKey = (profileId: string) => storageKey(`notesCache:${profileId}`);
  const shouldLogTimings = () =>
    typeof window !== "undefined" &&
    window.localStorage.getItem("debug:timings") === "1";

  const logTiming = (label: string, start: number | null) => {
    if (start === null || !shouldLogTimings()) return;
    console.info(`[timing] ${label}: ${Math.round(performance.now() - start)}ms`);
  };

  const mapProfile = (p: any): Profile => ({
    id: p.id,
    ownerId: p.owner_id,
    name: p.name,
    description: p.description || undefined,
    bio: p.bio || undefined,
    profileType: p.profile_type ?? "express",
    visibility: p.visibility === "public" ? "public" : "private",
    imageData: p.image_data || null,
    createdAt: p.created_at ? new Date(p.created_at).getTime() : Date.now(),
    punchCount: p.punch_count ?? 0,
    hugCount: p.hug_count ?? 0,
    kissCount: p.kiss_count ?? 0,
    notesCount: p.notes_count ?? 0,
  });

  const loadProfileImage = async (profileId: string) => {
    if (!profileId || isGuestMode) return null;
    if (profileImages[profileId]) return profileImages[profileId];
    const { data, error } = await supabase
      .from("profiles")
      .select("image_data")
      .eq("id", profileId)
      .maybeSingle();

    if (error) {
      console.error("Error loading profile image:", error);
      return null;
    }

    const imageData = data?.image_data || null;
    if (!imageData) return null;

    setProfileImages((prev) => ({ ...prev, [profileId]: imageData }));
    setProfiles((prev) =>
      prev.map((p) => (p.id === profileId ? { ...p, imageData } : p))
    );
    return imageData;
  };

  const uploadProfileImage = async (
    file: File
  ): Promise<{ url: string | null; sizeError?: boolean; formatError?: boolean }> => {
    if (!user) return { url: null };
    const fileExt = file.name.split(".").pop() || "jpg";
    const path = `profiles/${user.id}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${fileExt}`;
    const { error } = await supabase.storage
      .from("profile-images")
      .upload(path, file, { upsert: true, cacheControl: "3600" });
    if (error) {
      console.error("Error uploading profile image:", error);
      const msg = error.message?.toLowerCase() ?? "";
      const isFormatError = msg.includes("mime") && msg.includes("not supported");
      const isSizeError =
        !isFormatError &&
        (msg.includes("maximum") || msg.includes("exceeded") || msg.includes("size"));
      return { url: null, sizeError: !!isSizeError, formatError: !!isFormatError };
    }
    const { data } = supabase.storage.from("profile-images").getPublicUrl(path);
    return { url: data.publicUrl || null };
  };

  const sortNotesByDate = (items: Note[]) => {
    return [...items].sort((a, b) => {
      const aTime = a.createdAt ?? 0;
      const bTime = b.createdAt ?? 0;
      if (!a.createdAt && !b.createdAt) return 0;
      if (!a.createdAt) return 1;
      if (!b.createdAt) return -1;
      return bTime - aTime;
    });
  };

  const formatNoteDate = (timestamp?: number) => {
    if (!timestamp) return "—";
    const date = new Date(timestamp);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.round(
      (startOfToday.getTime() - startOfDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  };

  const getNoteHeaderText = (emotionType?: Note["emotionType"]) => {
    switch (emotionType) {
      case "anger":
        return "messed up";
      case "appreciation":
        return "lets go!!";
      case "feelings":
      default:
        return "just saying";
    }
  };

  const getNoteTagClasses = (emotionType?: Note["emotionType"]) => {
    switch (emotionType) {
      case "anger":
        return "bg-red-100 text-red-700";
      case "appreciation":
        return "bg-green-100 text-green-700";
      case "feelings":
      default:
        return "bg-blue-100 text-blue-700";
    }
  };

  const loadProfileNotes = async (profileId: string) => {
    const notesStart = shouldLogTimings() ? performance.now() : null;
    if (isGuestMode) {
      setNotesLoading(false);
      logTiming(`notes guest mode`, notesStart);
      return;
    }
    if (!profileId) {
      setNotes([]);
      setNotesLoading(false);
      logTiming(`notes empty profile`, notesStart);
      return;
    }
    const useE2EE = isE2EEAvailable() && !!user;

    if (useE2EE) {
      setNotesLoading(true);
      const profile = profiles.find((p) => p.id === profileId);
      const isOwner = !!profile && !!user && profile.ownerId === user.id;
      await getOrCreateProfileKeyForUser(supabase, profileId, user.id, isOwner);
      if (isOwner) {
        await ensureKeySharesForCollaborators(supabase, profileId, user.id);
      }
      const decrypted = await loadAndDecryptNotes(
        supabase,
        profileId,
        user!.id,
        isOwner
      );
      const sorted = sortNotesByDate(decrypted);
      setNotes(sorted);
      setNotesLoading(false);
      logTiming(`notes e2ee fetch ${profileId}`, notesStart);
      return;
    }

    let hasCachedNotes = false;
    try {
      const cached = localStorage.getItem(notesCacheKey(profileId));
      if (cached) {
        const parsed = JSON.parse(cached) as Note[];
        if (Array.isArray(parsed)) {
          setNotes(parsed);
          hasCachedNotes = true;
          setNotesLoading(false);
        }
      }
    } catch (error) {
      console.warn("Failed to read notes cache:", error);
    }
    if (!hasCachedNotes) {
      setNotesLoading(true);
    }
    let data: any = null;
    let error: any = null;
    ({ data, error } = await supabase
      .from("profile_notes")
      .select("id, text, ciphertext, iv, user_id, emotion_type, created_at")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false })
      .limit(QUERY_LIMITS.NOTES_MAX));

    if (error) {
      console.error("Error loading notes:", error);
      setNotesLoading(false);
      logTiming(`notes error ${profileId}`, notesStart);
      return;
    }

    const mapped: Note[] =
      data?.map((n: any) => ({
        id: n.id,
        text: n.text ?? "[Unable to decrypt]",
        authorId: n.user_id,
        emotionType: (n.emotion_type as Note["emotionType"]) || "feelings",
        createdAt: n.created_at ? new Date(n.created_at).getTime() : undefined,
      })) || [];
    const sorted = sortNotesByDate(mapped);
    setNotes(sorted);
    try {
      localStorage.setItem(notesCacheKey(profileId), JSON.stringify(sorted));
    } catch (error) {
      console.warn("Failed to write notes cache:", error);
    }
    setNotesLoading(false);
    logTiming(`notes fetch ${profileId}`, notesStart);
  };

  const ensureCollaborator = async (profileId: string) => {
    if (!user) return;
    const { data: existing } = await supabase
      .from("profile_collaborators")
      .select("id")
      .eq("profile_id", profileId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing?.id) return;

    const displayName =
      (user.user_metadata?.full_name as string | undefined) ||
      (user.user_metadata?.name as string | undefined) ||
      user.email ||
      "Anonymous";
    const avatarUrl = (user.user_metadata?.avatar_url as string | undefined) || null;

    const { error } = await supabase.from("profile_collaborators").insert({
      profile_id: profileId,
      user_id: user.id,
      display_name: displayName,
      avatar_url: avatarUrl,
    });

    if (!error) {
      setToastMessage("User added to profile");
      setTimeout(() => setToastMessage(null), 2000);
    }
  };

  // Load profiles and handle shared links
  useEffect(() => {
    const loadProfiles = async () => {
      if (!user || isGuestMode) return;
      const totalStart = shouldLogTimings() ? performance.now() : null;
      let hasCachedProfiles = false;
      let cachedParsedProfiles: Profile[] | null = null;
      let cachedSharedProfiles: Profile[] = [];
      try {
        const cachedProfiles = localStorage.getItem(profilesCacheKey());
        if (cachedProfiles) {
          const parsed = JSON.parse(cachedProfiles) as Profile[];
          if (Array.isArray(parsed)) {
            const normalized = parsed.map((profile) => ({
              ...profile,
              profileType: profile.profileType ?? "express",
            }));
            cachedParsedProfiles = normalized;
            setProfiles(normalized);
            hasCachedProfiles = true;
          }
        }
        const cachedImages = localStorage.getItem(profileImagesCacheKey());
        if (cachedImages) {
          const parsedImages = JSON.parse(cachedImages) as Record<string, string>;
          if (parsedImages && typeof parsedImages === "object") {
            setProfileImages(parsedImages);
          }
        }
        const cachedShared = localStorage.getItem(sharedProfilesCacheKey());
        if (cachedShared) {
          const parsedShared = JSON.parse(cachedShared) as Profile[];
          if (Array.isArray(parsedShared)) {
            cachedSharedProfiles = parsedShared;
          }
        }
        if (hasCachedProfiles && cachedParsedProfiles && !sharedProfileId) {
          const storedCurrentId = localStorage.getItem(storageKey("currentProfileId"));
          const storedCachedProfile =
            storedCurrentId
              ? cachedParsedProfiles.find((p) => p.id === storedCurrentId)
              : undefined;
          if (storedCachedProfile) {
            setCurrentProfileId(storedCachedProfile.id);
            setProfileFilter(storedCachedProfile.profileType ?? "express");
            setSwitchingProfile(true);
          } else if (cachedParsedProfiles.length) {
            const firstProfile = cachedParsedProfiles[0];
            setCurrentProfileId(firstProfile.id);
            setProfileFilter(firstProfile.profileType ?? "express");
            localStorage.setItem(storageKey("currentProfileId"), firstProfile.id);
            setSwitchingProfile(true);
          }
        }
      } catch (error) {
        console.warn("Failed to read profiles cache:", error);
      }
      setProfilesLoading(!hasCachedProfiles);
      setAccessDenied(false);
      try {
        const ownedSharedStart = shouldLogTimings() ? performance.now() : null;
        const [ownedResult, sharedIdsResult] = await Promise.all([
          supabase
            .from("profiles")
            .select(
            "id, owner_id, name, description, bio, profile_type, visibility, punch_count, hug_count, kiss_count, notes_count, created_at"
            )
            .eq("owner_id", user.id)
            .order("created_at", { ascending: false })
            .limit(QUERY_LIMITS.PROFILES_MAX),
          supabase
            .from("profile_collaborators")
            .select("profile_id")
            .eq("user_id", user.id)
            .limit(QUERY_LIMITS.COLLABORATORS_MAX),
        ]);
        logTiming("profiles owned + collaborator ids", ownedSharedStart);

        const { data: owned, error: ownedError } = ownedResult;
        const { data: sharedIds, error: sharedIdsError } = sharedIdsResult;

        if (ownedError) {
          console.error("Error loading owned profiles:", {
            message: ownedError.message,
            code: ownedError.code,
            details: ownedError.details,
            hint: ownedError.hint,
          });
          return;
        }

        const ownedProfiles = (owned || []).map(mapProfile);

        if (sharedIdsError) {
          console.error("Error loading collaborator ids:", sharedIdsError);
        }

        const sharedProfileIds = (sharedIds || []).map((r) => r.profile_id);
        let sharedProfiles: Profile[] = [];
        if (sharedProfileIds.length > 0) {
          const sharedProfilesStart = shouldLogTimings() ? performance.now() : null;
          const { data: shared, error: sharedError } = await           supabase
            .from("profiles")
            .select(
            "id, owner_id, name, description, bio, profile_type, visibility, punch_count, hug_count, kiss_count, notes_count, created_at"
            )
            .in("id", sharedProfileIds.slice(0, QUERY_LIMITS.PROFILES_MAX))
            .order("created_at", { ascending: false })
            .limit(QUERY_LIMITS.PROFILES_MAX);
          logTiming("profiles shared fetch", sharedProfilesStart);

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

        let activeFromLink: Profile | null = null;
        if (sharedProfileId) {
          const sharedLinkStart = shouldLogTimings() ? performance.now() : null;
          const { data: sharedLinkData, error: sharedLinkError } = await supabase
            .from("profiles")
            .select(
            "id, owner_id, name, description, bio, profile_type, visibility, punch_count, hug_count, kiss_count, notes_count, created_at"
            )
            .eq("id", sharedProfileId)
            .maybeSingle();
          logTiming(`profiles shared link ${sharedProfileId}`, sharedLinkStart);

          if (sharedLinkError || !sharedLinkData) {
            setAccessDenied(true);
            return;
          }

          const mapped = mapProfile(sharedLinkData);
          const isLinkOwner = mapped.ownerId === user.id;
          if (!isLinkOwner && mapped.visibility !== "public") {
            setAccessDenied(true);
            return;
          }

          mergedMap.set(mapped.id, mapped);
          activeFromLink = mapped;

          if (!isLinkOwner) {
            await ensureCollaborator(mapped.id);
            try {
              const existingCache = localStorage.getItem(sharedProfilesCacheKey());
              const parsedCache = existingCache ? (JSON.parse(existingCache) as Profile[]) : [];
              const nextCache = Array.isArray(parsedCache)
                ? [...parsedCache.filter((p) => p.id !== mapped.id), mapped]
                : [mapped];
              localStorage.setItem(sharedProfilesCacheKey(), JSON.stringify(nextCache));
            } catch (error) {
              console.warn("Failed to update shared profiles cache:", error);
            }
          }
        }

        for (const cached of cachedSharedProfiles) {
          if (!mergedMap.has(cached.id)) {
            mergedMap.set(cached.id, cached);
          }
        }

        const merged = Array.from(mergedMap.values()).sort(
          (a, b) => b.createdAt - a.createdAt
        );
        const normalizedMerged = merged.map((profile) => ({
          ...profile,
          profileType: profile.profileType ?? "express",
        }));

        setProfiles(normalizedMerged);
        try {
          localStorage.setItem(profilesCacheKey(), JSON.stringify(normalizedMerged));
        } catch (error) {
          console.warn("Failed to write profiles cache:", error);
        }
        try {
          const sharedCache = normalizedMerged.filter((p) => p.ownerId !== user.id);
          localStorage.setItem(sharedProfilesCacheKey(), JSON.stringify(sharedCache));
        } catch (error) {
          console.warn("Failed to write shared profiles cache:", error);
        }

        const images: Record<string, string> = {};
        for (const profile of normalizedMerged) {
          if (profile.imageData) images[profile.id] = profile.imageData;
        }
        setProfileImages(images);
        try {
          localStorage.setItem(profileImagesCacheKey(), JSON.stringify(images));
        } catch (error) {
          console.warn("Failed to write profile image cache:", error);
        }

        if (activeFromLink) {
          setCurrentProfileId(activeFromLink.id);
          setProfileFilter(activeFromLink.profileType ?? "express");
          setSwitchingProfile(true);
          return;
        }

        const storedCurrentId = localStorage.getItem(storageKey("currentProfileId"));
        if (storedCurrentId && normalizedMerged.some((p) => p.id === storedCurrentId)) {
          const storedProfile = normalizedMerged.find((p) => p.id === storedCurrentId);
          setCurrentProfileId(storedCurrentId);
          if (storedProfile?.profileType) {
            setProfileFilter(storedProfile.profileType);
          }
          setSwitchingProfile(true);
        } else if (normalizedMerged.length > 0) {
          const firstProfileId = normalizedMerged[0].id;
          setCurrentProfileId(firstProfileId);
          setProfileFilter(normalizedMerged[0].profileType ?? "express");
          localStorage.setItem(storageKey("currentProfileId"), firstProfileId);
          setSwitchingProfile(true);
        } else {
          setCurrentProfileId(null);
          setSwitchingProfile(false);
        }
      } finally {
        logTiming("profiles load total", totalStart);
        setProfilesLoading(false);
      }
    };

    loadProfiles();
  }, [user, sharedProfileId, isGuestMode]);

  useEffect(() => {
    if (!currentProfileId || profiles.length === 0 || isGuestMode) return;
    const profile = profiles.find((p) => p.id === currentProfileId);
    if (!profile) return;
    if (profile.profileType === "mirror") return;
    if (profile.imageData || profileImages[currentProfileId]) return;
    if (imageLoadInProgressRef.current === currentProfileId) return;
    imageLoadInProgressRef.current = currentProfileId;
    loadProfileImage(currentProfileId)
      .then((imageData) => {
        if (imageData) setImage(imageData);
      })
      .finally(() => {
        imageLoadInProgressRef.current = null;
      });
  }, [currentProfileId, profiles, profileImages, isGuestMode]);

  const handleNewProfileImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) {
      setImageUploadError(null);
      if (isGuestMode || !user) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setNewProfileImage(reader.result as string);
        };
        reader.readAsDataURL(file);
        return;
      }
      setImageUploading(true);
      uploadProfileImage(file).then((result) => {
        if (result.url) {
          setNewProfileImage(result.url);
        } else if (result.sizeError) {
          setImageUploadError("Image cannot be more than 15 mb");
        } else if (result.formatError) {
          setImageUploadError("File format not supported");
        } else {
          setToastMessage("Image upload failed");
          setTimeout(() => setToastMessage(null), 2000);
        }
        setImageUploading(false);
      });
    }
  };

  const openEditModal = useCallback((profileId: string) => {
    const profile = profiles.find((p) => p.id === profileId);
    if (!profile) return;
    
    const profileType = profile.profileType ?? "express";
    setEditingProfileId(profileId);
    setNewProfileName(profile.name);
    setNewProfileDesc(profile.description || "");
    setNewProfileBio(profile.bio || "");
    setNewProfileType(profileType);
    setNewProfileIsPublic(profileType === "mirror" ? true : profile.visibility === "public");
    setNewProfileImage(profile.imageData || profileImages[profileId] || null);
    setShowProfileModal(true);
  }, [profiles, profileImages]);

  const handleDeleteProfile = async (profileId: string) => {
    await supabase.from("profiles").delete().eq("id", profileId);

    const updated = profiles.filter((p) => p.id !== profileId);
    setProfiles(updated);

    const newImages = { ...profileImages };
    delete newImages[profileId];
    setProfileImages(newImages);
    
    // If deleting current profile, switch to first available (effect will load notes)
    if (currentProfileId === profileId) {
      if (updated.length > 0) {
        setCurrentProfileId(updated[0].id);
        localStorage.setItem(storageKey("currentProfileId"), updated[0].id);
      } else {
        setCurrentProfileId(null);
        localStorage.removeItem(storageKey("currentProfileId"));
        setImage(null);
        setCharacterName("");
        setNotes([]);
      }
    }
    
    setDeleteConfirmProfileId(null);
  };

  const createProfile = async () => {
    if (profileSaving) return;
    if (isGuestMode || !newProfileName.trim() || !user) return;

    const isMirrorProfile = newProfileType === "mirror";
    if (!newProfileImage && !isMirrorProfile) return;

    // Validate inputs
    const nameValidation = validateProfileName(newProfileName);
    if (!nameValidation.valid) {
      setToastMessage(nameValidation.error || "Invalid profile name");
      setTimeout(() => setToastMessage(null), 2000);
      return;
    }

    const descValidation = validateProfileDescription(isMirrorProfile ? newProfileBio : newProfileDesc);
    if (!descValidation.valid) {
      setToastMessage(descValidation.error || "Invalid profile description");
      setTimeout(() => setToastMessage(null), 2000);
      return;
    }

    // Rate limiting check (client-side)
    if (!editingProfileId) {
      const rateLimitKey = getRateLimitKey(user.id, "profile_create");
      if (!rateLimiter.checkLimit(rateLimitKey, RATE_LIMITS.PROFILE_CREATE_PER_MINUTE)) {
        setToastMessage("Too many profiles created. Please wait a moment.");
        setTimeout(() => setToastMessage(null), 2000);
        return;
      }
    }

    setProfileSaving(true);

    // Sanitize inputs
    const sanitizedName = sanitizeText(newProfileName);
    const sanitizedDesc = newProfileDesc ? sanitizeText(newProfileDesc) : null;
    const sanitizedBio = newProfileBio ? sanitizeText(newProfileBio) : null;
    const profileVisibility = isMirrorProfile ? "public" : newProfileIsPublic ? "public" : "private";

    if (editingProfileId) {
      const { data, error } = await supabase
        .from("profiles")
        .update({
          name: sanitizedName,
          description: isMirrorProfile ? null : sanitizedDesc,
          bio: isMirrorProfile ? sanitizedBio : null,
          profile_type: isMirrorProfile ? "mirror" : "express",
          visibility: profileVisibility,
          image_data: newProfileImage,
        })
        .eq("id", editingProfileId)
        .select()
        .single();

      if (error || !data) {
        console.error("Error updating profile:", error);
        setProfileSaving(false);
        return;
      }

      if (isMirrorProfile || !newProfileIsPublic) {
        await supabase.from("profile_collaborators").delete().eq("profile_id", editingProfileId);
        if (isE2EEAvailable()) {
          await supabase.from("profile_key_shares").delete().eq("profile_id", editingProfileId);
        }
      }

      const updatedProfile = mapProfile(data);
      const updated = profiles.map((p) => (p.id === editingProfileId ? updatedProfile : p));
      setProfiles(updated);

      if (updatedProfile.profileType && updatedProfile.profileType !== profileFilter) {
        setProfileFilter(updatedProfile.profileType);
      }

      if (updatedProfile.imageData) {
        setProfileImages({ ...profileImages, [editingProfileId]: updatedProfile.imageData });
      }

      if (currentProfileId === editingProfileId) {
        setCharacterName(updatedProfile.name);
        setImage(updatedProfile.imageData || null);
      }

    if (updatedProfile.profileType === "mirror") {
      setNotes([]);
    }

      resetEditMode();
      setShowProfileModal(false);
      setProfileSaving(false);
    } else {
      const { data, error } = await supabase
        .from("profiles")
        .insert({
          owner_id: user.id,
          name: sanitizedName,
          description: isMirrorProfile ? null : sanitizedDesc,
          bio: isMirrorProfile ? sanitizedBio : null,
          profile_type: isMirrorProfile ? "mirror" : "express",
          visibility: profileVisibility,
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
        setProfileSaving(false);
        return;
      }

      const newProfile = mapProfile(data);
      const updated = [newProfile, ...profiles];
      setProfiles(updated);
      if (newProfile.profileType && newProfile.profileType !== profileFilter) {
        setProfileFilter(newProfile.profileType);
      }
      setCurrentProfileId(newProfile.id);
      localStorage.setItem(storageKey("currentProfileId"), newProfile.id);

      if (newProfile.imageData) {
        setImage(newProfile.imageData);
        setProfileImages({ ...profileImages, [newProfile.id]: newProfile.imageData });
      }

      resetEditMode();
      setShowProfileModal(false);
      setNotes([]);
      if (!newProfile.imageData) setImage(null);
      setCharacterName("");
      setProfileSaving(false);
    if (newProfile.profileType === "mirror") {
      setNotes([]);
    }
    }
  };

  const switchProfile = useCallback(
    (profileId: string, profileType?: "express" | "mirror") => {
      setCurrentProfileId(profileId);
      localStorage.setItem(storageKey("currentProfileId"), profileId);
      if (profileType && profileType !== profileFilter) {
        setProfileFilter(profileType);
      }
      setSwitchingProfile(true);
    // Effect will load notes when currentProfileId updates (single source of truth)
    if (isMobile) {
      setIsMobileDrawerOpen(false);
      setIsProfilesSheetOpen(false);
    }
    },
    [isMobile, profileFilter]
  );

  const handleKiss = async () => {
    if (isMirrorProfile || isKissing || isPunching || isHugging || noteSaving || switchingProfile) return;
    setIsKissing(true);
    setTimeout(() => {
      setIsKissing(false);
      if (isGuestMode) {
        if (currentProfileId) {
          const updated = profiles.map((p) =>
            p.id === currentProfileId ? { ...p, kissCount: p.kissCount + 1 } : p
          );
          setProfiles(updated);
        }
        return;
      }
      if (currentProfileId) {
        const updated = profiles.map((p) =>
          p.id === currentProfileId ? { ...p, kissCount: p.kissCount + 1 } : p
        );
        setProfiles(updated);
        const profile = updated.find((p) => p.id === currentProfileId);
        if (profile) {
          supabase.from("profiles").update({ kiss_count: profile.kissCount }).eq("id", profile.id);
        }
      }
    }, 800);
  };

  const handlePunch = async () => {
    if (isMirrorProfile || isPunching || isHugging || isKissing || noteSaving || switchingProfile) return;
    setIsPunching(true);
    setTimeout(() => {
      setIsPunching(false);
      if (isGuestMode) {
        if (currentProfileId) {
          const updated = profiles.map((p) =>
            p.id === currentProfileId ? { ...p, punchCount: p.punchCount + 1 } : p
          );
          setProfiles(updated);
        }
        return;
      }
      if (currentProfileId) {
        const updated = profiles.map((p) =>
          p.id === currentProfileId ? { ...p, punchCount: p.punchCount + 1 } : p
        );
        setProfiles(updated);
        const profile = updated.find((p) => p.id === currentProfileId);
        if (profile) {
          supabase.from("profiles").update({ punch_count: profile.punchCount }).eq("id", profile.id);
        }
      }
    }, 1300);
  };

  const handleHug = async () => {
    if (isMirrorProfile || isHugging || isPunching || isKissing || noteSaving || switchingProfile) return;
    setIsHugging(true);
    setTimeout(() => {
      setIsHugging(false);
      if (isGuestMode) {
        if (currentProfileId) {
          const updated = profiles.map((p) =>
            p.id === currentProfileId ? { ...p, hugCount: p.hugCount + 1 } : p
          );
          setProfiles(updated);
        }
        return;
      }
      if (currentProfileId) {
        const updated = profiles.map((p) =>
          p.id === currentProfileId ? { ...p, hugCount: p.hugCount + 1 } : p
        );
        setProfiles(updated);
        const profile = updated.find((p) => p.id === currentProfileId);
        if (profile) {
          supabase.from("profiles").update({ hug_count: profile.hugCount }).eq("id", profile.id);
        }
      }
    }, 1000);
  };

  const handleWrite = () => {
    if (isMirrorProfile) return;
    setShowWriteModal(true);
  };

  const handleSaveNote = async () => {
    if (isMirrorProfile) return;
    if (!noteText.trim() || !currentProfileId || (!user && !isGuestMode)) return;
    if (isGuestMode) {
      setNoteSaving(true);
      const newNote: Note = {
        id: `guest-${Date.now()}`,
        text: noteText.trim(),
        authorId: "guest",
        emotionType: noteEmotionType,
        createdAt: Date.now(),
      };
      const updatedNotes = sortNotesByDate([...notes, newNote]);
      setNotes(updatedNotes);
      const updatedProfiles = profiles.map((p) =>
        p.id === currentProfileId ? { ...p, notesCount: p.notesCount + 1 } : p
      );
      setProfiles(updatedProfiles);
      setNoteText("");
      setShowWriteModal(false);
      setNoteSaving(false);
      return;
    }
    if (!user) return;
    setNoteSaving(true);

    const plaintext = noteText.trim();
    const profile = profiles.find((p) => p.id === currentProfileId);
    const isOwner = !!profile && profile.ownerId === user.id;

    if (isE2EEAvailable()) {
      const newNote = await createEncryptedNote(
        supabase,
        currentProfileId,
        user.id,
        plaintext,
        noteEmotionType,
        isOwner
      );
      if (!newNote) {
        console.error("Failed to create encrypted note");
        setNoteSaving(false);
        return;
      }
      const updatedNotes = sortNotesByDate([...notes, newNote]);
      setNotes(updatedNotes);
      const updatedProfiles = profiles.map((p) =>
        p.id === currentProfileId ? { ...p, notesCount: p.notesCount + 1 } : p
      );
      setProfiles(updatedProfiles);
      const updatedProfile = updatedProfiles.find((p) => p.id === currentProfileId);
      if (updatedProfile) {
        await supabase
          .from("profiles")
          .update({ notes_count: updatedProfile.notesCount })
          .eq("id", currentProfileId);
      }
      setNoteText("");
      setNoteEmotionType("feelings");
      setShowWriteModal(false);
      setNoteSaving(false);
      return;
    }

    const nowIso = new Date().toISOString();
    let { data, error } = await supabase
      .from("profile_notes")
      .insert({
        profile_id: currentProfileId,
        user_id: user.id,
        text: plaintext,
        emotion_type: noteEmotionType,
        created_at: nowIso,
      })
      .select()
      .single();

    if (error || !data) {
      console.error("Error saving note:", error);
      setNoteSaving(false);
      return;
    }

    const newNote: Note = {
      id: data.id,
      text: data.text,
      authorId: data.user_id,
      emotionType: (data.emotion_type as Note["emotionType"]) || noteEmotionType,
      createdAt: data.created_at ? new Date(data.created_at).getTime() : Date.now(),
    };

    const updatedNotes = sortNotesByDate([...notes, newNote]);
    setNotes(updatedNotes);
    try {
      localStorage.setItem(notesCacheKey(currentProfileId), JSON.stringify(updatedNotes));
    } catch (error) {
      console.warn("Failed to write notes cache:", error);
    }

    const updatedProfiles = profiles.map((p) =>
      p.id === currentProfileId ? { ...p, notesCount: p.notesCount + 1 } : p
    );
    setProfiles(updatedProfiles);

    const updatedProfile = updatedProfiles.find((p) => p.id === currentProfileId);
    if (updatedProfile) {
      await supabase
        .from("profiles")
        .update({ notes_count: updatedProfile.notesCount })
        .eq("id", currentProfileId);
    }

    setNoteText("");
    setNoteEmotionType("feelings");
    setShowWriteModal(false);
    setNoteSaving(false);
  };

  const resizeNoteInput = () => {
    const el = noteInputRef.current;
    if (!el) return;
    el.style.height = "auto";
    const maxHeight = Math.round(window.innerHeight * 0.8);
    el.style.height = Math.min(el.scrollHeight, maxHeight) + "px";
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  };

  useEffect(() => {
    if (showWriteModal) {
      setTimeout(resizeNoteInput, 0);
    }
  }, [showWriteModal, noteText]);

  const handleDeleteNote = async (id: string, authorId: string) => {
    if (!currentProfileId) return;
    if (!isGuestMode && (!user || authorId !== user.id)) return;

    const previousNotes = [...notes];
    const previousProfiles = [...profiles];
    const updatedNotes = sortNotesByDate(notes.filter((note) => note.id !== id));
    setNotes(updatedNotes);
    if (!isGuestMode) {
      try {
        localStorage.setItem(notesCacheKey(currentProfileId), JSON.stringify(updatedNotes));
      } catch (error) {
        console.warn("Failed to write notes cache:", error);
      }
    }

    const updatedProfiles = profiles.map((p) =>
      p.id === currentProfileId ? { ...p, notesCount: Math.max(0, p.notesCount - 1) } : p
    );
    setProfiles(updatedProfiles);

    if (isGuestMode) {
      deletingNotesRef.current[currentProfileId] = false;
      setToastMessage("Note deleted");
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setToastMessage(null), 2000);
      return;
    }

    deletingNotesRef.current[currentProfileId] = true;
    const { error } = await supabase.from("profile_notes").delete().eq("id", id);
    if (error) {
      console.error("Error deleting note:", error);
      setNotes(previousNotes);
      setProfiles(previousProfiles);
      if (!isGuestMode) {
        try {
          localStorage.setItem(notesCacheKey(currentProfileId), JSON.stringify(previousNotes));
        } catch (err) {
          console.warn("Failed to restore notes cache:", err);
        }
      }
      deletingNotesRef.current[currentProfileId] = false;
      return;
    }

    const updatedProfile = updatedProfiles.find((p) => p.id === currentProfileId);
    if (updatedProfile) {
      await supabase
        .from("profiles")
        .update({ notes_count: updatedProfile.notesCount })
        .eq("id", currentProfileId);
    }

    deletingNotesRef.current[currentProfileId] = false;
    setToastMessage("Note deleted");
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMessage(null), 2000);
  };

  const filteredProfiles = useMemo(
    () => profiles.filter((profile) => (profile.profileType ?? "express") === profileFilter),
    [profiles, profileFilter]
  );

  // Derive active profile from filtered profiles (single source of truth)
  const activeProfile = currentProfileId
    ? filteredProfiles.find((p) => p.id === currentProfileId)
    : null;

  useEffect(() => {
    if (profiles.length === 0) return;
    const hasExpress = profiles.some((profile) => (profile.profileType ?? "express") === "express");
    const hasMirror = profiles.some((profile) => (profile.profileType ?? "express") === "mirror");
    if (profileFilter === "express" && !hasExpress && hasMirror) {
      setProfileFilter("mirror");
    }
  }, [profiles, profileFilter]);

  useEffect(() => {
    if (profilesLoading) return;
    if (filteredProfiles.length === 0) {
      setCurrentProfileId(null);
      setCharacterName("");
      setImage(null);
      setNotes([]);
      setSwitchingProfile(false);
      return;
    }
    if (!currentProfileId || !filteredProfiles.some((p) => p.id === currentProfileId)) {
      const nextProfileId = filteredProfiles[0].id;
      setCurrentProfileId(nextProfileId);
      if (user) {
        localStorage.setItem(storageKey("currentProfileId"), nextProfileId);
      }
    }
  }, [filteredProfiles, currentProfileId, user, profilesLoading]);

  const isOwner = !!activeProfile && !!user && activeProfile.ownerId === user.id;
  const isMirrorProfile = activeProfile?.profileType === "mirror";
  const canManageProfiles = !!user && !isGuestMode;

  type ReviewCategory = "appreciate" | "need_to_work_on" | "just_saying";

  const reviewCategoryLabel: Record<ReviewCategory, string> = {
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

  const renderReviewStars = (value: number) => (
    <div className="flex items-center gap-1 text-amber-500 text-sm">
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star}>{star <= value ? "★" : "☆"}</span>
      ))}
    </div>
  );

  const mirrorAverageRating = useMemo(() => {
    const ratingBySubmission = new Map<string, number>();
    for (const review of mirrorReviews) {
      const key = review.submissionId || review.id;
      if (!ratingBySubmission.has(key)) {
        ratingBySubmission.set(key, review.rating);
      }
    }
    if (ratingBySubmission.size === 0) return 0;
    const sum = Array.from(ratingBySubmission.values()).reduce((acc, rating) => acc + rating, 0);
    return Math.round((sum / ratingBySubmission.size) * 10) / 10;
  }, [mirrorReviews]);

  const mirrorCategoryCounts = useMemo(
    () =>
      mirrorReviews.reduce(
        (acc, review) => {
          const category = (review.category || "just_saying") as ReviewCategory;
          acc[category] += 1;
          return acc;
        },
        { appreciate: 0, need_to_work_on: 0, just_saying: 0 } as Record<ReviewCategory, number>
      ),
    [mirrorReviews]
  );

  const mirrorGroupedReviews = useMemo(() => {
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

    for (const review of mirrorReviews) {
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
  }, [mirrorReviews]);

  // Load profile data when currentProfileId or profiles change
  useEffect(() => {
    if (!currentProfileId || profiles.length === 0 || !activeProfile) return;

    setCharacterName(activeProfile.name);
    setImage(activeProfile.imageData || profileImages[activeProfile.id] || null);
    if (activeProfile.profileType === "mirror") {
      setNotes([]);
      setSwitchingProfile(false);
      return;
    }

    if (deletingNotesRef.current[currentProfileId]) {
      setSwitchingProfile(false);
      return;
    }

    if (lastNotesProfileIdRef.current === currentProfileId) return;
    lastNotesProfileIdRef.current = currentProfileId;

    setSwitchingProfile(true);
    loadProfileNotes(currentProfileId).finally(() => {
      setSwitchingProfile(false);
    });
  }, [currentProfileId, profiles, activeProfile, profileImages]);

  useEffect(() => {
    if (!activeProfile || !isMirrorProfile || !isOwner) {
      setMirrorReviews([]);
      setMirrorReviewsLoading(false);
      return;
    }
    let isMounted = true;
    const loadMirrorReviews = async () => {
      setMirrorReviewsLoading(true);
      const { data, error } = await supabase
        .from("reviews")
        .select("id, profile_id, rating, review_text, category, submission_id, created_at, status")
        .eq("profile_id", activeProfile.id)
        .order("created_at", { ascending: false });
      if (!isMounted) return;
      if (error) {
        console.error("Error loading mirror reviews:", {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        setMirrorReviews([]);
        setMirrorReviewsLoading(false);
        return;
      }
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
      setMirrorReviews(mapped);
      setMirrorReviewsLoading(false);
    };
    loadMirrorReviews();
    return () => {
      isMounted = false;
    };
  }, [activeProfile, isMirrorProfile, isOwner]);

  const loadCollaborators = async (profileId: string) => {
    if (!isOwner) return;
    const { data, error } = await supabase
      .from("profile_collaborators")
      .select("id, user_id, display_name, avatar_url")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: true })
      .limit(QUERY_LIMITS.COLLABORATORS_MAX);

    if (error) {
      console.error("Error loading collaborators:", error);
      return;
    }

    const filtered = (data || []).filter((c) => c.user_id !== activeProfile?.ownerId);
    setCollaborators(filtered);
  };

  const shareDisabledMessage = "Enable sharing to add collaborators";
  const canShareProfile = !!activeProfile && !isMirrorProfile && activeProfile.visibility === "public";

  const showShareDisabledMessage = useCallback(() => {
    setToastMessage(shareDisabledMessage);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMessage(null), 2000);
  }, [shareDisabledMessage]);

  const handleShareProfile = async () => {
    if (!activeProfile || !isOwner || isMirrorProfile) return;
    setShowShareModal(true);
    await loadCollaborators(activeProfile.id);
  };

  const handleCopyShareLink = async () => {
    if (!activeProfile) return;
    setShareCopying(true);
    const sharePath = `/app?profile=${activeProfile.id}`;
    const url = `${window.location.origin}/login?redirect=${encodeURIComponent(sharePath)}`;
    if (isMobile && typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({
          title: `Feelability - ${activeProfile.name}`,
          text: "View this profile on Feelability",
          url,
        });
        setToastMessage("Share sheet opened");
        setTimeout(() => setToastMessage(null), 2000);
      } catch (error) {
        const errorName = (error as DOMException)?.name;
        if (errorName !== "AbortError") {
          await navigator.clipboard.writeText(url);
          setToastMessage("Link copied");
          setTimeout(() => setToastMessage(null), 2000);
        }
      } finally {
        setShareCopying(false);
      }
      return;
    }

    await navigator.clipboard.writeText(url);
    setToastMessage("Link copied");
    setTimeout(() => setToastMessage(null), 2000);
    setShareCopying(false);
  };

  const handleCopyMirrorLink = async (profileId?: string | null) => {
    if (!profileId || typeof window === "undefined") return;
    const url = `${window.location.origin}/mirror/${profileId}`;
    await navigator.clipboard.writeText(url);
    setToastMessage("Public profile link copied");
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMessage(null), 2000);
  };

  const handleRemoveCollaborator = async (collabId: string) => {
    if (!activeProfile || !isOwner) return;
    const collab = collaborators.find((c) => c.id === collabId);
    setCollabActionId(collabId);
    await supabase.from("profile_collaborators").delete().eq("id", collabId);
    if (collab?.user_id && isE2EEAvailable()) {
      await supabase
        .from("profile_key_shares")
        .delete()
        .eq("profile_id", activeProfile.id)
        .eq("user_id", collab.user_id);
    }
    setCollaborators((prev) => prev.filter((c) => c.id !== collabId));
    setToastMessage("Access removed");
    setTimeout(() => setToastMessage(null), 2000);
    setCollabActionId(null);
  };

  const handleGuestContinue = () => {
    setShowGuestPrompt(false);
    const redirectPath = "/app?create=1";
    router.push(`/login?redirect=${encodeURIComponent(redirectPath)}`);
  };

  const handleGuestLater = () => {
    setShowGuestPrompt(false);
  };

  const isMirrorForm = newProfileType === "mirror";

  const profileFormContent = (
    <>
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-gray-800">
          {editingProfileId
            ? isMirrorForm
              ? "Edit Mirror Profile"
              : "Edit Profile"
            : isMirrorForm
            ? "Create Mirror Profile"
            : "Create New Profile"}
        </h3>
        <button
          onClick={() => {
            setShowProfileModal(false);
            resetEditMode();
          }}
          className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Close"
        >
          <svg
            className="w-5 h-5"
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
      </div>

      {/* Image Upload */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Profile Image</label>
        <div className="border-2 border-dashed border-blue-200 rounded-lg p-4 text-center bg-gray-50">
          {newProfileImage ? (
            <div className="space-y-2">
              <Image
                src={newProfileImage}
                alt="Preview"
                width={256}
                height={128}
                sizes="(max-width: 768px) 60vw, 256px"
                className="max-w-full max-h-32 mx-auto rounded-lg object-contain"
                unoptimized
              />
              <button
                onClick={() => setNewProfileImage(null)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Remove image
              </button>
            </div>
          ) : (
            <label className={`cursor-pointer ${imageUploading ? "pointer-events-none opacity-60" : ""}`}>
              <input
                type="file"
                accept="image/*"
                onChange={handleNewProfileImageUpload}
                className="hidden"
                disabled={imageUploading}
              />
              <div className="space-y-2">
                <p className="text-gray-500 text-sm">
                  {imageUploading ? "Uploading image..." : "Click to upload an image"}
                </p>
                <p className="text-xs text-gray-400">PNG, JPG, or GIF</p>
              </div>
            </label>
          )}
        </div>
        {imageUploadError && (
          <p className="mt-2 text-sm text-red-600">{imageUploadError}</p>
        )}
      </div>

      <label className="block text-sm font-medium text-gray-700">
        {isMirrorForm ? "Display name" : "Profile name"}
      </label>
      <div className="relative">
        <input
          type="text"
          value={newProfileName}
          onChange={(e) => setNewProfileName(e.target.value)}
          placeholder={isMirrorForm ? "e.g., Alex Morgan" : "Profile name (e.g., Manager, Parents)"}
          maxLength={30}
          className="w-full px-4 py-2 pr-16 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-300"
        />
        <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs ${
          newProfileName.length >= 30 ? "text-red-600" : "text-gray-400"
        }`}>
          {newProfileName.length}/30
        </span>
      </div>
      <label className="block text-sm font-medium text-gray-700">
        {isMirrorForm ? "Bio / role (optional)" : "Description (optional)"}
      </label>
      <div className="relative">
        <textarea
          value={isMirrorForm ? newProfileBio : newProfileDesc}
          onChange={(e) => (isMirrorForm ? setNewProfileBio(e.target.value) : setNewProfileDesc(e.target.value))}
          placeholder={isMirrorForm ? "Add your role for which you want the feedback" : "Description (optional)"}
          maxLength={50}
          className="w-full px-4 py-2 pr-16 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-300 min-h-20 resize-none"
        />
        <span className={`absolute bottom-2 right-3 text-xs ${
          (isMirrorForm ? newProfileBio.length : newProfileDesc.length) >= 50 ? "text-red-600" : "text-gray-400"
        }`}>
          {(isMirrorForm ? newProfileBio.length : newProfileDesc.length)}/50
        </span>
      </div>

      {!isMirrorForm ? (
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <span className="text-sm font-medium text-gray-700">Add collaborators</span>
          <button
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
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
            Mirror profiles are public so people can leave anonymous feedback.
          </div>
          {editingProfileId && (
            <button
              type="button"
              onClick={() => handleCopyMirrorLink(editingProfileId)}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-purple-200 bg-white px-3 py-2 text-sm font-medium text-purple-700 hover:bg-purple-50 transition-colors"
            >
              <span>Copy public link</span>
            </button>
          )}
        </div>
      )}

      {!isMobile && (
        <div className="flex gap-3">
          <button
            onClick={() => {
              setShowProfileModal(false);
              resetEditMode();
            }}
            className="flex-1 py-2 px-4 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
        <button
            onClick={createProfile}
          disabled={!newProfileName.trim() || (!newProfileImage && !isMirrorForm) || profileSaving || imageUploading}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
            newProfileName.trim() && (newProfileImage || isMirrorForm) && !profileSaving && !imageUploading
                ? "bg-gradient-to-r from-pink-400 to-pink-500 text-white hover:from-pink-500 hover:to-pink-600 shadow-lg hover:shadow-xl"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }`}
          >
          {profileSaving || imageUploading ? "Saving..." : editingProfileId ? "Save" : "Create"}
          </button>
        </div>
      )}
    </>
  );

  // Animation variants (unchanged)
  const punchVariants = {
    initial: { x: 0, rotate: 0, scale: 1 },
    punch: {
      x: [0, 15, 8, 0],
      rotate: [0, 2, -1, 0],
      scale: [1, 0.98, 0.99, 1],
      transition: {
        duration: 1.3,
        times: [0, 0.38, 0.69, 1],
        ease: [0.4, 0, 0.2, 1],
      },
    },
  };

  const scaleVariants = {
    initial: { scale: 1 },
    scale: {
      scale: [1, 1.1, 1],
      transition: { duration: 0.5, times: [0, 0.5, 1] },
    },
  };

  const heartVariants = {
    initial: { y: 0, opacity: 1, scale: 0 },
    animate: { y: -100, opacity: 0, scale: 1 },
  };

  const kissVariants = {
    initial: { scale: 1, opacity: 1 },
    kiss: {
      scale: [1, 1.05, 1.02, 1],
      opacity: [1, 1, 1, 1],
      transition: {
        duration: 0.8,
        times: [0, 0.3, 0.6, 1],
        ease: "easeInOut",
      },
    },
  };

  // Shared empty-state UI (reusable for no-results states).
  const emptyStateContent = (
    <div className="h-[calc(100vh-4rem)] flex items-center justify-center px-6">
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-gray-100 text-center max-w-md">
        <h2 className="text-xl font-semibold text-gray-800">Choose how you want to start</h2>
        <p className="text-gray-600 mt-2">
          Create a private space to express feelings or a public profile for feedback.
        </p>
        <div className="mt-5 space-y-3">
          <button
            onClick={() => openCreateModal("express")}
            className="w-full px-5 py-3 rounded-lg bg-pink-500 text-white font-medium hover:bg-pink-600 transition-colors text-left"
          >
            <div className="font-semibold">Express about someone</div>
            <div className="text-sm text-pink-50">Create a private space to say what you feel.</div>
          </button>
          <button
            onClick={() => openCreateModal("mirror")}
            className="w-full px-5 py-3 rounded-lg border border-purple-200 text-purple-700 font-medium hover:bg-white transition-colors text-left"
          >
            <div className="font-semibold">Get feedback about yourself</div>
            <div className="text-sm text-purple-600">Create your public profile and let people share honest feedback.</div>
          </button>
        </div>
      </div>
    </div>
  );

  const characterContent = (
    <div className={`w-full ${isMirrorProfile ? "max-w-5xl" : "max-w-md"} space-y-1 relative`}>
      {isMirrorProfile ? (
        <div className="sticky top-4 z-10 space-y-3">
          <div className="bg-white/80 backdrop-blur-sm border border-gray-100 rounded-2xl p-4 shadow-md flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {image ? (
                <Image
                  src={image}
                  alt={characterName || "Mirror profile"}
                  width={48}
                  height={48}
                  className="w-12 h-12 rounded-xl object-cover bg-white"
                  unoptimized
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-gray-200 flex items-center justify-center text-xl">
                  😊
                </div>
              )}
              <div>
                <h2 className="text-lg font-semibold text-gray-800">{characterName}</h2>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white/70 px-3 py-1.5 text-sm">
                <span className="text-amber-500">★</span>
                <span className="font-semibold text-gray-800">{mirrorAverageRating || 0}</span>
                <span className="text-gray-300">|</span>
                <span className="text-gray-600">
                  {mirrorGroupedReviews.length} rating{mirrorGroupedReviews.length === 1 ? "" : "s"}
                </span>
              </div>
              {isOwner && activeProfile && (
                <button
                  type="button"
                  onClick={() => handleCopyMirrorLink(activeProfile.id)}
                  className="p-2 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                  title="Copy public link"
                  aria-label="Copy public link"
                >
                  <svg className="w-[18px] h-[18px]" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M13.2023 10.4049C12.7888 10.4074 12.381 10.5015 12.0082 10.6802C11.6354 10.8589 11.3069 11.1179 11.0462 11.4385L7.47767 9.79662C7.64541 9.28353 7.64541 8.73046 7.47767 8.21737L11.0462 6.57549C11.4663 7.08376 12.0528 7.42748 12.702 7.54596C13.3512 7.66445 14.0214 7.55009 14.5944 7.22307C15.1674 6.89605 15.6063 6.3774 15.8336 5.75867C16.0609 5.13993 16.062 4.46089 15.8367 3.84142C15.6114 3.22195 15.1743 2.70187 14.6023 2.37299C14.0304 2.0441 13.3605 1.92756 12.711 2.04394C12.0614 2.16031 11.4738 2.50211 11.052 3.00902C10.6303 3.51592 10.4014 4.15533 10.4058 4.81437C10.4077 4.98082 10.424 5.1468 10.4543 5.31047L6.75728 7.00793C6.36334 6.62311 5.86443 6.36294 5.32306 6.26004C4.7817 6.15714 4.22197 6.21608 3.71401 6.42948C3.20604 6.64288 2.77244 7.00124 2.46754 7.45966C2.16264 7.91808 2 8.45616 2 9.00649C2 9.55682 2.16264 10.0949 2.46754 10.5533C2.77244 11.0117 3.20604 11.3701 3.71401 11.5835C4.22197 11.7969 4.7817 11.8558 5.32306 11.7529C5.86443 11.65 6.36334 11.3899 6.75728 11.005L10.4523 12.7035C10.422 12.8672 10.4057 13.0332 10.4037 13.1996C10.4037 13.7526 10.5679 14.2931 10.8756 14.7529C11.1832 15.2126 11.6204 15.571 12.132 15.7826C12.6435 15.9942 13.2064 16.0495 13.7495 15.9417C14.2926 15.8338 14.7914 15.5675 15.1829 15.1765C15.5745 14.7855 15.8411 14.2874 15.9491 13.745C16.0572 13.2027 16.0017 12.6406 15.7898 12.1297C15.5779 11.6189 15.2191 11.1822 14.7587 10.875C14.2983 10.5678 13.757 10.4039 13.2033 10.4039L13.2023 10.4049ZM13.2023 3.417C13.4793 3.417 13.75 3.49901 13.9803 3.65267C14.2106 3.80633 14.39 4.02472 14.496 4.28024C14.602 4.53576 14.6297 4.81693 14.5757 5.08819C14.5217 5.35945 14.3883 5.60862 14.1925 5.80419C13.9966 5.99976 13.7471 6.13294 13.4755 6.1869C13.2039 6.24085 12.9223 6.21316 12.6664 6.10732C12.4106 6.00148 12.1919 5.82225 12.038 5.59228C11.8841 5.36232 11.802 5.09196 11.802 4.81538C11.802 4.63174 11.8382 4.4499 11.9086 4.28024C11.979 4.11058 12.0821 3.95643 12.2122 3.82658C12.3422 3.69672 12.4966 3.59372 12.6664 3.52344C12.8363 3.45317 13.0184 3.417 13.2023 3.417ZM4.80454 10.4049C4.52763 10.4049 4.25694 10.3229 4.02668 10.1693C3.79643 10.0157 3.61695 9.79732 3.51093 9.54186C3.40491 9.2864 3.37712 9.00528 3.43107 8.73405C3.48502 8.46282 3.61829 8.21365 3.81402 8.01804C4.00976 7.82243 4.25917 7.68917 4.53074 7.6351C4.8023 7.58103 5.08383 7.60858 5.33972 7.71426C5.59561 7.81995 5.81437 7.99903 5.96836 8.22886C6.12235 8.45868 6.20465 8.72895 6.20485 9.00548C6.20498 9.1892 6.16886 9.37115 6.09855 9.54093C6.02823 9.7107 5.92511 9.86498 5.79507 9.99494C5.66502 10.1249 5.51061 10.228 5.34065 10.2983C5.17069 10.3687 4.98852 10.4049 4.80454 10.4049ZM13.2023 14.598C12.9254 14.598 12.6546 14.516 12.4244 14.3623C12.1941 14.2087 12.0146 13.9903 11.9086 13.7348C11.8026 13.4792 11.7749 13.1981 11.8289 12.9268C11.883 12.6555 12.0163 12.4064 12.2122 12.2108C12.408 12.0152 12.6575 11.8821 12.9291 11.8281C13.2008 11.7741 13.4823 11.8018 13.7382 11.9077C13.9941 12.0135 14.2128 12.1928 14.3666 12.4227C14.5205 12.6527 14.6026 12.923 14.6026 13.1996C14.6026 13.3833 14.5664 13.5651 14.496 13.7348C14.4257 13.9044 14.3225 14.0586 14.1925 14.1884C14.0625 14.3183 13.9081 14.4213 13.7382 14.4916C13.5683 14.5618 13.3862 14.598 13.2023 14.598Z" fill="currentColor" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          <div className="bg-white/80 backdrop-blur-sm border border-gray-100 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-600">Feedback categories</p>
              <span className="text-xs text-gray-500">
                {mirrorGroupedReviews.length} review{mirrorGroupedReviews.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { key: "appreciate", label: "Appreciate", icon: "⭐" },
                { key: "need_to_work_on", label: "Work On", icon: "📈" },
                { key: "just_saying", label: "Just Saying", icon: "💭" },
              ].map((item) => (
                <div
                  key={item.key}
                  className="rounded-xl border border-gray-200 bg-white/70 p-3 text-left"
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {mirrorCategoryCounts[item.key as ReviewCategory]} review
                    {mirrorCategoryCounts[item.key as ReviewCategory] === 1 ? "" : "s"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : image ? (
        <div className="relative space-y-1">
          <motion.div
            animate={isPunching ? "punch" : "initial"}
            variants={punchVariants}
            className="relative"
          >
            <motion.div
              animate={isHugging ? "scale" : "initial"}
              variants={scaleVariants}
            >
              <div className="w-full h-64 md:h-80 rounded-2xl overflow-hidden relative z-10 shadow-md">
                <Image
                  src={image}
                  alt={characterName || "Character"}
                  fill
                  sizes="(max-width: 768px) 90vw, 640px"
                  className="object-contain object-center bg-white/70"
                  priority
                  unoptimized
                />
              </div>
            </motion.div>

            <AnimatePresence>
              {isPunching && (
                <motion.div
                  initial={{ x: 170, y: "-50%", opacity: 0, scale: 0.8 }}
                  animate={{
                    x: "-50%",
                    y: "-50%",
                    opacity: [0, 1, 1, 1, 0],
                    scale: [0.8, 1.2, 1, 1, 0.9],
                    transition: {
                      duration: 1.3,
                      times: [0, 0.38, 0.38, 0.77, 1],
                      ease: [0.25, 0.46, 0.45, 0.94],
                    },
                  }}
                  exit={{
                    x: "-30%",
                    y: "-50%",
                    opacity: 0,
                    scale: 0.8,
                    transition: { duration: 0.3 },
                  }}
                  className="absolute top-1/2 left-1/2 text-6xl pointer-events-none z-30"
                >
                  🥊
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {isPunching && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 0.2, 0.15, 0.1, 0] }}
                  exit={{ opacity: 0 }}
                  transition={{
                    duration: 1.3,
                    times: [0, 0.38, 0.5, 0.77, 1],
                  }}
                  className="absolute inset-0 bg-red-500 rounded-lg pointer-events-none z-20"
                />
              )}
            </AnimatePresence>

            <AnimatePresence>
              {isHugging && (
                <>
                  {[...Array(5)].map((_, i) => (
                    <motion.div
                      key={i}
                      initial="initial"
                      animate="animate"
                      exit="initial"
                      variants={heartVariants}
                      transition={{
                        duration: 1,
                        delay: i * 0.1,
                        ease: "easeOut",
                      }}
                      className="absolute top-1/2 left-1/2 text-2xl pointer-events-none z-30"
                      style={{
                        left: `${50 + (i - 2) * 15}%`,
                      }}
                    >
                      ❤️
                    </motion.div>
                  ))}
                </>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {isKissing && (
                <motion.div
                  initial="initial"
                  animate="kiss"
                  exit="initial"
                  variants={kissVariants}
                  className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
                >
                  <div className="text-5xl opacity-80">💋</div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      ) : (
        <div className="w-full h-64 md:h-80 rounded-2xl bg-white/70 border border-gray-100 animate-pulse" />
      )}

      {!isMirrorProfile && characterName ? (
        <div className="flex items-center justify-center gap-3">
          <h2 className="text-3xl md:text-3xl font-extrabold text-center text-gray-800">
            {characterName}
          </h2>
          {isOwner && !isMirrorProfile && (
            <div className="relative group">
              <motion.button
                onClick={() => {
                  if (!canShareProfile) {
                    if (isMobile) {
                      showShareDisabledMessage();
                    }
                    return;
                  }
                  handleShareProfile();
                }}
                className={`p-2 rounded-full transition-colors ${
                  canShareProfile ? "hover:bg-gray-100" : "cursor-not-allowed opacity-40"
                }`}
                whileHover={canShareProfile ? { scale: 1.1 } : undefined}
                whileTap={canShareProfile ? { scale: 0.9 } : undefined}
                title={canShareProfile ? "Share profile" : undefined}
                aria-disabled={!canShareProfile}
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              </motion.button>
              {!isMobile && !canShareProfile && (
                <span className="pointer-events-none absolute -top-8 right-0 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[10px] text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
                  {shareDisabledMessage}
                </span>
              )}
            </div>
          )}
        </div>
      ) : !isMirrorProfile ? (
        <div className="h-7 w-32 mx-auto rounded bg-gray-200/70 animate-pulse" />
      ) : null}

      {activeProfile ? (
        isMirrorProfile ? (
          isOwner ? (
            <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-gray-700">Latest feedback</p>
              {mirrorReviewsLoading ? (
                <div className="h-20 rounded-lg bg-white/70 border border-gray-100 animate-pulse" />
              ) : mirrorReviews.length === 0 ? (
                <div className="text-sm text-gray-600 bg-white/70 border border-gray-100 rounded-lg p-3">
                  No feedback yet. Share your link to get responses.
                </div>
              ) : (
                <div className="columns-1 md:columns-2 xl:columns-3 gap-3">
                  {mirrorGroupedReviews.map((group) => (
                    <div
                      key={group.key}
                      className="break-inside-avoid mb-3 bg-white/80 border border-gray-100 rounded-lg p-3 shadow-sm space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        {renderReviewStars(group.rating)}
                        <span className="text-xs text-gray-500">{formatReviewDate(group.createdAt)}</span>
                      </div>
                      <div className="space-y-2">
                        {group.sections.map((section, index) => (
                          <div key={`${section.category}-${index}`} className="space-y-0.5">
                            <span className="text-xs font-semibold text-purple-700">
                              {reviewCategoryLabel[section.category]}
                            </span>
                            <p className="text-sm text-gray-700">{section.text}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null
        ) : (
          <>
            <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 space-y-2">
              <p className="text-sm text-gray-600">This week:</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <span className="flex items-center gap-1">
                  <span>👊</span>
                  <span>Punched: {activeProfile.punchCount}</span>
                </span>
                <span className="flex items-center gap-1">
                  <span>🤗</span>
                  <span>Hugged: {activeProfile.hugCount}</span>
                </span>
                <span className="flex items-center gap-1">
                  <span>💋</span>
                  <span>Kissed: {activeProfile.kissCount}</span>
                </span>
                <span className="flex items-center gap-1">
                  <span>✏️</span>
                  <span>Notes: {activeProfile.notesCount}</span>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-2xl mx-auto">
              <button
                onClick={handlePunch}
                disabled={isPunching || isHugging || isKissing || noteSaving || switchingProfile}
                className={`rounded-2xl p-4 shadow-sm transition-all transform flex flex-col items-center justify-center gap-2 border border-red-100 h-32 bg-red-50 ${
                  isPunching || isHugging || isKissing || noteSaving || switchingProfile
                    ? "opacity-60 cursor-not-allowed"
                    : "hover:shadow-md hover:scale-105 active:scale-95"
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <span className="text-sm font-semibold text-gray-800">Punch</span>
              </button>

              <button
                onClick={handleHug}
                disabled={isPunching || isHugging || isKissing || noteSaving || switchingProfile}
                className={`rounded-2xl p-4 shadow-sm transition-all transform flex flex-col items-center justify-center gap-2 border border-pink-100 h-32 bg-pink-50 ${
                  isPunching || isHugging || isKissing || noteSaving || switchingProfile
                    ? "opacity-60 cursor-not-allowed"
                    : "hover:shadow-md hover:scale-105 active:scale-95"
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-pink-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </div>
                <span className="text-sm font-semibold text-gray-800">Hug</span>
              </button>

              <button
                onClick={handleKiss}
                disabled={isPunching || isHugging || isKissing || noteSaving || switchingProfile}
                className={`rounded-2xl p-4 shadow-sm transition-all transform flex flex-col items-center justify-center gap-2 border border-rose-100 h-32 bg-rose-50 ${
                  isPunching || isHugging || isKissing || noteSaving || switchingProfile
                    ? "opacity-60 cursor-not-allowed"
                    : "hover:shadow-md hover:scale-105 active:scale-95"
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="text-sm font-semibold text-gray-800">Kiss</span>
              </button>

              <button
                onClick={handleWrite}
                disabled={noteSaving || switchingProfile}
                className={`rounded-2xl p-4 shadow-sm transition-all transform flex flex-col items-center justify-center gap-2 border border-blue-100 h-32 bg-blue-50 ${
                  noteSaving || switchingProfile ? "opacity-60 cursor-not-allowed" : "hover:shadow-md hover:scale-105 active:scale-95"
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <span className="text-sm font-semibold text-gray-800">Say something</span>
              </button>
            </div>
          </>
        )
      ) : (
        <div className="h-16 rounded-xl bg-white/70 border border-gray-100 animate-pulse" />
      )}
    </div>
  );

  const profilesListContent = useMemo(
    () => (
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        <div className="flex items-center gap-2 bg-gray-100/80 border border-gray-200 rounded-lg p-1">
          <button
            onClick={() => setProfileFilter("express")}
            className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              profileFilter === "express"
                ? "bg-white text-gray-800 shadow-sm border border-gray-200"
                : "text-gray-500 bg-transparent"
            }`}
          >
            Express
          </button>
          <button
            onClick={() => setProfileFilter("mirror")}
            className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              profileFilter === "mirror"
                ? "bg-white text-gray-800 shadow-sm border border-gray-200"
                : "text-gray-500 bg-transparent"
            }`}
          >
            Mirror
          </button>
        </div>

        {profilesLoading ? (
          [...Array(4)].map((_, i) => (
            <div
              key={`mobile-skeleton-${i}`}
              className="w-full p-3 rounded-lg bg-white/70 border border-gray-100 animate-pulse"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-200" />
                <div className="flex-1">
                  <div className="h-3 w-24 bg-gray-200 rounded" />
                  <div className="h-2 w-16 bg-gray-100 rounded mt-2" />
                </div>
              </div>
            </div>
          ))
        ) : filteredProfiles.length === 0 ? (
          <div className="text-sm text-gray-500 bg-white/70 border border-gray-100 rounded-lg p-4 text-center">
            No profiles in this mode yet.
          </div>
        ) : (
          filteredProfiles.map((profile) => (
            <div
              key={profile.id}
              className={`w-full p-4 rounded-xl transition-all flex items-center gap-3 border ${
                currentProfileId === profile.id
                  ? "bg-white border-gray-300 shadow-sm"
                  : "bg-white/70 border-transparent hover:bg-white hover:border-gray-200"
              }`}
            >
              <button
                onClick={() => switchProfile(profile.id, profile.profileType ?? "express")}
                className="flex-1 flex items-center gap-3 text-left min-w-0"
              >
                {profileImages[profile.id] ? (
                  <Image
                    src={profileImages[profile.id]}
                    alt={profile.name}
                    width={40}
                    height={40}
                    sizes="40px"
                    className="w-10 h-10 rounded-full object-contain bg-white flex-shrink-0"
                    unoptimized
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-800 truncate">{profile.name}</div>
                {(profile.description || profile.bio) && (
                  <div className="text-xs text-gray-500 mt-0.5 truncate">
                    {profile.profileType === "mirror" ? profile.bio || "Mirror profile" : profile.description}
                  </div>
                )}
                </div>
              </button>
              {profile.ownerId === user?.id && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditModal(profile.id);
                    }}
                    className="p-1.5 hover:bg-gray-200 rounded transition-colors"
                    title="Edit profile"
                  >
                    <span className="text-lg">🖊️</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirmProfileId(profile.id);
                    }}
                    className="p-1.5 hover:bg-gray-200 rounded transition-colors"
                    title="Delete profile"
                  >
                    <span className="text-lg">🗑️</span>
                  </button>
                </div>
              )}
            </div>
          ))
        )}

        <div className="grid grid-cols-1 gap-2">
          <button
            onClick={() => openCreateModal("express")}
            className="w-full p-3 rounded-lg transition-all bg-gray-50 border-2 border-dashed border-gray-300 hover:bg-gray-100 hover:border-pink-200 flex items-center gap-3 text-left"
          >
            <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <div className="font-medium text-gray-800">Create Express Profile</div>
              <div className="text-xs text-gray-500">Create a private space to say what you feel.</div>
            </div>
          </button>
          <button
            onClick={() => openCreateModal("mirror")}
            className="w-full p-3 rounded-lg transition-all bg-white border-2 border-dashed border-purple-200 hover:bg-white hover:border-purple-300 flex items-center gap-3 text-left"
          >
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <div className="font-medium text-gray-800">Create Mirror Profile</div>
              <div className="text-xs text-gray-500">
                Create your public profile and let people share honest feedback.
              </div>
            </div>
          </button>
        </div>
      </div>
    ),
    [
      profilesLoading,
      filteredProfiles,
      currentProfileId,
      profileImages,
      profileFilter,
      user?.id,
      openEditModal,
      switchProfile,
      openCreateModal,
    ]
  );

  if (accessDenied) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen bg-gradient-to-br from-white via-blue-50 via-pink-50 to-yellow-50 pt-16 flex items-center justify-center p-6">
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-gray-100 text-center max-w-md">
            <h2 className="text-xl font-semibold text-gray-800">Access unavailable</h2>
            <p className="text-gray-600 mt-2">
              This profile is private or no longer shared with you.
            </p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main
        className="min-h-screen overflow-y-auto md:h-screen md:overflow-hidden bg-gradient-to-br from-white via-blue-50 via-pink-50 to-yellow-50 pt-16"
        style={{
          fontFamily:
            '"Inter","Geist",ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans"',
        }}
      >
        {isGuestMode && (
          <div className="fixed top-0 left-0 right-0 z-40 bg-white/70 backdrop-blur-sm border-b border-gray-200">
            <div className="w-full px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-16">
                <button
                  onClick={() => router.push("/")}
                  className="flex items-center gap-2 font-semibold text-pink-600 hover:text-pink-700 transition-colors"
                >
                  <span className="text-lg">💜</span>
                  <span>Feelability</span>
                </button>
                <button
                  onClick={handleGuestContinue}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-pink-500 to-purple-500 text-white text-sm font-semibold shadow-md hover:from-pink-600 hover:to-purple-600 transition-colors"
                >
                  Login
                </button>
              </div>
            </div>
          </div>
        )}
        {isGuestMode && (
          <div className="fixed top-20 left-4 z-40 px-3 py-1 rounded-full bg-white/80 backdrop-blur-sm border border-gray-200 text-xs text-gray-600">
            Guest mode
          </div>
        )}
        {/* Mobile: Profiles Button */}
        {isMobile && canManageProfiles && (profilesLoading || profiles.length > 0) && (
          <button
            onClick={() => setIsProfilesSheetOpen(true)}
            className="fixed top-20 left-4 z-50 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-lg shadow-md hover:shadow-lg transition-all text-sm font-medium text-gray-700 flex items-center gap-2"
          >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          Profiles
        </button>
      )}

      {/* Mobile Drawer Overlay */}
      {isMobile && isMobileDrawerOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsMobileDrawerOpen(false)}
        />
      )}

      {/* Main Grid Layout */}
      {profiles.length === 0 && !profilesLoading ? (
        emptyStateContent
      ) : (
      <div className="relative min-h-screen md:h-screen">
        {/* LEFT PANEL - Profiles Sidebar */}
        {canManageProfiles && (profilesLoading || profiles.length > 0) && (
          <>
            {/* Desktop Sidebar */}
            <motion.aside
              initial={false}
              animate={{
                width: isSidebarCollapsed ? (isMobile ? 0 : '64px') : '280px',
              }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className={`hidden md:flex flex-col bg-white/70 backdrop-blur-sm border-r border-gray-200 absolute left-0 top-0 bottom-0 z-40 ${isSidebarCollapsed ? 'overflow-hidden' : ''}`}
            >
              {/* Chevron Toggle */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                {!isSidebarCollapsed && (
                  <h2 className="text-lg font-semibold text-gray-800">Profiles</h2>
                )}
                <button
                  onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                  <svg
                    className={`w-5 h-5 text-gray-600 transition-transform ${isSidebarCollapsed ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              </div>

              {/* Profiles List */}
              {!isSidebarCollapsed && profilesListContent}
            </motion.aside>

          </>
        )}

        {/* RIGHT PANEL - Character View */}
        <div
          className={`middle-section flex flex-col items-center justify-center p-8 md:h-full md:transition-[margin] md:duration-300 md:ease-in-out ${
            isMirrorProfile ? "overflow-y-auto" : "md:overflow-hidden"
          } ${
            canManageProfiles && (profilesLoading || profiles.length > 0)
              ? isSidebarCollapsed
                ? "md:ml-[64px]"
                : "md:ml-[280px]"
              : ""
          }`}
        >
          <div className={`w-full ${isMirrorProfile ? "max-w-5xl" : "max-w-md"} space-y-8 relative`}>
            {filteredProfiles.length === 0 ? (
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-gray-100 text-center space-y-4">
                <h2 className="text-xl font-semibold text-gray-800">Create a profile to continue</h2>
                <p className="text-gray-600 text-sm">
                  This mode doesn&apos;t have any profiles yet. Start one to see it here.
                </p>
                <div className="space-y-3">
                  {profileFilter === "express" ? (
                    <button
                      onClick={() => openCreateModal("express")}
                      className="w-full px-5 py-3 rounded-lg bg-pink-500 text-white font-medium hover:bg-pink-600 transition-colors text-left"
                    >
                      <div className="font-semibold">Express about someone</div>
                      <div className="text-sm text-pink-50">Create a private space to say what you feel.</div>
                    </button>
                  ) : (
                    <button
                      onClick={() => openCreateModal("mirror")}
                      className="w-full px-5 py-3 rounded-lg border border-purple-200 text-purple-700 font-medium hover:bg-white transition-colors text-left"
                    >
                      <div className="font-semibold">Get feedback about yourself</div>
                      <div className="text-sm text-purple-600">
                        Create your public profile and let people share honest feedback.
                      </div>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              characterContent
            )}
          </div>
        </div>
      </div>
      )}
      <style jsx global>{`
        .middle-section {
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          margin-top: 0;
        }
      `}</style>

      {!isMirrorProfile && profileFilter !== "mirror" && (
        <NotesPanel
          isMobile={isMobile}
          isGuestMode={isGuestMode}
          notes={notes}
          notesLoading={notesLoading}
          noteSaving={noteSaving}
          userId={user?.id}
          showNotesSheet={showNotesSheet}
          setShowNotesSheet={setShowNotesSheet}
          sheetDragStartY={sheetDragStartY}
          setSheetDragStartY={setSheetDragStartY}
          handleDeleteNote={handleDeleteNote}
          formatNoteDate={formatNoteDate}
          getNoteTagClasses={getNoteTagClasses}
          getNoteHeaderText={getNoteHeaderText}
        />
      )}

      {/* Guest Conversion Prompt */}
      <AnimatePresence>
        {isGuestMode && showGuestPrompt && (
          isMobile ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50"
            >
              <div
                className="absolute inset-0 bg-black/30"
                onClick={handleGuestLater}
              />
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md rounded-t-2xl p-5"
              >
                <h3 className="text-lg font-semibold text-gray-800">
                  Ready to create a real profile and keep expressing what you feel?
                </h3>
                <div className="mt-4 flex flex-col gap-3">
                  <button
                    onClick={handleGuestContinue}
                    className="w-full py-3 rounded-lg bg-pink-500 text-white font-medium hover:bg-pink-600 transition-colors"
                  >
                    Continue with Google
                  </button>
                  <button
                    onClick={handleGuestLater}
                    className="w-full py-2.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Maybe later
                  </button>
                </div>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div
                className="absolute inset-0 bg-black/40"
                onClick={handleGuestLater}
              />
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="relative bg-white/95 backdrop-blur-md rounded-2xl p-6 max-w-lg w-full shadow-xl border border-gray-100"
              >
                <h3 className="text-xl font-semibold text-gray-800">
                  Ready to create a real profile and keep expressing what you feel?
                </h3>
                <div className="mt-5 flex gap-3">
                  <button
                    onClick={handleGuestContinue}
                    className="flex-1 py-3 rounded-lg bg-pink-500 text-white font-medium hover:bg-pink-600 transition-colors"
                  >
                    Continue with Google
                  </button>
                  <button
                    onClick={handleGuestLater}
                    className="flex-1 py-3 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Maybe later
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )
        )}
      </AnimatePresence>

      {/* Profiles Bottom Sheet - Mobile Only */}
      <AnimatePresence>
        {isMobile && isProfilesSheetOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50"
          >
            <div
              className="absolute inset-0 bg-black/30"
              onClick={() => setIsProfilesSheetOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md rounded-t-2xl max-h-[80vh] flex flex-col overflow-hidden"
              onTouchStart={(e) => setSheetDragStartY(e.touches[0].clientY)}
              onTouchMove={(e) => {
                if (sheetDragStartY && e.touches[0].clientY - sheetDragStartY > 80) {
                  setIsProfilesSheetOpen(false);
                  setSheetDragStartY(null);
                }
              }}
              onTouchEnd={() => setSheetDragStartY(null)}
            >
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <div className="text-sm font-semibold text-gray-800">Profiles</div>
                <button
                  onClick={() => setIsProfilesSheetOpen(false)}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {profilesListContent}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmProfileId && !isMobile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => setDeleteConfirmProfileId(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-xl p-6 w-full max-w-md space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-800">Delete Profile</h3>
                <button
                  onClick={() => setDeleteConfirmProfileId(null)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-gray-600">Are you sure you want to delete the profile</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirmProfileId(null)}
                  className="flex-1 py-2 px-4 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteProfile(deleteConfirmProfileId)}
                  className="flex-1 py-2 px-4 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                >
                  Yes
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {deleteConfirmProfileId && isMobile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50"
          >
            <div
              className="absolute inset-0 bg-black/30"
              onClick={() => setDeleteConfirmProfileId(null)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md rounded-t-2xl p-5"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-800">Delete Profile</h3>
                <button
                  onClick={() => setDeleteConfirmProfileId(null)}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-sm text-gray-600 mt-2">Are you sure you want to delete the profile</p>
              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => setDeleteConfirmProfileId(null)}
                  className="flex-1 py-2.5 px-4 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteProfile(deleteConfirmProfileId)}
                  className="flex-1 py-2.5 px-4 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                >
                  Yes
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create/Edit Profile Modal */}
      <AnimatePresence>
        {showProfileModal && !isMobile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => {
              setShowProfileModal(false);
              resetEditMode();
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-xl p-6 w-full max-w-md space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              {profileFormContent}
            </motion.div>
          </motion.div>
        )}
        {showProfileModal && isMobile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50"
          >
            <div
              className="absolute inset-0 bg-black/30"
              onClick={() => {
                setShowProfileModal(false);
                resetEditMode();
              }}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md rounded-t-2xl max-h-[90vh] flex flex-col overflow-hidden"
            >
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {profileFormContent}
              </div>
              <div className="sticky bottom-0 w-full bg-white/95 backdrop-blur-md border-t border-gray-200 p-4 flex gap-3">
                <button
                  onClick={() => {
                    setShowProfileModal(false);
                    resetEditMode();
                  }}
                  className="flex-1 py-2.5 px-4 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={createProfile}
                  disabled={!newProfileName.trim() || (!newProfileImage && newProfileType !== "mirror") || profileSaving || imageUploading}
                  className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-all ${
                    newProfileName.trim() && (newProfileImage || newProfileType === "mirror") && !profileSaving && !imageUploading
                      ? "bg-gradient-to-r from-pink-400 to-pink-500 text-white hover:from-pink-500 hover:to-pink-600 shadow-lg hover:shadow-xl"
                      : "bg-gray-200 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  {profileSaving || imageUploading ? "Saving..." : editingProfileId ? "Save" : "Create"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Share Modal (Owner Only) */}
      <AnimatePresence>
        {showShareModal && activeProfile && !isMirrorProfile && !isMobile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => setShowShareModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white/95 backdrop-blur-md rounded-xl p-6 w-full max-w-md space-y-4 relative shadow-2xl border border-gray-100"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-800">Share profile</h3>
                <button
                  onClick={() => setShowShareModal(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg
                    className="w-5 h-5"
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
              </div>

              {activeProfile.visibility !== "public" && (
                <div className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-3">
                  Set visibility to Public to allow others to access this profile.
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={`${typeof window !== "undefined" ? window.location.origin : ""}/character?profile=${activeProfile.id}`}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-700"
                />
                <button
                  onClick={handleCopyShareLink}
                  disabled={shareCopying}
                  className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                    shareCopying
                      ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                      : "bg-gray-900 text-white hover:bg-gray-800"
                  }`}
                >
                  {shareCopying ? "Copying..." : "Copy"}
                </button>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-semibold text-gray-700">Collaborators</div>
                {collaborators.length === 0 ? (
                  <div className="text-sm text-gray-500">No collaborators yet.</div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {collaborators.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between gap-3 p-2 rounded-lg bg-gray-50"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {c.avatar_url ? (
                            <Image
                              src={c.avatar_url}
                              alt={c.display_name || "Collaborator"}
                              width={32}
                              height={32}
                              sizes="32px"
                              className="w-8 h-8 rounded-full object-cover"
                              unoptimized
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs">
                              ?
                            </div>
                          )}
                          <div className="text-sm text-gray-700 truncate">
                            {c.display_name || "Anonymous"}
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveCollaborator(c.id)}
                          disabled={collabActionId === c.id}
                          className={`p-1.5 rounded transition-colors ${
                            collabActionId === c.id ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-200"
                          }`}
                          title="Remove access"
                        >
                          {collabActionId === c.id ? (
                            <span className="h-4 w-4 inline-block rounded-full border-2 border-gray-300 border-t-gray-500 animate-spin" />
                          ) : (
                            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
        {showShareModal && activeProfile && !isMirrorProfile && isMobile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50"
          >
            <div
              className="absolute inset-0 bg-black/30"
              onClick={() => setShowShareModal(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md rounded-t-2xl max-h-[85vh] flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800">Share profile</h3>
                <button
                  onClick={() => setShowShareModal(false)}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-4 space-y-4 overflow-y-auto">
                {activeProfile.visibility !== "public" && (
                  <div className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-3">
                    Set visibility to Public to allow others to access this profile.
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={`${typeof window !== "undefined" ? window.location.origin : ""}/character?profile=${activeProfile.id}`}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-700"
                  />
                  <button
                    onClick={handleCopyShareLink}
                    disabled={shareCopying}
                    className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                      shareCopying
                        ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                        : "bg-gray-900 text-white hover:bg-gray-800"
                    }`}
                  >
                    {shareCopying
                      ? "Copying..."
                      : typeof navigator !== "undefined" && "share" in navigator
                      ? "Share"
                      : "Copy"}
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-semibold text-gray-700">Collaborators</div>
                  {collaborators.length === 0 ? (
                    <div className="text-sm text-gray-500">No collaborators yet.</div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {collaborators.map((c) => (
                        <div
                          key={c.id}
                          className="flex items-center justify-between gap-3 p-2 rounded-lg bg-gray-50"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {c.avatar_url ? (
                              <Image
                                src={c.avatar_url}
                                alt={c.display_name || "Collaborator"}
                                width={32}
                                height={32}
                                sizes="32px"
                                className="w-8 h-8 rounded-full object-cover"
                                unoptimized
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs">
                                ?
                              </div>
                            )}
                            <div className="text-sm text-gray-700 truncate">
                              {c.display_name || "Anonymous"}
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveCollaborator(c.id)}
                            disabled={collabActionId === c.id}
                            className={`p-1.5 rounded transition-colors ${
                              collabActionId === c.id ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-200"
                            }`}
                            title="Remove access"
                          >
                            {collabActionId === c.id ? (
                              <span className="h-4 w-4 inline-block rounded-full border-2 border-gray-300 border-t-gray-500 animate-spin" />
                            ) : (
                              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {!isMirrorProfile && (
        <WriteNoteModal
          isOpen={showWriteModal}
          isMobile={isMobile}
          noteText={noteText}
          setNoteText={setNoteText}
          noteSaving={noteSaving}
          noteEmotionType={noteEmotionType}
          setNoteEmotionType={setNoteEmotionType}
          setShowWriteModal={setShowWriteModal}
          handleSaveNote={handleSaveNote}
          noteInputRef={noteInputRef}
          resizeNoteInput={resizeNoteInput}
          sheetDragStartY={sheetDragStartY}
          setSheetDragStartY={setSheetDragStartY}
        />
      )}

      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={`fixed z-50 rounded-lg bg-gray-800 px-4 py-2 text-white shadow-lg ${
              isMobile
                ? "bottom-8 left-1/2 -translate-x-1/2"
                : "top-20 right-6"
            }`}
          >
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>
      </main>
    </>
  );
}
