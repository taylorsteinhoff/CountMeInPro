import { useLayoutEffect } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { dummyEvents, type Event } from '../data/dummyData';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function HomeDashboardScreen() {
  const navigation = useNavigation<Nav>();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => navigation.navigate('CreateEvent')}
          style={styles.headerBtn}
        >
          <Text style={styles.headerBtnText}>+</Text>
        </Pressable>
      ),
    });
  }, [navigation]);

  const renderCard = ({ item }: { item: Event }) => {
    const spotsLeft = item.capacity - item.signups.length;
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
            {item.signups.length} signed up
          </Text>
          <Text style={[styles.spotsLeft, spotsLeft <= 3 && styles.spotsLow]}>
            {spotsLeft} {spotsLeft === 1 ? 'spot' : 'spots'} left
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <FlatList
      data={dummyEvents}
      keyExtractor={(e) => e.id}
      renderItem={renderCard}
      contentContainerStyle={styles.list}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No events yet</Text>
          <Text style={styles.emptyHint}>
            Tap + to create your first event
          </Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  /* Header */
  headerBtn: { marginRight: 8, paddingHorizontal: 8, paddingVertical: 2 },
  headerBtnText: { color: '#fff', fontSize: 28, fontWeight: 'bold' },

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
  cardMeta: { fontSize: 14, color: '#666', marginBottom: 2 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  signupCount: { fontSize: 13, fontWeight: '600', color: '#4A90D9' },
  spotsLeft: { fontSize: 13, fontWeight: '600', color: '#666' },
  spotsLow: { color: '#FF3B30' },

  /* Empty state */
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 80 },
  emptyText: { fontSize: 18, color: '#666', marginBottom: 4 },
  emptyHint: { fontSize: 14, color: '#999' },
});
