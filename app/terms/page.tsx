import type { Metadata } from "next";
import Link from "next/link";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Terms and Conditions",
  description:
    "Terms and Conditions for using Feelability - a safe space for your unspoken emotions. Private journal, end-to-end encrypted.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
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
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Terms and Conditions</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: January 2026</p>

        <div className="prose prose-gray max-w-none space-y-6 text-gray-700">
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-2">1. Acceptance of Terms</h2>
            <p>
              By accessing or using Feelability (&quot;the Service&quot;), you agree to be bound by these Terms and Conditions.
              If you do not agree to these terms, please do not use the Service. Feelability is a private journal and
              emotional journaling platform that allows you to express your feelings in a safe, end-to-end encrypted space.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-2">2. Description of Service</h2>
            <p>
              Feelability provides a web-based application for creating character profiles, writing private notes, and
              optionally sharing profiles with chosen collaborators. Content is stored in an end-to-end encrypted form.
              We do not have access to the plaintext content of your notes. You are responsible for maintaining the
              security of your account and any devices you use to access the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-2">3. Your Responsibilities</h2>
            <p>You agree to:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Provide accurate information when creating an account and keep your login credentials secure.</li>
              <li>Use the Service only for lawful purposes and in a way that does not infringe the rights of others.</li>
              <li>Not attempt to circumvent security, encryption, or access controls.</li>
              <li>Not use the Service to harass, abuse, or harm others or to distribute illegal content.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-2">4. Intellectual Property</h2>
            <p>
              The Feelability name, logo, and the design of the Service are owned by us. You retain ownership of the
              content you create (e.g., notes, profile data). By using the Service, you grant us only the limited rights
              necessary to store and serve your encrypted data and to operate the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-2">5. Privacy and Data</h2>
            <p>
              Your use of the Service is also governed by our{" "}
              <Link href="/privacy" className="text-purple-600 hover:underline">
                Privacy Policy
              </Link>
              . Because note content is end-to-end encrypted, we do not have access to the substance of your notes. We
              may collect and process account-related and usage metadata as described in the Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-2">6. Disclaimers</h2>
            <p>
              The Service is provided &quot;as is&quot; and &quot;as available.&quot; We do not guarantee uninterrupted or error-free
              operation. We are not liable for any loss of data due to your failure to maintain access to your account
              or encryption keys, or for actions taken by collaborators you choose to share content with.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-2">7. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, Feelability and its operators shall not be liable for any indirect,
              incidental, special, or consequential damages arising from your use of the Service. Our total liability
              shall not exceed the amount you paid to us (if any) in the twelve months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-2">8. Changes to Terms</h2>
            <p>
              We may update these Terms from time to time. We will post the updated terms on this page and update the
              &quot;Last updated&quot; date. Continued use of the Service after changes constitutes acceptance of the revised
              terms. For material changes, we may provide additional notice where feasible.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-2">9. Contact</h2>
            <p>
              For questions about these Terms and Conditions, please contact us on
              kapoor.tari@gmail.com.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
