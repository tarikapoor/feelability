"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { motion } from "framer-motion";

export default function Navbar() {
  const router = useRouter();
  const { user, signOut } = useAuth();

  // Only show navbar if user is authenticated
  if (!user) return null;

  const handleLogout = async () => {
    await signOut();
    router.push("/");
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left side - empty for centered layout */}
          <div className="flex-1" />

          {/* Center - Feelability logo/text */}
          <div className="flex-1 flex justify-center">
            <motion.button
              onClick={() => router.push("/")}
              className="text-xl font-bold text-gray-800 hover:text-pink-500 transition-colors cursor-pointer"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Feelability
            </motion.button>
          </div>

          {/* Right side - Logout button */}
          <div className="flex-1 flex justify-end">
            <motion.button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-pink-600 transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Logout
            </motion.button>
          </div>
        </div>
      </div>
    </nav>
  );
}

