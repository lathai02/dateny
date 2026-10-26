export type OAuthProvider = "google" | "facebook";

export function oauthRedirectUrl(): string {
  const next = `${window.location.pathname}${window.location.search}`;
  return `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
}
