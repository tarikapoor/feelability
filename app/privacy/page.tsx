import type { Metadata } from "next";
import Link from "next/link";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Privacy Policy for Feelability - how we handle your data. End-to-end encryption, minimal collection, and your rights.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-white via-blue-50 via-pink-50 to-yellow-50">
      <header className="px-6 py-4 border-b border-gray-200 bg-white/70 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-pink-600 font-semibold hover:text-pink-700 transition-colors"
          >
            <span className="text-lg">💜</span>
            <span>Feelability</span>
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium text-gray-600 hover:text-purple-600 transition-colors"
          >
            Login
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: January 2026</p>

        <div className="prose prose-gray max-w-none space-y-6 text-gray-700">
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-2">1. Introduction</h2>
            <p>
              Feelability (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting your privacy. This Privacy Policy
              explains how we collect, use, and safeguard information when you use our emotional journaling and private
              notes service. A core principle of Feelability is that your note content is end-to-end encrypted; we do not
              have access to the plaintext of your notes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-2">2. Information We Collect</h2>
            <h3 className="text-lg font-medium text-gray-800 mt-4 mb-2">Account and authentication</h3>
            <p>
              When you sign in (e.g., via Google), we receive and store identifiers necessary to manage your account
              (such as email and provider user id). This allows us to associate your data with your account and to
              secure access.
            </p>
            <h3 className="text-lg font-medium text-gray-800 mt-4 mb-2">Content you create</h3>
            <p>
              You create profiles, notes, and may add collaborators. Note content is encrypted on your device before
              being sent to our servers. We store only encrypted data (ciphertext and related metadata such as
              initialization vectors). We cannot read or access the plaintext of your notes.
            </p>
            <h3 className="text-lg font-medium text-gray-800 mt-4 mb-2">Usage and technical data</h3>
            <p>
              We may collect technical information such as IP address, browser type, and general usage patterns (e.g.,
              feature usage) to operate, secure, and improve the Service. We do not use this to track or profile you
              for advertising.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-2">3. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Provide, maintain, and improve the Feelability service.</li>
              <li>Authenticate you and enforce access control (e.g., only you and your chosen collaborators can access
                the encrypted content intended for you).</li>
              <li>Respond to support requests and comply with applicable law.</li>
              <li>Detect and prevent abuse, fraud, and security issues.</li>
            </ul>
            <p className="mt-2">
              We do not sell your personal information. We do not use your note content for advertising or marketing,
              as we cannot access it.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-2">4. End-to-End Encryption</h2>
            <p>
              Note content is encrypted on your device using keys that we do not possess. Only you and users you
              explicitly add as collaborators (and who have received the necessary key material) can decrypt and read
              that content. If you remove a collaborator, they will no longer be able to decrypt new or updated
              content; previously synced encrypted data may remain on their device but is designed to be unusable
              without valid keys.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-2">5. Data Storage and Security</h2>
            <p>
              We use third-party infrastructure (e.g., Supabase) to store encrypted data and account information. We
              apply industry-standard security practices and access controls. Because we do not hold decryption keys,
              we cannot decrypt your notes even if compelled by law; only you and your collaborators hold the keys.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-2">6. Data Retention</h2>
            <p>
              We retain your account and encrypted content for as long as your account is active. If you delete your
              account or request deletion, we will delete or anonymize your data in accordance with our retention
              policy and applicable law. Backups may retain data for a limited period before deletion.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-2">7. Your Rights</h2>
            <p>Depending on your location, you may have the right to:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Access and receive a copy of the personal data we hold about you.</li>
              <li>Correct or update your personal data.</li>
              <li>Request deletion of your personal data and account.</li>
              <li>Object to or restrict certain processing.</li>
              <li>Data portability (where applicable).</li>
            </ul>
            <p className="mt-2">
              To exercise these rights, contact us using the information provided on the Feelability website or in the
              app. We will respond in accordance with applicable law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-2">8. Children</h2>
            <p>
              Feelability is not directed at children under 13 (or the applicable age in your jurisdiction). We do not
              knowingly collect personal information from children. If you believe a child has provided us with
              information, please contact us and we will take steps to delete it.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-2">9. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will post the updated policy on this page and
              update the &quot;Last updated&quot; date. For significant changes, we may provide additional notice (e.g., in the
              app or by email). Continued use of the Service after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-2">10. Contact Us</h2>
            <p>
              For privacy-related questions or requests, please contact us kapoor.tari@gmail.com.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
