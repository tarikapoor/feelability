"use client";

import Link from "next/link";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-gray-200 bg-white/70 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-gray-600">
            <span className="text-lg" aria-hidden="true">💜</span>
            <span className="font-medium text-gray-700">Feelability</span>
          </div>
          <nav className="flex items-center gap-6" aria-label="Footer navigation">
            <Link
              href="/terms"
              className="text-sm text-gray-600 hover:text-purple-600 transition-colors"
            >
              Terms and Conditions
            </Link>
            <Link
              href="/privacy"
              className="text-sm text-gray-600 hover:text-purple-600 transition-colors"
            >
              Privacy Policy
            </Link>
          </nav>
        </div>
        <p className="mt-4 text-center sm:text-left text-xs text-gray-500">
          © {currentYear} Feelability. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
