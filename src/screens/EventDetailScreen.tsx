import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { getEventDetail, type EventDetail } from '../services/events';

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
        <Pressable onPress={handleShare} style={styles.outlineBtn}>
          <Text style={styles.outlineBtnText}>Share Event</Text>
        </Pressable>

        <Pressable onPress={handleExport} style={styles.outlineBtn}>
          <Text style={styles.outlineBtnText}>Export Signup List</Text>
        </Pressable>

        <Pressable onPress={handleSignUp} style={styles.solidBtn}>
          <Text style={styles.solidBtnText}>Sign Up</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFound: { fontSize: 18, color: '#666' },

  /* Card */
  card: {
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: 8,
    padding: 16,
  },
  title: { fontSize: 22, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  description: { fontSize: 15, color: '#666', marginBottom: 16 },
  infoRow: { marginBottom: 12 },
  infoLabel: { fontSize: 13, fontWeight: '600', color: '#666', marginBottom: 2 },
  infoValue: { fontSize: 16, color: '#333' },

  /* Capacity bar */
  capacitySection: { marginTop: 4 },
  barTrack: {
    height: 8,
    backgroundColor: '#E8E8E8',
    borderRadius: 4,
    marginTop: 6,
    overflow: 'hidden',
  },
  barFill: {
    height: 8,
    backgroundColor: '#4A90D9',
    borderRadius: 4,
  },

  /* Slots */
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 24,
    marginBottom: 8,
  },
  slotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  slotName: { fontSize: 16, color: '#333' },
  slotQty: { fontSize: 16, color: '#666' },

  /* Participants */
  emptyText: { fontSize: 15, color: '#999', marginBottom: 8 },
  participantRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  participantName: { fontSize: 16, fontWeight: '600', color: '#333' },
  participantDetail: { fontSize: 14, color: '#666', marginTop: 2 },

  /* Buttons */
  actions: { marginTop: 32, gap: 12 },
  outlineBtn: {
    borderWidth: 1,
    borderColor: '#4A90D9',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  outlineBtnText: { color: '#4A90D9', fontSize: 16, fontWeight: '600' },
  solidBtn: {
    backgroundColor: '#4A90D9',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },
  solidBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
