"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

type AuthContextValue = {
	user: User | null;
	session: Session | null;
	loading: boolean;
	signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
	user: null,
	session: null,
	loading: true,
	signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [session, setSession] = useState<Session | null>(null);
	const [user, setUser] = useState<User | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let mounted = true;

		const init = async () => {
			const { data } = await supabase.auth.getSession();
			if (!mounted) return;
			setSession(data.session);
			setUser(data.session?.user ?? null);
			setLoading(false);
		};
		init();

	const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
		setSession(sess);
		setUser(sess?.user ?? null);
		if (event === "SIGNED_OUT") {
			setLoading(false);
		}
	});
		return () => {
			mounted = false;
			sub.subscription.unsubscribe();
		};
	}, []);

	const value = useMemo<AuthContextValue>(
		() => ({
			user,
			session,
			loading,
			signOut: async () => {
				await supabase.auth.signOut();
			},
		}),
		[user, session, loading]
	);

	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white via-blue-50 via-pink-50 to-yellow-50">
				<div className="h-12 w-12 rounded-full border-4 border-pink-200 border-t-pink-500 animate-spin" />
			</div>
		);
	}

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
	return useContext(AuthContext);
}


