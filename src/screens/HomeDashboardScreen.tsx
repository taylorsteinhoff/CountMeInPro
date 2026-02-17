import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { signOut } from '../services/auth';
import { getMyEvents, type EventSummary } from '../services/events';

type Nav   = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'HomeDashboard'>;

export default function HomeDashboardScreen() {
  const navigation        = useNavigation<Nav>();
  const { params }        = useRoute<Route>();
  const { userId }        = params;

  const [events, setEvents]       = useState<EventSummary[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingSignOut, setLoadingSignOut] = useState(false);
  const [fetchError, setFetchError] = useState('');

  // ── Fetch events ────────────────────────────────────────────────────────
  const fetchEvents = useCallback(async () => {
    setLoadingData(true);
    setFetchError('');
    try {
      const data = await getMyEvents(userId);
      setEvents(data);
    } catch (e: unknown) {
      setFetchError(e instanceof Error ? e.message : 'Failed to load events.');
    } finally {
      setLoadingData(false);
    }
  }, [userId]);

  // Initial fetch
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Re-fetch every time this screen comes back into focus (e.g. after creating
  // or editing an event) so the list is always up to date.
  useFocusEffect(
    useCallback(() => {
      fetchEvents();
    }, [fetchEvents]),
  );

  // ── Sign out ─────────────────────────────────────────────────────────────
  const handleSignOut = async () => {
    setLoadingSignOut(true);
    try {
      await signOut();
      // No navigation.navigate() needed — AppNavigator's onAuthStateChanged
      // will detect the sign-out and automatically switch to LoginScreen.
    } catch (e: unknown) {
      console.error('Sign out failed:', e);
      setLoadingSignOut(false);
    }
  };

  // ── Header buttons ───────────────────────────────────────────────────────
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerRight}>
          <Pressable
            onPress={() => navigation.navigate('CreateEvent', { userId })}
            style={styles.headerBtn}
            hitSlop={8}
          >
            <Text style={styles.headerBtnPlus}>+</Text>
          </Pressable>

          <Pressable
            onPress={handleSignOut}
            style={styles.headerBtn}
            disabled={loadingSignOut}
            hitSlop={8}
          >
            {loadingSignOut ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.headerBtnText}>Sign Out</Text>
            )}
          </Pressable>
        </View>
      ),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, loadingSignOut]);

  // ── Loading state ────────────────────────────────────────────────────────
  if (loadingData) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4A90D9" />
      </View>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────────
  if (fetchError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{fetchError}</Text>
        <Pressable onPress={fetchEvents} style={styles.retryBtn}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  // ── Event card ───────────────────────────────────────────────────────────
  const renderCard = ({ item }: { item: EventSummary }) => {
    const spotsLeft = item.capacity - item.signup_count;
    return (
      <Pressable
        onPress={() => navigation.navigate('EventDetail', { eventId: item.id })}
        style={styles.card}
      >
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardMeta}>
          {item.date} · {item.time}
        </Text>
        <Text style={styles.cardMeta}>{item.location}</Text>
        <View style={styles.cardFooter}>
          <Text style={styles.signupCount}>
            {item.signup_count} signed up
          </Text>
          <Text style={[styles.spotsLeft, spotsLeft <= 3 && styles.spotsLow]}>
            {spotsLeft} {spotsLeft === 1 ? 'spot' : 'spots'} left
          </Text>
        </View>
      </Pressable>
    );
  };

  // ── List ─────────────────────────────────────────────────────────────────
  return (
    <FlatList
      data={events}
      keyExtractor={(e) => e.id}
      renderItem={renderCard}
      contentContainerStyle={styles.list}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No events yet</Text>
          <Text style={styles.emptyHint}>Tap + to create your first event</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  /* Header */
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: 4 },
  headerBtn: { paddingHorizontal: 8, paddingVertical: 2 },
  headerBtnPlus: { color: '#fff', fontSize: 28, fontWeight: 'bold', lineHeight: 32 },
  headerBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  /* Centered states */
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: 16, color: '#FF3B30', textAlign: 'center', marginBottom: 16, paddingHorizontal: 32 },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#4A90D9' },
  retryText: { color: '#4A90D9', fontSize: 16, fontWeight: '600' },

  /* List */
  list: { padding: 16, paddingBottom: 40 },

  /* Card */
  card: {
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 6 },
  cardMeta:  { fontSize: 14, color: '#666', marginBottom: 2 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  signupCount: { fontSize: 13, fontWeight: '600', color: '#4A90D9' },
  spotsLeft:   { fontSize: 13, fontWeight: '600', color: '#666' },
  spotsLow:    { color: '#FF3B30' },

  /* Empty state */
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 80 },
  emptyText: { fontSize: 18, color: '#666', marginBottom: 4 },
  emptyHint: { fontSize: 14, color: '#999' },
});
