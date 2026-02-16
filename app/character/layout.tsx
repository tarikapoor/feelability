import { Suspense } from "react";

export default function CharacterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white via-blue-50 via-pink-50 to-yellow-50">
          <div className="h-12 w-12 rounded-full border-4 border-pink-200 border-t-pink-500 animate-spin" />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}
