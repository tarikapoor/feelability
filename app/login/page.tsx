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
import Footer from "@/components/Footer";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectPath = searchParams.get("redirect") || "/app";
  const siteUrl =
    typeof window !== "undefined"
      ? process.env.NEXT_PUBLIC_SITE_URL || window.location.origin
      : process.env.NEXT_PUBLIC_SITE_URL || "";

  useEffect(() => {
    if (user) {
      router.replace(redirectPath);
    }
  }, [user, router, redirectPath]);

  useEffect(() => {
    setLoading(false);
  }, [searchParams.toString()]);

  useEffect(() => {
    const handle = () => setLoading(false);
    window.addEventListener("pageshow", handle);
    window.addEventListener("focus", handle);
    return () => {
      window.removeEventListener("pageshow", handle);
      window.removeEventListener("focus", handle);
    };
  }, []);

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

  return (
    <main className="min-h-screen flex flex-col bg-gradient-to-br from-white via-blue-50 via-pink-50 to-yellow-50">
      <header className="px-6 py-4 border-b border-gray-200 bg-white/70 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-pink-600 font-semibold hover:text-pink-700 transition-colors"
          >
            <span className="text-lg">💜</span>
            <span>Feelability</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-gray-100 space-y-6">
            <h1 className="text-2xl font-bold text-gray-800">Sign in to Feelability</h1>
            <p className="text-gray-600">Choose how you&apos;d like to continue.</p>

            <div className="flex flex-col gap-3">
            <motion.button
              onClick={handleGoogle}
              disabled={loading}
              className={`w-full py-3 px-4 rounded-lg font-medium transition-all bg-white border border-gray-300 hover:bg-gray-50 shadow-sm flex items-center justify-center gap-2 ${
                loading ? "opacity-50 cursor-not-allowed" : ""
              }`}
              whileHover={!loading ? { scale: 1.02 } : {}}
              whileTap={!loading ? { scale: 0.98 } : {}}
            >
              <svg className="w-5 h-5" viewBox="0 0 48 48">
                <path
                  fill="#FFC107"
                  d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C33.601,6.053,29.044,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"
                />
                <path
                  fill="#FF3D00"
                  d="M6.306,14.691l6.571,4.819C14.655,16.108,18.961,14,24,14c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C33.601,6.053,29.044,4,24,4C16.318,4,9.637,8.337,6.306,14.691z"
                />
                <path
                  fill="#4CAF50"
                  d="M24,44c4.887,0,9.342-1.871,12.728-4.928l-5.873-4.963C28.861,35.68,26.566,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.544,5.047C9.464,39.556,16.227,44,24,44z"
                />
                <path
                  fill="#1976D2"
                  d="M43.611,20.083H42V20H24v8h11.303c-0.79,2.229-2.231,4.153-4.089,5.529c0.001-0.001,0.002-0.001,0.003-0.002l5.873,4.963C36.792,39.118,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"
                />
              </svg>
              {loading ? "Signing in..." : "Continue with Google"}
            </motion.button>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-sm text-red-600 text-center"
              >
                {error}
              </motion.div>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}
