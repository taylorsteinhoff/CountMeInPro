import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { getEventDetail, type EventDetail } from '../services/events';
import { addParticipant, addSignup } from '../services/signups';

type SignUpRoute = RouteProp<RootStackParamList, 'ParticipantSignUp'>;

export default function ParticipantSignUpScreen() {
  const { params } = useRoute<SignUpRoute>();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
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
        if (!cancelled) setLoadingEvent(false);
      }
    })();
    return () => { cancelled = true; };
  }, [params.eventId]);

  if (loadingEvent) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4A90D9" />
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFoundText}>{error || 'Event not found'}</Text>
      </View>
    );
  }

  if (submitted) {
    const slotName = event.slots.find((s) => s.id === selectedSlotId)?.name;
    return (
      <View style={styles.centered}>
        <Text style={styles.checkmark}>✓</Text>
        <Text style={styles.confirmTitle}>You're signed up!</Text>
        <Text style={styles.confirmDetail}>
          {name}, you've been added to{' '}
          <Text style={styles.bold}>{event.title}</Text>
          {slotName ? ` for "${slotName}"` : ''}.
        </Text>
        <Text style={styles.confirmSub}>
          {event.date} · {event.time}
        </Text>
        <Text style={styles.confirmSub}>{event.location}</Text>

        <Pressable
          onPress={() => navigation.popToTop()}
          style={({ pressed }) => [styles.solidBtn, pressed && styles.solidBtnPressed]}
        >
          <Text style={styles.solidBtnText}>Back to Events</Text>
        </Pressable>
      </View>
    );
  }

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName || !trimmedEmail) {
      setError('Name and email are required.');
      return;
    }

    if (!selectedSlotId) {
      setError('Please select a signup slot.');
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      const participant = await addParticipant(trimmedName, trimmedEmail, phone.trim() || undefined);
      await addSignup(params.eventId, participant.id, selectedSlotId);
      setSubmitted(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Signup failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Event context */}
        <Text style={styles.eventName}>{event.title}</Text>
        <Text style={styles.eventMeta}>
          {event.date} · {event.time} · {event.location}
        </Text>

        {/* Name */}
        <Text style={styles.label}>Name *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Your full name"
          placeholderTextColor="#999"
          autoCapitalize="words"
        />

        {/* Email */}
        <Text style={styles.label}>Email *</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor="#999"
          keyboardType="email-address"
          autoCapitalize="none"
        />

        {/* Phone (optional) */}
        <Text style={styles.label}>Phone (optional)</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="555-0123"
          placeholderTextColor="#999"
          keyboardType="phone-pad"
        />

        {/* Slot selection */}
        <Text style={styles.sectionTitle}>Select a Slot *</Text>
        {event.slots.map((slot) => {
          const selected = selectedSlotId === slot.id;
          return (
            <Pressable
              key={slot.id}
              onPress={() => setSelectedSlotId(slot.id)}
              style={({ pressed }) => [styles.slotOption, selected && styles.slotOptionSelected, pressed && styles.slotOptionPressed]}
            >
              <View style={[styles.radio, selected && styles.radioSelected]}>
                {selected && <View style={styles.radioDot} />}
              </View>
              <View style={styles.slotInfo}>
                <Text style={styles.slotName}>{slot.name}</Text>
                <Text style={styles.slotQty}>
                  {slot.quantity} {slot.quantity === 1 ? 'spot' : 'spots'}
                </Text>
              </View>
            </Pressable>
          );
        })}

        {/* Error message */}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* Submit */}
        <Pressable onPress={handleSubmit} style={({ pressed }) => [styles.solidBtn, pressed && !submitting && styles.solidBtnPressed]} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.solidBtnText}>Sign Up</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F9F9F9' },
  content: { padding: 20, paddingBottom: 48 },
  centered: {
    flex: 1,
    backgroundColor: '#F9F9F9',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  notFoundText: { fontSize: 18, color: '#6B7280' },

  /* Event header */
  eventName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A1A2E',
    marginBottom: 6,
  },
  eventMeta: { fontSize: 15, color: '#6B7280', marginBottom: 20, lineHeight: 22 },

  /* Form */
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    marginTop: 20,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1A1A2E',
    backgroundColor: '#fff',
    minHeight: 50,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A2E',
    marginTop: 28,
    marginBottom: 12,
  },

  /* Slot picker */
  slotOption: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  slotOptionSelected: { borderColor: '#4A90D9', backgroundColor: '#EEF4FF', borderWidth: 1.5 },
  slotOptionPressed: { opacity: 0.85 },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  radioSelected: { borderColor: '#4A90D9' },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4A90D9',
  },
  slotInfo: { flex: 1 },
  slotName: { fontSize: 17, color: '#1A1A2E', fontWeight: '500' },
  slotQty: { fontSize: 14, color: '#6B7280', marginTop: 3 },

  /* Error */
  errorText: { color: '#FF6B6B', fontSize: 15, marginTop: 16 },

  /* Buttons */
  solidBtn: {
    backgroundColor: '#4A90D9',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 28,
  },
  solidBtnPressed: { opacity: 0.88 },
  solidBtnText: { color: '#fff', fontSize: 19, fontWeight: '700' },

  /* Confirmation */
  checkmark: { fontSize: 64, color: '#34C759', marginBottom: 20 },
  confirmTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1A1A2E',
    marginBottom: 14,
    textAlign: 'center',
  },
  confirmDetail: { fontSize: 17, color: '#374151', textAlign: 'center', marginBottom: 10, lineHeight: 26 },
  confirmSub: { fontSize: 15, color: '#6B7280', marginBottom: 4 },
  bold: { fontWeight: '700' },
});
