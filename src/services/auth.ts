// src/services/auth.ts
//
// Authentication service — wraps Supabase Auth for organizer accounts.
// All organizer-facing operations (creating/managing events) require a
// logged-in user. Participant signups do NOT require auth (see signups.ts).
//
// Every function throws a plain Error with a human-readable message on
// failure so screens can catch and display it directly.

import { supabase } from './supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal auth user shape returned to screens. */
export type AuthUser = {
  id: string;
  email: string | undefined;
};

// ---------------------------------------------------------------------------
// signUp
// ---------------------------------------------------------------------------

/**
 * Register a new organizer account.
 *
 * Supabase sends a confirmation email by default. The returned user's
 * `email_confirmed_at` will be null until they click the link.
 * For dev/testing you can disable email confirmation in the Supabase
 * dashboard under Authentication → Settings.
 */
export async function signUp(email: string, password: string): Promise<AuthUser> {
  console.log('[auth] signUp attempt:', email);

  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    console.error('[auth] signUp error:', error.message);
    throw new Error(error.message);
  }

  if (!data.user) {
    throw new Error('Sign up completed but no user was returned. Check email confirmation settings.');
  }

  console.log('[auth] signUp success — user id:', data.user.id);
  return { id: data.user.id, email: data.user.email };
}

// ---------------------------------------------------------------------------
// signIn
// ---------------------------------------------------------------------------

/**
 * Log in an existing organizer with email + password.
 * Returns the user on success; throws on bad credentials or network error.
 */
export async function signIn(email: string, password: string): Promise<AuthUser> {
  console.log('[auth] signIn attempt:', email);

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.error('[auth] signIn error:', error.message);
    throw new Error(error.message);
  }

  if (!data.user) {
    throw new Error('Sign in completed but no user was returned.');
  }

  console.log('[auth] signIn success — user id:', data.user.id);
  return { id: data.user.id, email: data.user.email };
}

// ---------------------------------------------------------------------------
// signOut
// ---------------------------------------------------------------------------

/**
 * Log out the current organizer and clear the local session.
 */
export async function signOut(): Promise<void> {
  console.log('[auth] signOut');

  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error('[auth] signOut error:', error.message);
    throw new Error(error.message);
  }

  console.log('[auth] signOut success');
}

// ---------------------------------------------------------------------------
// getCurrentUser
// ---------------------------------------------------------------------------

/**
 * Return the currently logged-in organizer's user ID, or null if not logged in.
 *
 * Uses getUser() which validates the session with Supabase's server rather
 * than reading from localStorage — safer for auth-gating screens.
 */
export async function getCurrentUser(): Promise<string | null> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    // A "user not found" error just means not logged in — not a real error.
    console.log('[auth] getCurrentUser — not authenticated');
    return null;
  }

  const userId = user?.id ?? null;
  console.log('[auth] getCurrentUser —', userId ? `user id: ${userId}` : 'not logged in');
  return userId;
}

// ---------------------------------------------------------------------------
// onAuthStateChanged
// ---------------------------------------------------------------------------

/**
 * Subscribe to auth state changes (sign in / sign out / token refresh).
 *
 * The callback receives the user ID string when signed in, or null when
 * signed out. Call the returned function to unsubscribe — do this in your
 * useEffect cleanup to prevent memory leaks:
 *
 *   useEffect(() => {
 *     const unsubscribe = onAuthStateChanged((userId) => { ... });
 *     return unsubscribe;
 *   }, []);
 */
export function onAuthStateChanged(callback: (userId: string | null) => void): () => void {
  console.log('[auth] subscribing to auth state changes');

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    const userId = session?.user?.id ?? null;
    console.log(`[auth] state changed — event: ${event}, user id: ${userId ?? 'none'}`);
    callback(userId);
  });

  // Return the unsubscribe function for useEffect cleanup
  return () => {
    console.log('[auth] unsubscribing from auth state changes');
    subscription.unsubscribe();
  };
}
