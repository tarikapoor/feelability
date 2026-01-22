"use client";

/**
 * ARCHITECTURE LOCK — DO NOT MODIFY WITHOUT REVIEW
 * Core pages: Login + Character (single-page experience).
 * Profiles are loaded from Supabase only. Sharing/permissions must remain intact.
 */

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { motion } from "framer-motion";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectPath = searchParams.get("redirect") || "/";
  const searchParamsKey = searchParams.toString();
  const siteUrl =
    typeof window !== "undefined"
      ? process.env.NEXT_PUBLIC_SITE_URL || window.location.origin
      : process.env.NEXT_PUBLIC_SITE_URL || "";

  useEffect(() => {
    if (user && searchParams.get("redirect")) {
      router.replace(redirectPath);
    }
  }, [user, router, redirectPath, searchParams]);

  useEffect(() => {
    setLoading(false);
  }, [searchParamsKey]);

  useEffect(() => {
    const handle = () => setLoading(false);
    window.addEventListener("pageshow", handle);
    window.addEventListener("focus", handle);
    return () => {
      window.removeEventListener("pageshow", handle);
      window.removeEventListener("focus", handle);
    };
  }, []);

  const handleTryFirst = () => {
    router.push("/?guest=1");
  };

  const handleGoogle = async () => {
    setLoading(true);
    setError(null);
    const redirectTo = `${siteUrl}${redirectPath}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
      },
    });
    if (error) {
      setLoading(false);
      setError(error.message);
    }
  };

  const handleLogout = async () => {
    await signOut();
    router.push("/login");
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-white via-blue-50 via-pink-50 to-yellow-50">
      <header className="px-6 py-4 border-b border-gray-200 bg-white/70 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 text-pink-600 font-semibold">
            <span className="text-lg">💜</span>
            <span>Feelability</span>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <button
                onClick={handleLogout}
                className="px-4 py-2 rounded-lg border border-purple-200 text-purple-700 text-sm font-semibold hover:bg-white transition-colors"
              >
                Logout
              </button>
            ) : (
              <>
                <button
                  onClick={handleGoogle}
                  disabled={loading}
                  className={`px-4 py-2 rounded-lg bg-gradient-to-r from-pink-500 to-purple-500 text-white text-sm font-semibold shadow-md hover:from-pink-600 hover:to-purple-600 transition-colors ${
                    loading ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  Login
                </button>
                <button
                  onClick={handleTryFirst}
                  className="px-4 py-2 rounded-lg border border-purple-200 text-purple-700 text-sm font-semibold hover:bg-white transition-colors"
                >
                  Try it First
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="px-6 pt-16 pb-10">
        <div className="max-w-6xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-100 text-purple-700 text-sm font-medium">
            ✨ Express yourself freely
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold text-gray-800">
            A Safe Space for Your{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-500">
              Unspoken Emotions
            </span>
          </h1>
          <p className="text-gray-600 max-w-3xl mx-auto">
            Vent, love, appreciate, or just let it out - privately or together. Feelability gives
            you the freedom to express what words often can&apos;t say.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            {user ? (
              <>
                <button
                  onClick={() => router.push("/")}
                  className="px-6 py-3 rounded-lg bg-gradient-to-r from-pink-500 to-purple-500 text-white font-semibold shadow-md hover:from-pink-600 hover:to-purple-600 transition-colors"
                >
                  Continue with existing profiles
                </button>
                <button
                  onClick={() => router.push("/?create=1")}
                  className="px-6 py-3 rounded-lg border border-purple-200 text-purple-700 font-semibold hover:bg-white transition-colors"
                >
                  Create new profile
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleGoogle}
                  disabled={loading}
                  className={`px-6 py-3 rounded-lg bg-gradient-to-r from-pink-500 to-purple-500 text-white font-semibold shadow-md hover:from-pink-600 hover:to-purple-600 transition-colors ${
                    loading ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  Login
                </button>
                <button
                  onClick={handleTryFirst}
                  className="px-6 py-3 rounded-lg border border-purple-200 text-purple-700 font-semibold hover:bg-white transition-colors"
                >
                  Try it First →
                </button>
              </>
            )}
          </div>
          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sm text-red-600"
            >
              {error}
            </motion.div>
          )}
        </div>
      </section>

      <section className="px-6 pb-16">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white/80 border border-purple-100 rounded-2xl p-6 shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 text-white flex items-center justify-center text-xl">
              👤
            </div>
            <h3 className="mt-4 text-lg font-semibold text-purple-700">Create Characters</h3>
            <p className="text-gray-600 mt-2">
              Build profiles for people in your life. Each character becomes a safe space to express
              how you truly feel about them.
            </p>
          </div>
          <div className="bg-white/80 border border-purple-100 rounded-2xl p-6 shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-500 text-white flex items-center justify-center text-xl">
              💬
            </div>
            <h3 className="mt-4 text-lg font-semibold text-purple-700">Express Through Notes</h3>
            <p className="text-gray-600 mt-2">
              Write notes, capture emotions, and take actions that reflect your feelings - no
              judgment, just authenticity.
            </p>
          </div>
          <div className="bg-white/80 border border-purple-100 rounded-2xl p-6 shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-500 text-white flex items-center justify-center text-xl">
              🔗
            </div>
            <h3 className="mt-4 text-lg font-semibold text-purple-700">Share Anonymously</h3>
            <p className="text-gray-600 mt-2">
              Choose to keep your feelings private or share profiles anonymously. You&apos;re in complete
              control of your emotional journey.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}


