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

	// Render children immediately to avoid blocking FCP/LCP. Auth state updates
	// when getSession() resolves; components use loading when needed.
	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
	return useContext(AuthContext);
}


