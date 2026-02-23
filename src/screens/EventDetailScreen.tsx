import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { getEventDetail, type EventDetail } from '../services/events';
import { supabase } from '../services/supabase';

type DetailRoute = RouteProp<RootStackParamList, 'EventDetail'>;

export default function EventDetailScreen() {
  const { params } = useRoute<DetailRoute>();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getEventDetail(params.eventId);
        if (!cancelled) setEvent(data);
      } catch (e: unknown) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Failed to load event.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [params.eventId]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4A90D9" />
      </View>
    );
  }

  if (error || !event) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFound}>{error || 'Event not found'}</Text>
      </View>
    );
  }

  const spotsUsed = event.signups.length;
  const fillPct = Math.min((spotsUsed / event.capacity) * 100, 100);

  const handleShare = async () => {
    await Share.share({
      message: `${event.title}\n${event.date} at ${event.time}\n${event.location}`,
    });
  };

  const handleExport = async () => {
    const lines = event.signups.length
      ? event.signups.map((p) => `${p.name} — ${p.email}`).join('\n')
      : 'No signups yet.';
    await Share.share({
      message: `Signup list for ${event.title}:\n\n${lines}`,
    });
  };

  const handleExportCSV = async () => {
    try {
      // Build CSV header
      let csv = 'Slot Name,Participant Name,Email,Phone,Signed Up At\n';

      const { data: slots } = await supabase
        .from('signup_slots')
        .select('*')
        .eq('event_id', params.eventId)
        .order('created_at', { ascending: true });

      const { data: allSignups } = await supabase
        .from('event_signups')
        .select('*, participants(*), signup_slots(*)')
        .eq('event_id', params.eventId);

      for (const slot of slots || []) {
        const slotSignups = (allSignups || []).filter((s) => s.slot_id === slot.id);

        if (slotSignups.length === 0) {
          csv += `"${slot.name}","(empty)","","",""\n`;
        } else {
          for (const signup of slotSignups) {
            csv += `"${slot.name}","${signup.participants?.name || ''}","${signup.participants?.email || ''}","${signup.participants?.phone || ''}","${signup.signed_up_at || ''}"\n`;
          }
        }
      }

      await Share.share({
        message: csv,
        title: `${event?.title} - Signups Export`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to export data';
      Alert.alert('Export Error', msg);
    }
  };

  const handleDuplicateEvent = async () => {
    Alert.alert(
      'Duplicate Event',
      `Create a copy of "${event.title}"?`,
      [
        { text: 'Cancel' },
        {
          text: 'Duplicate',
          onPress: async () => {
            try {
              const { data: user } = await supabase.auth.getUser();
              if (!user.user?.id) throw new Error('Not authenticated');

              // Default the copy to one week from today
              const nextWeek = new Date();
              nextWeek.setDate(nextWeek.getDate() + 7);
              const newDate = nextWeek.toISOString().split('T')[0];

              const { data: newEvent, error: eventError } = await supabase
                .from('events')
                .insert({
                  user_id: user.user.id,
                  title: `${event.title} (Copy)`,
                  description: event.description,
                  date: newDate,
                  time: event.time,
                  location: event.location,
                  capacity: event.capacity,
                })
                .select()
                .single();

              if (eventError) throw eventError;

              // Copy all slots from the original event
              const { data: originalSlots } = await supabase
                .from('signup_slots')
                .select('*')
                .eq('event_id', params.eventId);

              if (originalSlots && originalSlots.length > 0) {
                const newSlots = originalSlots.map((s) => ({
                  event_id: newEvent.id,
                  name: s.name,
                  quantity: s.quantity,
                }));

                await supabase.from('signup_slots').insert(newSlots);
              }

              Alert.alert(
                'Event Duplicated!',
                `"${event.title} (Copy)" has been created for ${newDate}. You can edit the date and details from the dashboard.`,
                [
                  {
                    text: 'Go to Dashboard',
                    onPress: () => navigation.navigate('HomeDashboard', { userId: event.user_id }),
                  },
                  { text: 'Stay Here' },
                ],
              );
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : 'Failed to duplicate event';
              Alert.alert('Error', msg);
            }
          },
        },
      ],
    );
  };

  const handleAddToCalendar = () => {
    const eventTitle = encodeURIComponent(event.title);
    const eventLocation = encodeURIComponent(event.location || '');
    const eventDescription = encodeURIComponent(event.description || '');
    // Supabase returns date as "YYYY-MM-DD" and time as "HH:MM:SS"
    const startDate = event.date.replace(/-/g, '');
    const startTime = event.time.replace(/:/g, '').slice(0, 6); // "HHMMSS"

    const googleUrl =
      `https://calendar.google.com/calendar/render?action=TEMPLATE` +
      `&text=${eventTitle}` +
      `&dates=${startDate}T${startTime}/${startDate}T${startTime}` +
      `&location=${eventLocation}` +
      `&details=${eventDescription}`;

    const outlookUrl =
      `https://outlook.live.com/calendar/0/deeplink/compose?subject=${eventTitle}` +
      `&startdt=${event.date}T${event.time}` +
      `&enddt=${event.date}T${event.time}` +
      `&location=${eventLocation}` +
      `&body=${eventDescription}`;

    Alert.alert(
      'Add to Calendar',
      'Choose your calendar:',
      [
        {
          text: 'Google Calendar',
          onPress: () => Linking.openURL(googleUrl).catch(() =>
            Alert.alert('Error', 'Could not open Google Calendar.')
          ),
        },
        {
          text: 'Outlook',
          onPress: () => Linking.openURL(outlookUrl).catch(() =>
            Alert.alert('Error', 'Could not open Outlook.')
          ),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleSignUp = () => {
    navigation.navigate('ParticipantSignUp', { eventId: event.id });
  };

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      {/* ── Event Info Card ── */}
      <View style={styles.card}>
        <Text style={styles.title}>{event.title}</Text>
        <Text style={styles.description}>{event.description}</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Date & Time</Text>
          <Text style={styles.infoValue}>
            {event.date}  ·  {event.time}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Location</Text>
          <Text style={styles.infoValue}>{event.location}</Text>
        </View>

        {/* Capacity bar */}
        <View style={styles.capacitySection}>
          <Text style={styles.infoLabel}>
            {spotsUsed} / {event.capacity} spots filled
          </Text>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${fillPct}%` }]} />
          </View>
        </View>
      </View>

      {/* ── Signup Slots ── */}
      <Text style={styles.sectionTitle}>Signup Slots</Text>
      {event.slots.map((slot) => (
        <View key={slot.id} style={styles.slotRow}>
          <Text style={styles.slotName}>{slot.name}</Text>
          <Text style={styles.slotQty}>×{slot.quantity}</Text>
        </View>
      ))}

      {/* ── Participants ── */}
      <Text style={styles.sectionTitle}>
        Signed Up ({event.signups.length})
      </Text>
      {event.signups.length === 0 ? (
        <Text style={styles.emptyText}>No signups yet</Text>
      ) : (
        event.signups.map((p) => (
          <View key={p.signup_id} style={styles.participantRow}>
            <Text style={styles.participantName}>{p.name}</Text>
            <Text style={styles.participantDetail}>{p.email}</Text>
            {p.phone ? (
              <Text style={styles.participantDetail}>{p.phone}</Text>
            ) : null}
          </View>
        ))
      )}

      {/* ── Action Buttons ── */}
      <View style={styles.actions}>
        <Pressable onPress={handleShare} style={({ pressed }) => [styles.outlineBtn, pressed && styles.outlineBtnPressed]}>
          <Text style={styles.outlineBtnText}>Share Event</Text>
        </Pressable>

        <Pressable onPress={handleExport} style={({ pressed }) => [styles.outlineBtn, pressed && styles.outlineBtnPressed]}>
          <Text style={styles.outlineBtnText}>Export Signup List</Text>
        </Pressable>

        <TouchableOpacity style={styles.duplicateButton} onPress={handleDuplicateEvent}>
          <Text style={styles.duplicateButtonText}>📋 Duplicate Event</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.exportButton} onPress={handleExportCSV}>
          <Text style={styles.exportButtonText}>📊 Export CSV</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.calendarButton} onPress={handleAddToCalendar}>
          <Text style={styles.calendarButtonText}>📅 Add to Calendar</Text>
        </TouchableOpacity>

        <Pressable onPress={handleSignUp} style={({ pressed }) => [styles.solidBtn, pressed && styles.solidBtnPressed]}>
          <Text style={styles.solidBtnText}>Sign Up</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F9F9F9' },
  content: { padding: 20, paddingBottom: 48 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9F9F9' },
  notFound: { fontSize: 18, color: '#6B7280' },

  /* Card */
  card: {
    borderRadius: 14,
    padding: 20,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
  title: { fontSize: 26, fontWeight: '800', color: '#1A1A2E', marginBottom: 8 },
  description: { fontSize: 16, color: '#6B7280', marginBottom: 18, lineHeight: 24 },
  infoRow: { marginBottom: 14 },
  infoLabel: { fontSize: 12, fontWeight: '700', color: '#9CA3AF', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { fontSize: 17, color: '#1A1A2E', fontWeight: '500' },

  /* Capacity bar */
  capacitySection: { marginTop: 6 },
  barTrack: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    marginTop: 8,
    overflow: 'hidden',
  },
  barFill: {
    height: 8,
    backgroundColor: '#4A90D9',
    borderRadius: 4,
  },

  /* Slots */
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A2E',
    marginTop: 28,
    marginBottom: 10,
  },
  slotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  slotName: { fontSize: 16, color: '#1A1A2E', fontWeight: '500' },
  slotQty: { fontSize: 15, color: '#6B7280', fontWeight: '600' },

  /* Participants */
  emptyText: { fontSize: 15, color: '#9CA3AF', marginBottom: 8 },
  participantRow: {
    paddingVertical: 13,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  participantName: { fontSize: 17, fontWeight: '600', color: '#1A1A2E' },
  participantDetail: { fontSize: 14, color: '#6B7280', marginTop: 2 },

  /* Buttons */
  actions: { marginTop: 36, gap: 12 },
  outlineBtn: {
    borderWidth: 1.5,
    borderColor: '#4A90D9',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  outlineBtnPressed: { opacity: 0.8 },
  outlineBtnText: { color: '#4A90D9', fontSize: 17, fontWeight: '600' },
  solidBtn: {
    backgroundColor: '#4A90D9',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
  },
  solidBtnPressed: { opacity: 0.88 },
  solidBtnText: { color: '#fff', fontSize: 19, fontWeight: '700' },

  exportButton: {
    backgroundColor: '#059669',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  exportButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  duplicateButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  duplicateButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  calendarButton: {
    backgroundColor: '#0EA5E9',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  calendarButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
