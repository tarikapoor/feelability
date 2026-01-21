"use client";

/**
 * ARCHITECTURE LOCK — DO NOT MODIFY WITHOUT REVIEW
 * Core pages must remain separate: Login (Page 0), Home/Profile Selection (Page 1), Character (Page 2).
 * Single source of truth: profiles[] + activeProfileId.
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
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectPath = searchParams.get("redirect") || "/";

  useEffect(() => {
    if (user) {
      router.replace(redirectPath);
    }
  }, [user, router, redirectPath]);

  const handleGoogle = async () => {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}${redirectPath}`,
      },
    });
    if (error) {
      setLoading(false);
      setError(error.message);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-white via-blue-50 via-pink-50 to-yellow-50">
      <div className="w-full max-w-md bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg space-y-6 border border-gray-100">
        <h1 className="text-2xl font-bold text-center text-gray-800">Welcome to Feelability</h1>
        <p className="text-center text-gray-600">Sign in to continue</p>

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
            <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12
            s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C33.601,6.053,29.044,4,24,4C12.955,4,4,12.955,4,24
            s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
            <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,16.108,18.961,14,24,14c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657
            C33.601,6.053,29.044,4,24,4C16.318,4,9.637,8.337,6.306,14.691z"/>
            <path fill="#4CAF50" d="M24,44c4.887,0,9.342-1.871,12.728-4.928l-5.873-4.963C28.861,35.68,26.566,36,24,36
            c-5.202,0-9.619-3.317-11.283-7.946l-6.544,5.047C9.464,39.556,16.227,44,24,44z"/>
            <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.79,2.229-2.231,4.153-4.089,5.529
            c0.001-0.001,0.002-0.001,0.003-0.002l5.873,4.963C36.792,39.118,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
          </svg>
          {loading ? "Signing in..." : "Continue with Google"}
        </motion.button>

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
    </main>
  );
}


