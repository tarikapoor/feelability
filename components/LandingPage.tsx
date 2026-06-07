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

  const faqStructuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Is Feelability really private?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. Your notes are end-to-end encrypted, which means only you can read them. We cannot access the content of anything you write.",
        },
      },
      {
        "@type": "Question",
        name: "What is a Mirror Profile?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "A Mirror Profile is a shareable link you can send to people in your life. They can leave you anonymous, heartfelt messages — and you receive them privately.",
        },
      },
      {
        "@type": "Question",
        name: "Is Feelability a therapy app?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No. Feelability is a private emotional journaling and anonymous feedback tool. It's not a substitute for professional mental health support, but many users find it helpful for self-reflection and processing emotions.",
        },
      },
      {
        "@type": "Question",
        name: "Is it free to use?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "You can try Feelability for free.",
        },
      },
      {
        "@type": "Question",
        name: "Who can see what I write?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Nobody. Notes you write are private and encrypted. Only content shared through your Mirror Profile is visible to others — and even then, responses are anonymous.",
        },
      },
    ],
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-white via-blue-50 via-pink-50 to-yellow-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqStructuredData) }}
      />
      <header className="px-6 py-4 border-b border-gray-200 bg-white/70 backdrop-blur-sm sticky top-0 z-20">
        <nav
          aria-label="Main navigation"
          className="max-w-6xl mx-auto flex items-center justify-between"
        >
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-pink-600 font-semibold hover:text-pink-700 transition-colors"
          >
            <span className="text-lg" aria-hidden="true">💜</span>
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
                  Start Expressing Privately
                </button>
              </>
            )}
          </div>
        </nav>
      </header>

      <section className="px-6 pt-16 pb-10">
        <div className="max-w-6xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-100 text-purple-700 text-sm font-medium">
            Express and Reflect
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold text-gray-800">
            Say what you&apos;ve always held back
          </h1>
          <p className="text-gray-600 max-w-3xl mx-auto text-lg md:text-xl">
            A private space to express what you feel about the people in your life — and hear what
            they feel about you.
          </p>
          <p className="text-gray-500 max-w-2xl mx-auto">
            Whether it&apos;s gratitude you never said out loud, or feelings you&apos;ve been carrying
            alone — Feelability gives them a home.
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
                  onClick={() => router.push("/app?create=1&type=mirror")}
                  className="px-6 py-3 rounded-lg bg-gradient-to-r from-pink-500 to-purple-500 text-white font-semibold shadow-md hover:from-pink-600 hover:to-purple-600 transition-colors"
                >
                  Create My Mirror Profile
                </button>
                <button
                  onClick={() => router.push("/app")}
                  className="px-6 py-3 rounded-lg border border-purple-200 text-purple-700 font-semibold hover:bg-white transition-colors"
                >
                  Continue with existing profiles
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => handleGoogleLogin("/app?create=1&type=mirror")}
                  className="px-6 py-3 rounded-lg bg-gradient-to-r from-pink-500 to-purple-500 text-white font-semibold shadow-md hover:from-pink-600 hover:to-purple-600 transition-colors"
                >
                  Create My Mirror Profile
                </button>
                <button
                  onClick={() => router.push("/app?guest=1")}
                  className="px-6 py-3 rounded-lg border border-purple-200 text-purple-700 font-semibold hover:bg-white transition-colors"
                >
                  Start Expressing Privately
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="px-6 pb-16" aria-labelledby="use-cases">
        <div className="max-w-5xl mx-auto">
          <h2 id="use-cases" className="text-2xl font-bold text-gray-800 text-center mb-2">
            What people use Feelability for
          </h2>
          <p className="text-gray-500 text-center mb-8">
            From private expression to anonymous feedback — Feelability holds space for both.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              {
                icon: "💌",
                text: "Telling someone you love them (without the pressure)",
                mirror: false,
              },
              {
                icon: "🙏",
                text: "Expressing gratitude you never got to say",
                mirror: false,
              },
              {
                icon: "🪞",
                text: "Discovering how the people in your life truly see you",
                mirror: true,
              },
              {
                icon: "💬",
                text: "Collecting anonymous, heartfelt feedback",
                mirror: true,
              },
            ].map((item) => (
              <div
                key={item.text}
                className={`flex items-center gap-3 rounded-2xl px-5 py-4 shadow-sm ${
                  item.mirror
                    ? "bg-purple-50 border border-purple-200"
                    : "bg-white/80 border border-purple-100"
                }`}
              >
                <span className="text-2xl" aria-hidden="true">{item.icon}</span>
                <span className="text-gray-700 font-medium">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 pb-16" aria-labelledby="how-it-works">
        <div className="max-w-6xl mx-auto">
          <h2 id="how-it-works" className="text-2xl font-bold text-gray-800 text-center mb-8">
            How it works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white/80 border border-purple-100 rounded-2xl p-6 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 text-white flex items-center justify-center text-xl" aria-hidden="true">
                👤
              </div>
              <h3 className="mt-4 text-lg font-semibold text-purple-700">
                Write about the people in your life
              </h3>
              <p className="text-gray-600 mt-2">
                Create a private profile for anyone — a friend, a parent, a partner. Add notes,
                emotions, and thoughts you&apos;ve never been able to say directly. Only you can see
                this.
              </p>
            </div>
            <div className="bg-white/80 border border-purple-100 rounded-2xl p-6 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-500 text-white flex items-center justify-center text-xl" aria-hidden="true">
                💬
              </div>
              <h3 className="mt-4 text-lg font-semibold text-purple-700">
                Express freely, without judgment
              </h3>
              <p className="text-gray-600 mt-2">
                Write what you really feel — gratitude, frustration, love, grief. No filters, no
                audience. Just you and your truth, safely encrypted.
              </p>
            </div>
            <div className="bg-white/80 border border-purple-100 rounded-2xl p-6 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-500 text-white flex items-center justify-center text-xl" aria-hidden="true">
                🔗
              </div>
              <h3 className="mt-4 text-lg font-semibold text-purple-700">
                Hear what others feel about you
              </h3>
              <p className="text-gray-600 mt-2">
                Share your Mirror Profile link and let people send you anonymous, heartfelt messages.
                Discover how you&apos;re seen by the people who matter.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 pb-16" aria-labelledby="faq">
        <div className="max-w-3xl mx-auto">
          <h2 id="faq" className="text-2xl font-bold text-gray-800 text-center mb-8">
            Frequently Asked Questions
          </h2>
          <div className="space-y-3">
            <details className="group bg-white/80 border border-purple-100 rounded-2xl p-5 shadow-sm">
              <summary className="cursor-pointer list-none font-semibold text-gray-800 flex items-center justify-between">
                Is Feelability really private?
                <span className="text-2xl leading-none text-purple-400 transition-transform group-open:rotate-180" aria-hidden="true">▾</span>
              </summary>
              <p className="text-gray-600 mt-3">
                Yes. Your notes are end-to-end encrypted, which means only you can read them. We
                cannot access the content of anything you write.
              </p>
            </details>
            <details className="group bg-white/80 border border-purple-100 rounded-2xl p-5 shadow-sm">
              <summary className="cursor-pointer list-none font-semibold text-gray-800 flex items-center justify-between">
                What is a Mirror Profile?
                <span className="text-2xl leading-none text-purple-400 transition-transform group-open:rotate-180" aria-hidden="true">▾</span>
              </summary>
              <p className="text-gray-600 mt-3">
                A Mirror Profile is a shareable link you can send to people in your life. They can
                leave you anonymous, heartfelt messages — and you receive them privately.
              </p>
            </details>
            <details className="group bg-white/80 border border-purple-100 rounded-2xl p-5 shadow-sm">
              <summary className="cursor-pointer list-none font-semibold text-gray-800 flex items-center justify-between">
                Is Feelability a therapy app?
                <span className="text-2xl leading-none text-purple-400 transition-transform group-open:rotate-180" aria-hidden="true">▾</span>
              </summary>
              <p className="text-gray-600 mt-3">
                No. Feelability is a private emotional journaling and anonymous feedback tool.
                It&apos;s not a substitute for professional mental health support, but many users find
                it helpful for self-reflection and processing emotions.
              </p>
            </details>
            <details className="group bg-white/80 border border-purple-100 rounded-2xl p-5 shadow-sm">
              <summary className="cursor-pointer list-none font-semibold text-gray-800 flex items-center justify-between">
                Is it free to use?
                <span className="text-2xl leading-none text-purple-400 transition-transform group-open:rotate-180" aria-hidden="true">▾</span>
              </summary>
              <p className="text-gray-600 mt-3">
                You can{" "}
                <button
                  onClick={() => (user ? router.push("/app") : handleGoogleLogin("/app"))}
                  className="text-purple-600 font-semibold underline hover:text-purple-700 transition-colors"
                >
                  try Feelability for free
                </button>
                .
              </p>
            </details>
            <details className="group bg-white/80 border border-purple-100 rounded-2xl p-5 shadow-sm">
              <summary className="cursor-pointer list-none font-semibold text-gray-800 flex items-center justify-between">
                Who can see what I write?
                <span className="text-2xl leading-none text-purple-400 transition-transform group-open:rotate-180" aria-hidden="true">▾</span>
              </summary>
              <p className="text-gray-600 mt-3">
                Nobody. Notes you write are private and encrypted. Only content shared through your
                Mirror Profile is visible to others — and even then, responses are anonymous.
              </p>
            </details>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
