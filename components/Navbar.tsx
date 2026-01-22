"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
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
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/70 backdrop-blur-sm border-b border-gray-200">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <motion.button
            onClick={() => router.push("/login")}
            className="flex items-center gap-2 font-semibold text-pink-600 hover:text-pink-700 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="text-lg">💜</span>
            <span>Feelability</span>
          </motion.button>

          <motion.button
            onClick={handleLogout}
            className="px-4 py-2 rounded-lg border border-purple-200 text-purple-700 text-sm font-semibold hover:bg-white transition-colors"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            Logout
          </motion.button>
        </div>
      </div>
    </nav>
  );
}

