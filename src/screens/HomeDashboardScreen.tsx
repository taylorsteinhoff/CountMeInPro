import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SectionList,
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

function getTodayStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function HomeDashboardScreen() {
  const navigation        = useNavigation<Nav>();
  const { params }        = useRoute<Route>();
  const { userId }        = params;

  const [events, setEvents]       = useState<EventSummary[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingSignOut, setLoadingSignOut] = useState(false);
  const [fetchError, setFetchError] = useState('');

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

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useFocusEffect(
    useCallback(() => {
      fetchEvents();
    }, [fetchEvents]),
  );

  const handleSignOut = async () => {
    setLoadingSignOut(true);
    try {
      await signOut();
    } catch (e: unknown) {
      console.error('Sign out failed:', e);
      setLoadingSignOut(false);
    }
  };

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
  }, [navigation, loadingSignOut]);

  if (loadingData) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

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

  const today = getTodayStr();
  const upcoming = events.filter((e) => e.date >= today);
  const past = events.filter((e) => e.date < today);

  const sections = [];
  if (upcoming.length > 0) {
    sections.push({ title: 'Upcoming Events', data: upcoming });
  }
  if (past.length > 0) {
    sections.push({ title: 'Past Events', data: past });
  }
const renderCard = ({ item }: { item: EventSummary }) => {
    const isPast = item.date < today;
    const spotsLeft = item.capacity - item.signup_count;
    return (
      <Pressable
        onPress={() => navigation.navigate('EventDetail', { eventId: item.id })}
        style={({ pressed }) => [styles.card, isPast && styles.cardPast, pressed && styles.cardPressed]}
      >
        <Text style={[styles.cardTitle, isPast && styles.cardTitlePast]}>{item.title}</Text>
        <Text style={styles.cardMeta}>
          {item.date} · {item.time}
        </Text>
        <Text style={styles.cardMeta}>{item.location}</Text>
        <View style={styles.cardFooter}>
          <Text style={[styles.signupCount, isPast && styles.signupCountPast]}>
            {item.signup_count} signed up
          </Text>
          {isPast ? (
            <Text style={styles.pastBadge}>Completed</Text>
          ) : (
            <Text style={[styles.spotsLeft, spotsLeft <= 3 && styles.spotsLow]}>
              {spotsLeft} {spotsLeft === 1 ? 'spot' : 'spots'} left
            </Text>
          )}
        </View>
      </Pressable>
    );
  };

  const renderSectionHeader = ({ section }: { section: { title: string } }) => (
    <Text style={[
      styles.sectionHeader,
      section.title === 'Past Events' && styles.sectionHeaderPast,
    ]}>
      {section.title}
    </Text>
  );

  if (sections.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No events yet</Text>
        <Text style={styles.emptyHint}>Tap + to create your first event</Text>
      </View>
    );
  }

  return (
    <SectionList
      sections={sections}
      keyExtractor={(e) => e.id}
      renderItem={renderCard}
      renderSectionHeader={renderSectionHeader}
      contentContainerStyle={styles.list}
      stickySectionHeadersEnabled={false}
    />
  );
}

const styles = StyleSheet.create({
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10, marginRight: 4 },
  headerBtn: { paddingHorizontal: 10, paddingVertical: 4 },
  headerBtnPlus: { color: '#fff', fontSize: 28, fontWeight: 'bold', lineHeight: 32 },
  headerBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9F9F9' },
  errorText: { fontSize: 16, color: '#FF6B6B', textAlign: 'center', marginBottom: 16, paddingHorizontal: 32 },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: '#7C3AED' },
  retryText: { color: '#7C3AED', fontSize: 16, fontWeight: '600' },
  list: { padding: 20, paddingBottom: 48, backgroundColor: '#F9F9F9' },
  sectionHeader: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A1A2E',
    marginBottom: 12,
    marginTop: 8,
  },
  sectionHeaderPast: {
    color: '#9CA3AF',
    marginTop: 28,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  card: {
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
  cardPast: {
    opacity: 0.65,
    backgroundColor: '#F9FAFB',
  },
  cardPressed: { opacity: 0.92 },
  cardTitle: { fontSize: 20, fontWeight: '700', color: '#1A1A2E', marginBottom: 6 },
  cardTitlePast: { color: '#6B7280' },
  cardMeta: { fontSize: 15, color: '#6B7280', marginBottom: 3 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  signupCount: { fontSize: 14, fontWeight: '600', color: '#7C3AED' },
  signupCountPast: { color: '#9CA3AF' },
  spotsLeft: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  spotsLow: { color: '#FF6B6B' },
  pastBadge: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9CA3AF',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 80, backgroundColor: '#F9F9F9' },
  emptyText: { fontSize: 20, fontWeight: '600', color: '#6B7280', marginBottom: 6 },
  emptyHint: { fontSize: 15, color: '#9CA3AF' },
});