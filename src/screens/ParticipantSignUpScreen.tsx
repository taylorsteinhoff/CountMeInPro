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
import { isValidEmail, isValidPhone } from '../utils/validation';

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
  const [notes, setNotes] = useState('');
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState('');
    const [apiError, setApiError] = useState('');
  const [submitAttempted, setSubmitAttempted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getEventDetail(params.eventId);
        if (!cancelled) setEvent(data);
      } catch (e: unknown) {
        if (!cancelled)
          setLoadError(e instanceof Error ? e.message : 'Failed to load event.');
      } finally {
        if (!cancelled) setLoadingEvent(false);
      }
    })();
    return () => { cancelled = true; };
  }, [params.eventId]);

  if (loadingEvent) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFoundText}>{loadError || 'Event not found'}</Text>
      </View>
    );
  }

  if (submitted) {
    const slotNames = event.slots
      .filter((s) => selectedSlotIds.includes(s.id))
      .map((s) => s.name);
    return (
      <View style={styles.centered}>
        <Text style={styles.checkmark}>✓</Text>
        <Text style={styles.confirmTitle}>You're signed up!</Text>
        <Text style={styles.confirmDetail}>
          {name}, you've been added to{' '}
          <Text style={styles.bold}>{event.title}</Text>
          {slotNames.length > 0 ? ` for: ${slotNames.join(', ')}` : ''}.
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

  const toggleSlot = (slotId: string) => {
    setSelectedSlotIds((prev) =>
      prev.includes(slotId)
        ? prev.filter((id) => id !== slotId)
        : [...prev, slotId]
    );
  };

  const nameError = !name.trim()
    ? 'Your name is required.'
    : name.trim().length < 2
    ? 'Name must be at least 2 characters.'
    : '';

  const emailError = !email.trim()
    ? 'Email is required.'
    : !isValidEmail(email)
    ? 'Email must include an @ symbol.'
    : '';

  const phoneError = phone.trim() && !isValidPhone(phone)
    ? 'Phone number must have at least 10 digits.'
    : '';

  const slotError = selectedSlotIds.length === 0 ? 'Please select at least one slot.' : '';

  const isFormValid = !nameError && !emailError && !phoneError && !slotError;

  const handleSubmit = async () => {
    setSubmitAttempted(true);
    if (!isFormValid) return;
    setApiError('');
    setSubmitting(true);
    try {
      const participant = await addParticipant(name.trim(), email.trim(), phone.trim() || undefined);
      for (const slotId of selectedSlotIds) {
        await addSignup(params.eventId, participant.id, slotId, notes.trim());
      }
      setSubmitted(true);
    } catch (e: unknown) {
      setApiError(e instanceof Error ? e.message : 'Signup failed. Please try again.');
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
        <Text style={styles.eventName}>{event.title}</Text>
        <Text style={styles.eventMeta}>
          {event.date} · {event.time} · {event.location}
        </Text>

        <Text style={styles.label}>Name *</Text>
        <TextInput
          style={[styles.input, submitAttempted && nameError ? styles.inputInvalid : null]}
          value={name}
          onChangeText={setName}
          placeholder="Your full name"
          placeholderTextColor="#999"
          autoCapitalize="words"
        />
        {submitAttempted && nameError ? (
          <Text style={styles.fieldError}>{nameError}</Text>
        ) : null}

        <Text style={styles.label}>Email *</Text>
        <TextInput
          style={[styles.input, submitAttempted && emailError ? styles.inputInvalid : null]}
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor="#999"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        {submitAttempted && emailError ? (
          <Text style={styles.fieldError}>{emailError}</Text>
        ) : null}

        <Text style={styles.label}>Phone (optional)</Text>
        <TextInput
          style={[styles.input, submitAttempted && phoneError ? styles.inputInvalid : null]}
          value={phone}
          onChangeText={setPhone}
          placeholder="555-0123"
          placeholderTextColor="#999"
          keyboardType="phone-pad"
        />
        {submitAttempted && phoneError ? (
          <Text style={styles.fieldError}>{phoneError}</Text>
        ) : null}
        <Text style={styles.label}>Notes (optional)</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Any notes or special requests..."
          placeholderTextColor="#999"
          multiline
          numberOfLines={3}
        />

        <Text style={styles.sectionTitle}>Select Slots * (tap to select multiple)</Text>
        {event.slots.map((slot) => {
          const slotSignups = event.signups.filter((s) => s.slot_id === slot.id);
          const spotsLeft = slot.quantity - slotSignups.length;
          const isFull = spotsLeft <= 0;
          const selected = selectedSlotIds.includes(slot.id);
          return (
            <Pressable
              key={slot.id}
              onPress={() => !isFull && toggleSlot(slot.id)}
              disabled={isFull}
              style={({ pressed }) => [
                styles.slotOption,
                selected && styles.slotOptionSelected,
                isFull && styles.slotOptionFull,
                pressed && !isFull && styles.slotOptionPressed,
              ]}
            >
              <View style={[styles.checkbox, selected && styles.checkboxSelected, isFull && styles.checkboxFull]}>
                {selected && <Text style={styles.checkboxCheck}>✓</Text>}
              </View>
              <View style={styles.slotInfo}>
                <Text style={[styles.slotName, isFull && styles.slotNameFull]}>{slot.name}</Text>
                <Text style={[styles.slotQty, isFull && styles.slotQtyFull]}>
                  {isFull ? 'Full' : `${spotsLeft} of ${slot.quantity} spots available`}
                </Text>
              </View>
            </Pressable>
          );
        })}

        {submitAttempted && slotError ? (
          <Text style={styles.fieldError}>{slotError}</Text>
        ) : null}

        {apiError ? <Text style={styles.errorText}>{apiError}</Text> : null}

        <Pressable
          onPress={handleSubmit}
          style={({ pressed }) => [styles.solidBtn, pressed && !submitting && styles.solidBtnPressed]}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.solidBtnText}>
              Sign Up{selectedSlotIds.length > 1 ? ` for ${selectedSlotIds.length} Slots` : ''}
            </Text>
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
  eventName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A1A2E',
    marginBottom: 6,
  },
  eventMeta: { fontSize: 15, color: '#6B7280', marginBottom: 20, lineHeight: 22 },
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
  inputInvalid: { borderColor: '#FF6B6B' },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  fieldError: { color: '#FF6B6B', fontSize: 13, marginTop: 4, marginBottom: 4 },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A2E',
    marginTop: 28,
    marginBottom: 12,
  },
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
  slotOptionSelected: { borderColor: '#7C3AED', backgroundColor: '#F5F0FF', borderWidth: 1.5 },
  slotOptionFull: { opacity: 0.5, backgroundColor: '#F9FAFB' },
  slotOptionPressed: { opacity: 0.85 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  checkboxSelected: { borderColor: '#7C3AED', backgroundColor: '#7C3AED' },
  checkboxCheck: { color: '#fff', fontSize: 14, fontWeight: '700' },
  checkboxFull: { borderColor: '#D1D5DB' },
  slotInfo: { flex: 1 },
  slotName: { fontSize: 17, color: '#1A1A2E', fontWeight: '500' },
  slotNameFull: { color: '#9CA3AF' },
  slotQty: { fontSize: 14, color: '#6B7280', marginTop: 3 },
  slotQtyFull: { color: '#EF4444' },
  errorText: { color: '#FF6B6B', fontSize: 15, marginTop: 16 },
  solidBtn: {
    backgroundColor: '#7C3AED',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 28,
  },
  solidBtnPressed: { opacity: 0.88 },
  solidBtnText: { color: '#fff', fontSize: 19, fontWeight: '700' },
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