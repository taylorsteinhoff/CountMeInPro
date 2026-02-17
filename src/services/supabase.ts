import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Supabase connection — public (anon) credentials, safe to ship in the app.
// These are read-only keys gated by Row Level Security; they are not secrets.
// ---------------------------------------------------------------------------

const SUPABASE_URL = 'https://xmthyxrvserdjapxohye.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtdGh5eHJ2c2VyZGphcHhvaHllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNTMxMDAsImV4cCI6MjA4NjkyOTEwMH0.n5YeorC1hCMuUFqscWgt5LdFISmU-7FHg9CPIxw5Lq0';

// ---------------------------------------------------------------------------
// TypeScript types — mirror the tables in supabase/schema.sql exactly.
// These let you get autocomplete and type-checking on all DB queries.
// ---------------------------------------------------------------------------

export type Event = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  date: string;        // ISO date string: "YYYY-MM-DD"
  time: string;        // Display string: "10:00 AM"
  location: string | null;
  capacity: number;
  created_at: string;
  updated_at: string;
};

export type SignupSlot = {
  id: string;
  event_id: string;
  name: string;
  quantity: number;
  created_at: string;
};

export type Participant = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  created_at: string;
};

export type EventSignup = {
  id: string;
  event_id: string;
  participant_id: string;
  slot_id: string | null;
  signed_up_at: string;
};

// Convenience type for the joined view used on the organizer dashboard:
// one signup row with participant details and optional slot name attached.
export type EventSignupWithDetails = EventSignup & {
  participant: Participant;
  slot: Pick<SignupSlot, 'id' | 'name'> | null;
};

// ---------------------------------------------------------------------------
// Exported client — import this wherever you need to talk to Supabase.
//
// We use an untyped client here because @supabase/supabase-js v2.96+ requires
// the Database generic to include Relationships, Views, Functions, and Enums
// (the full schema produced by the Supabase CLI). Since we write those types
// by hand, we skip the generic and cast query results to our own types in each
// service file instead — giving us the same safety without the boilerplate.
//
// Usage example:
//   import { supabase } from '../services/supabase';
//   const { data, error } = await supabase.from('events').select('*');
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase = createClient<any>(SUPABASE_URL, SUPABASE_ANON_KEY);
