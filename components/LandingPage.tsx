"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabaseClient";
import Footer from "@/components/Footer";

export default function LandingPage() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const siteUrl =
    typeof window !== "undefined"
      ? process.env.NEXT_PUBLIC_SITE_URL || window.location.origin
      : process.env.NEXT_PUBLIC_SITE_URL || "";

  const handleLogout = async () => {
    await signOut();
    router.push("/");
  };

  const handleGoogleLogin = async (redirectPath = "/app") => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${siteUrl}${redirectPath}` },
    });
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-white via-blue-50 via-pink-50 to-yellow-50">
      <header className="px-6 py-4 border-b border-gray-200 bg-white/70 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-pink-600 font-semibold hover:text-pink-700 transition-colors"
          >
            <span className="text-lg">💜</span>
            <span>Feelability</span>
          </button>
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
                  onClick={() => handleGoogleLogin("/app")}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-pink-500 to-purple-500 text-white text-sm font-semibold shadow-md hover:from-pink-600 hover:to-purple-600 transition-colors"
                >
                  Login with Google
                </button>
                <button
                  onClick={() => router.push("/app?guest=1")}
                  className="px-4 py-2 rounded-lg border border-purple-200 text-purple-700 text-sm font-semibold hover:bg-white transition-colors"
                >
                  Try Express Mode
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="px-6 pt-16 pb-10">
        <div className="max-w-6xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-100 text-purple-700 text-sm font-medium">
            ✨ Express and reflect
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold text-gray-800">
            Say what you feel. See how people feel about you.
          </h1>
          <p className="text-gray-600 max-w-3xl mx-auto text-lg">
            Feelability helps you privately express emotions about people in your life, or create a public
            profile to collect anonymous feedback about yourself.
          </p>

          <div className="max-w-2xl mx-auto">
            <h2 className="text-xl font-bold text-gray-800 mb-3 text-center">Why Feelability</h2>
            <ul className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-6 justify-center text-gray-700">
              <li className="flex items-center gap-2 sm:justify-center">
                <span className="text-purple-500" aria-hidden="true">✓</span>
                Private by default
              </li>
              <li className="flex items-center gap-2 sm:justify-center">
                <span className="text-purple-500" aria-hidden="true">✓</span>
                End-to-end encrypted
              </li>
              <li className="flex items-center gap-2 sm:justify-center">
                <span className="text-purple-500" aria-hidden="true">✓</span>
                Share only when you choose
              </li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row justify-center gap-4">
            {user ? (
              <>
                <button
                  onClick={() => router.push("/app")}
                  className="px-6 py-3 rounded-lg bg-gradient-to-r from-pink-500 to-purple-500 text-white font-semibold shadow-md hover:from-pink-600 hover:to-purple-600 transition-colors"
                >
                  Continue with existing profiles
                </button>
                <button
                  onClick={() => router.push("/app?create=1&type=mirror")}
                  className="px-6 py-3 rounded-lg border border-purple-200 text-purple-700 font-semibold hover:bg-white transition-colors"
                >
                  Create My Mirror Profile
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => router.push("/app?guest=1")}
                  className="px-6 py-3 rounded-lg bg-gradient-to-r from-pink-500 to-purple-500 text-white font-semibold shadow-md hover:from-pink-600 hover:to-purple-600 transition-colors"
                >
                  Try Express Mode
                </button>
                <button
                  onClick={() => handleGoogleLogin("/app?create=1&type=mirror")}
                  className="px-6 py-3 rounded-lg border border-purple-200 text-purple-700 font-semibold hover:bg-white transition-colors"
                >
                  Create My Mirror Profile
                </button>
               
              </>
            )}
          </div>
        </div>
      </section>

      <section className="px-6 pb-16" aria-labelledby="how-it-works">
        <div className="max-w-6xl mx-auto">
          <h2 id="how-it-works" className="text-xl font-bold text-gray-800 text-center mb-8">
            How it works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white/80 border border-purple-100 rounded-2xl p-6 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 text-white flex items-center justify-center text-xl">
                👤
              </div>
              <h3 className="mt-4 text-lg font-semibold text-purple-700">Create Express Profiles</h3>
              <p className="text-gray-600 mt-2">
                Build profiles for people in your life. Each character becomes a safe space to
                express how you truly feel about them.
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
              <h3 className="mt-4 text-lg font-semibold text-purple-700">Collect Mirror Feedback</h3>
              <p className="text-gray-600 mt-2">
                Create a public mirror profile so people can share thoughtful, anonymous feedback.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
