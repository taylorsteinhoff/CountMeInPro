// src/services/events.ts
//
// Event management service — all operations that require an authenticated
// organizer. RLS on the database ensures organizers can only touch their
// own rows even if these functions were called with the wrong userId.
//
// Every function throws a plain Error with a human-readable message on
// failure so screens can catch and display it directly.

import { supabase } from './supabase';
import type { Event, SignupSlot } from './supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * An event as shown on the organizer's dashboard list.
 * Includes a pre-computed signup count so the card can display
 * "5 signed up / 3 spots left" without a separate query.
 */
export type EventSummary = Event & {
  signup_count: number;
};

/**
 * A fully-loaded event for the detail screen: includes all slots and
 * all signups with participant info and the slot name each person chose.
 */
export type EventDetail = Event & {
  slots: SignupSlot[];
  signups: SignupRow[];
};

/** A single signup entry with the participant's details attached. */
export type SignupRow = {
  signup_id: string;
  participant_id: string;
  slot_id: string | null;
  signed_up_at: string;
  name: string;
  email: string;
  phone: string | null;
  slot_name: string | null;
  notes: string | null;
};

/** Input shape for creating a new event with its slots in one call. */
export type CreateEventInput = {
  title: string;
  description?: string;
  date: string;    // "YYYY-MM-DD"
  time: string;    // "10:00 AM" — display string, matches UI
  location?: string;
  capacity: number;
  slots: Array<{ name: string; quantity: number }>;
};

/** Fields that can be patched on an existing event (slots are managed separately). */
export type UpdateEventInput = Partial<
  Pick<Event, 'title' | 'description' | 'date' | 'time' | 'location' | 'capacity'>
>;

// ---------------------------------------------------------------------------
// getMyEvents
// ---------------------------------------------------------------------------

/**
 * Fetch all events created by this organizer, ordered soonest first.
 * Returns each event with a signup_count for the dashboard card.
 */
export async function getMyEvents(userId: string): Promise<EventSummary[]> {
  console.log('[events] getMyEvents for user:', userId);

  // Embed event_signups so we can count them client-side.
  // RLS ensures only this user's events are returned regardless.
  const { data, error } = await supabase
    .from('events')
    .select('*, event_signups(id)')
    .eq('user_id', userId)
    .order('date', { ascending: true });

  if (error) {
    console.error('[events] getMyEvents error:', error.message);
    throw new Error(`Failed to load events: ${error.message}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (data ?? []) as any[];
  const events: EventSummary[] = rows.map((row) => {
    const { event_signups, ...eventFields } = row;
    return {
      ...eventFields,
      signup_count: Array.isArray(event_signups) ? event_signups.length : 0,
    };
  });

  console.log(`[events] getMyEvents — ${events.length} event(s) returned`);
  return events;
}

// ---------------------------------------------------------------------------
// createEvent
// ---------------------------------------------------------------------------

/**
 * Create a new event (and its slots) for this organizer.
 *
 * Inserts the event row first, then batch-inserts the slots using the
 * returned event ID. If the slot insert fails, the event row is deleted
 * to keep the database clean.
 *
 * Returns the newly created event's ID.
 */
export async function createEvent(userId: string, input: CreateEventInput): Promise<string> {
  console.log('[events] createEvent:', input.title);

  // 1. Insert the event row
  const { data: eventData, error: eventError } = await supabase
    .from('events')
    .insert({
      user_id: userId,
      title: input.title,
      description: input.description ?? null,
      date: input.date,
      time: input.time,
      location: input.location ?? null,
      capacity: input.capacity,
    })
    .select('id')
    .single();

  if (eventError || !eventData) {
    console.error('[events] createEvent — event insert error:', eventError?.message);
    throw new Error(`Failed to create event: ${eventError?.message ?? 'unknown error'}`);
  }

  const eventId = eventData.id;
  console.log('[events] createEvent — event row created, id:', eventId);

  // 2. Batch-insert the slots (skip if none provided)
  const validSlots = input.slots.filter((s) => s.name.trim() !== '');
  if (validSlots.length > 0) {
    const slotRows = validSlots.map((s) => ({
      event_id: eventId,
      name: s.name.trim(),
      quantity: s.quantity,
    }));

    const { error: slotError } = await supabase.from('signup_slots').insert(slotRows);

    if (slotError) {
      console.error('[events] createEvent — slot insert error:', slotError.message);
      // Clean up the orphaned event row so the DB stays consistent
      await supabase.from('events').delete().eq('id', eventId);
      throw new Error(`Event created but slots failed to save: ${slotError.message}`);
    }

    console.log(`[events] createEvent — ${validSlots.length} slot(s) created`);
  }

  return eventId;
}

// ---------------------------------------------------------------------------
// getEventDetail
// ---------------------------------------------------------------------------

/**
 * Fetch a single event with its slots and all signups (with participant info).
 * Used by EventDetailScreen and ParticipantSignUpScreen.
 */
export async function getEventDetail(eventId: string): Promise<EventDetail> {
  console.log('[events] getEventDetail:', eventId);

  const { data, error } = await supabase
    .from('events')
    .select(`
      *,
      signup_slots(*),
      event_signups(
        id,
        participant_id,
        slot_id,
        signed_up_at,
        notes,
        participants(id, name, email, phone),
        signup_slots(name)
      )
    `)
    .eq('id', eventId)
    .single();

  if (error) {
    console.error('[events] getEventDetail error:', error.message);
    throw new Error(`Failed to load event: ${error.message}`);
  }

  if (!data) {
    throw new Error('Event not found');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = data as any;

  // Flatten nested joins into the SignupRow shape screens expect
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const signups: SignupRow[] = (raw.event_signups ?? []).map((es: any) => ({
    signup_id: es.id,
    participant_id: es.participant_id,
    slot_id: es.slot_id,
    signed_up_at: es.signed_up_at,
    name: es.participants?.name ?? '',
    email: es.participants?.email ?? '',
    phone: es.participants?.phone ?? null,
    slot_name: es.signup_slots?.name ?? null,
    notes: es.notes ?? null,
  }));

  const { signup_slots, event_signups, ...eventFields } = raw;

  const detail: EventDetail = {
    ...eventFields,
    slots: signup_slots ?? [],
    signups,
  };

  console.log(
    `[events] getEventDetail — "${detail.title}", ${detail.slots.length} slot(s), ${detail.signups.length} signup(s)`,
  );
  return detail;
}

// ---------------------------------------------------------------------------
// updateEvent
// ---------------------------------------------------------------------------

/**
 * Patch one or more fields on an existing event.
 * Does NOT update slots — manage slots separately if needed in a future milestone.
 */
export async function updateEvent(eventId: string, updates: UpdateEventInput): Promise<void> {
  console.log('[events] updateEvent:', eventId, updates);

  const { error } = await supabase
    .from('events')
    .update(updates)
    .eq('id', eventId);

  if (error) {
    console.error('[events] updateEvent error:', error.message);
    throw new Error(`Failed to update event: ${error.message}`);
  }

  console.log('[events] updateEvent success:', eventId);
}

// ---------------------------------------------------------------------------
// deleteEvent
// ---------------------------------------------------------------------------

/**
 * Delete an event. Cascades automatically to signup_slots and event_signups
 * per the ON DELETE CASCADE constraints in schema.sql.
 */
export async function deleteEvent(eventId: string): Promise<void> {
  console.log('[events] deleteEvent:', eventId);

  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', eventId);

  if (error) {
    console.error('[events] deleteEvent error:', error.message);
    throw new Error(`Failed to delete event: ${error.message}`);
  }

  console.log('[events] deleteEvent success:', eventId);
}

// ---------------------------------------------------------------------------
// getEventsByQuery
// ---------------------------------------------------------------------------

/**
 * Search the logged-in organizer's events by title (case-insensitive).
 * RLS scopes results to the current user automatically.
 *
 * Returns events with signup_count, same shape as getMyEvents.
 */
export async function getEventsByQuery(query: string): Promise<EventSummary[]> {
  console.log('[events] getEventsByQuery:', query);

  const { data, error } = await supabase
    .from('events')
    .select('*, event_signups(id)')
    .ilike('title', `%${query}%`)
    .order('date', { ascending: true });

  if (error) {
    console.error('[events] getEventsByQuery error:', error.message);
    throw new Error(`Search failed: ${error.message}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (data ?? []) as any[];
  const events: EventSummary[] = rows.map((row) => {
    const { event_signups, ...eventFields } = row;
    return {
      ...eventFields,
      signup_count: Array.isArray(event_signups) ? event_signups.length : 0,
    };
  });

  console.log(`[events] getEventsByQuery — ${events.length} result(s) for "${query}"`);
  return events;
}
