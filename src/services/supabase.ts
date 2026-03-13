import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xmthyxrvserdjapxohye.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtdGh5eHJ2c2VyZGphcHhvaHllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNTMxMDAsImV4cCI6MjA4NjkyOTEwMH0.n5YeorC1hCMuUFqscWgt5LdFISmU-7FHg9CPIxw5Lq0';

export type Event = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  date: string;
  time: string;
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
export type EventSignupWithDetails = EventSignup & {
  participant: Participant;
  slot: Pick<SignupSlot, 'id' | 'name'> | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase = createClient<any>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});