"use client";

import { useSyncExternalStore } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

// A single browser subscription shared by navigation and review dialogs.
// This is UI state only; APIs continue validating identity on the server.
type AuthState = { user: User | null; ready: boolean };
const SERVER_STATE: AuthState = { user: null, ready: !isSupabaseConfigured };
let state = SERVER_STATE;
let client: ReturnType<typeof createClient> | null = null;
let unsubscribeAuth: (() => void) | null = null;
const listeners = new Set<() => void>();

function browserClient() {
  if (typeof window === "undefined" || !isSupabaseConfigured) return null;
  return (client ??= createClient());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const supabase = browserClient();
  if (supabase && !unsubscribeAuth) {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      state = { user: session?.user ?? null, ready: true };
      listeners.forEach((notify) => notify());
    });
    unsubscribeAuth = () => data.subscription.unsubscribe();
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      unsubscribeAuth?.();
      unsubscribeAuth = null;
    }
  };
}

export function useAuth() {
  const auth = useSyncExternalStore(
    subscribe,
    () => state,
    () => SERVER_STATE,
  );
  return { ...auth, supabase: browserClient() };
}
