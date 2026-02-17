// src/services/signups.ts
//
// Public signup service — used by the participant-facing registration flow.
// These functions work WITHOUT an authenticated organizer session (using the
// anon key), protected by the RLS policies in schema.sql:
//
//   • "Anyone can register as a participant"  → INSERT on participants
//   • "Anyone can sign up for an event"       → INSERT on event_signups
//
// The organizer-facing read/delete operations (getEventSignups, deleteSignup)
// DO require an authenticated session and are protected by RLS automatically.

import { supabase } from './supabase';
import type { Participant, EventSignup } from './supabase';
import type { SignupRow } from './events';

// ---------------------------------------------------------------------------
// addParticipant
// ---------------------------------------------------------------------------

/**
 * Create a new participant record.
 *
 * This is the first step in the public registration flow (no login needed).
 * Call this before addSignup to get the participant ID.
 *
 * Note: we intentionally do NOT deduplicate by email here — the same person
 * can sign up for multiple events and will get separate participant rows.
 * Deduplication can be added in a later milestone if needed.
 */
export async function addParticipant(
  name: string,
  email: string,
  phone?: string,
): Promise<Participant> {
  console.log('[signups] addParticipant:', name, email);

  const { data, error } = await supabase
    .from('participants')
    .insert({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone?.trim() || null,
    })
    .select()
    .single();

  if (error || !data) {
    console.error('[signups] addParticipant error:', error?.message);
    throw new Error(`Failed to register participant: ${error?.message ?? 'unknown error'}`);
  }

  console.log('[signups] addParticipant success — participant id:', data.id);
  return data;
}

// ---------------------------------------------------------------------------
// addSignup
// ---------------------------------------------------------------------------

/**
 * Register a participant for an event (and optionally a specific slot).
 *
 * Call addParticipant first to create the participant row, then pass
 * the returned ID here.
 *
 * slotId can be null for events that have no slots configured.
 *
 * Throws if the participant has already claimed this slot on this event
 * (the DB UNIQUE constraint will fire).
 */
export async function addSignup(
  eventId: string,
  participantId: string,
  slotId: string | null,
): Promise<EventSignup> {
  console.log('[signups] addSignup — event:', eventId, '| participant:', participantId, '| slot:', slotId ?? 'none');

  const { data, error } = await supabase
    .from('event_signups')
    .insert({
      event_id: eventId,
      participant_id: participantId,
      slot_id: slotId,
    })
    .select()
    .single();

  if (error || !data) {
    // Surface a friendly message for the duplicate-signup case
    const isDuplicate =
      error?.code === '23505' || error?.message?.includes('unique');

    console.error('[signups] addSignup error:', error?.message);
    throw new Error(
      isDuplicate
        ? 'You have already signed up for this slot.'
        : `Failed to complete signup: ${error?.message ?? 'unknown error'}`,
    );
  }

  console.log('[signups] addSignup success — signup id:', data.id);
  return data;
}

// ---------------------------------------------------------------------------
// getEventSignups
// ---------------------------------------------------------------------------

/**
 * Fetch all signups for an event, with participant info and slot name.
 *
 * Requires an authenticated organizer session (RLS enforces this).
 * Returns them sorted by sign-up time, oldest first.
 */
export async function getEventSignups(eventId: string): Promise<SignupRow[]> {
  console.log('[signups] getEventSignups — event:', eventId);

  const { data, error } = await supabase
    .from('event_signups')
    .select(`
      id,
      participant_id,
      slot_id,
      signed_up_at,
      participants(id, name, email, phone),
      signup_slots(name)
    `)
    .eq('event_id', eventId)
    .order('signed_up_at', { ascending: true });

  if (error) {
    console.error('[signups] getEventSignups error:', error.message);
    throw new Error(`Failed to load signups: ${error.message}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: SignupRow[] = (data ?? []).map((es: any) => ({
    signup_id: es.id,
    participant_id: es.participant_id,
    slot_id: es.slot_id,
    signed_up_at: es.signed_up_at,
    name: es.participants?.name ?? '',
    email: es.participants?.email ?? '',
    phone: es.participants?.phone ?? null,
    slot_name: es.signup_slots?.name ?? null,
  }));

  console.log(`[signups] getEventSignups — ${rows.length} signup(s) for event ${eventId}`);
  return rows;
}

// ---------------------------------------------------------------------------
// deleteSignup
// ---------------------------------------------------------------------------

/**
 * Cancel a signup by its ID (organizer removes a participant from an event).
 *
 * Requires an authenticated organizer session. RLS ensures organizers can
 * only delete signups that belong to their own events.
 *
 * NOTE: This does NOT delete the participant row — the participant record
 * persists (useful for history/analytics). Only the event_signups row is removed.
 */
export async function deleteSignup(signupId: string): Promise<void> {
  console.log('[signups] deleteSignup:', signupId);

  const { error } = await supabase
    .from('event_signups')
    .delete()
    .eq('id', signupId);

  if (error) {
    console.error('[signups] deleteSignup error:', error.message);
    throw new Error(`Failed to cancel signup: ${error.message}`);
  }

  console.log('[signups] deleteSignup success:', signupId);
}
