-- =============================================================================
-- CountMeIn Pro — Supabase Database Schema
-- Milestone 2
--
-- HOW TO USE:
--   1. Open your Supabase project dashboard → SQL Editor
--   2. Paste this entire file and click Run
--   3. All tables, indexes, RLS policies, and triggers will be created
--
-- TABLE OVERVIEW:
--   events          – Organizer-created signup events
--   signup_slots    – Named slots within an event (e.g. "Bring cookies")
--   participants    – People who sign up (no account required)
--   event_signups   – Join table linking participants ↔ events ↔ slots
--
-- NOTE: We rely on Supabase's built-in auth.users table for organizer
--       accounts. No separate "users" table is needed.
-- =============================================================================


-- =============================================================================
-- UTILITY: auto-update "updated_at" on any row change
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- =============================================================================
-- TABLE: events
-- Owned by an organizer (auth.users). Each event has a capacity and optional
-- location. Slots are created separately in signup_slots.
-- =============================================================================

CREATE TABLE public.events (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title             TEXT        NOT NULL,
  description       TEXT,
  date              DATE        NOT NULL,
  time              TEXT        NOT NULL,       -- e.g. "10:00 AM" — kept as text to match UI
  location          TEXT,
  capacity          INTEGER     NOT NULL DEFAULT 0 CHECK (capacity >= 0),
  reminder_sent_at  TIMESTAMPTZ,               -- set when the 24-hour reminder batch runs
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Keep updated_at current automatically
CREATE TRIGGER events_set_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Index: organizer looks up their own events constantly
CREATE INDEX idx_events_user_id ON public.events (user_id);

-- Index: sorting/filtering events by date
CREATE INDEX idx_events_date ON public.events (date);


-- =============================================================================
-- TABLE: signup_slots
-- Named contribution slots within an event (e.g. "Bring napkins", qty 3).
-- Deleting the parent event cascades to its slots.
-- =============================================================================

CREATE TABLE public.signup_slots (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id   UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  quantity   INTEGER     NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index: fetch all slots for a given event
CREATE INDEX idx_signup_slots_event_id ON public.signup_slots (event_id);


-- =============================================================================
-- TABLE: participants
-- A person who signs up for an event. No login required — just name/email.
-- Email is not globally unique because the same person may sign up for
-- multiple events over time.
-- =============================================================================

CREATE TABLE public.participants (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT        NOT NULL,
  email      TEXT        NOT NULL,
  phone      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index: look up a participant by email (e.g. "has this person signed up before?")
CREATE INDEX idx_participants_email ON public.participants (email);


-- =============================================================================
-- TABLE: event_signups
-- Join table: one row per participant-slot registration.
-- A participant can hold multiple slots in the same event (one row each).
-- slot_id is nullable — a participant may sign up for the event without
-- choosing a specific slot.
-- =============================================================================

CREATE TABLE public.event_signups (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id       UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  participant_id UUID        NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  slot_id        UUID        REFERENCES public.signup_slots(id) ON DELETE SET NULL,
  signed_up_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent a participant from claiming the same slot twice on the same event
  UNIQUE (event_id, participant_id, slot_id)
);

-- Index: load all signups for a given event (organizer dashboard view)
CREATE INDEX idx_event_signups_event_id ON public.event_signups (event_id);

-- Index: load all events a participant has signed up for
CREATE INDEX idx_event_signups_participant_id ON public.event_signups (participant_id);

-- Index: count remaining capacity for a slot
CREATE INDEX idx_event_signups_slot_id ON public.event_signups (slot_id);


-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signup_slots  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participants  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_signups ENABLE ROW LEVEL SECURITY;


-- -----------------------------------------------------------------------------
-- events policies
-- Only the organizer who created an event can read or modify it.
-- -----------------------------------------------------------------------------

CREATE POLICY "Organizers can view their own events"
  ON public.events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Organizers can create events"
  ON public.events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Organizers can update their own events"
  ON public.events FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Organizers can delete their own events"
  ON public.events FOR DELETE
  USING (auth.uid() = user_id);


-- -----------------------------------------------------------------------------
-- signup_slots policies
-- A slot belongs to an event; access mirrors the event's ownership.
-- -----------------------------------------------------------------------------

CREATE POLICY "Organizers can view slots for their events"
  ON public.signup_slots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.events
      WHERE events.id = signup_slots.event_id
        AND events.user_id = auth.uid()
    )
  );

CREATE POLICY "Organizers can create slots for their events"
  ON public.signup_slots FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events
      WHERE events.id = signup_slots.event_id
        AND events.user_id = auth.uid()
    )
  );

CREATE POLICY "Organizers can update slots for their events"
  ON public.signup_slots FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.events
      WHERE events.id = signup_slots.event_id
        AND events.user_id = auth.uid()
    )
  );

CREATE POLICY "Organizers can delete slots for their events"
  ON public.signup_slots FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.events
      WHERE events.id = signup_slots.event_id
        AND events.user_id = auth.uid()
    )
  );


-- -----------------------------------------------------------------------------
-- participants policies
-- Anyone (even unauthenticated) can INSERT a new participant row — this is how
-- signups work without requiring an account.
-- Only organizers can SELECT participants linked to their own events.
-- No UPDATE or DELETE from the client — those happen through event_signups.
-- -----------------------------------------------------------------------------

CREATE POLICY "Anyone can register as a participant"
  ON public.participants FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Organizers can view participants in their events"
  ON public.participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.event_signups es
      JOIN public.events e ON e.id = es.event_id
      WHERE es.participant_id = participants.id
        AND e.user_id = auth.uid()
    )
  );


-- -----------------------------------------------------------------------------
-- event_signups policies
-- Anyone can INSERT a signup (public registration flow).
-- Only the organizer of the related event can SELECT, UPDATE, or DELETE signups.
-- -----------------------------------------------------------------------------

CREATE POLICY "Anyone can sign up for an event"
  ON public.event_signups FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Organizers can view signups for their events"
  ON public.event_signups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.events
      WHERE events.id = event_signups.event_id
        AND events.user_id = auth.uid()
    )
  );

CREATE POLICY "Organizers can delete signups from their events"
  ON public.event_signups FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.events
      WHERE events.id = event_signups.event_id
        AND events.user_id = auth.uid()
    )
  );


-- =============================================================================
-- MIGRATION: reminder_sent_at column (run this if the table already exists)
-- Safe to run multiple times — ALTER TABLE ADD COLUMN IF NOT EXISTS is idempotent.
-- =============================================================================

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;
