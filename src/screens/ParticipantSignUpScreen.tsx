import { useState } from 'react';
import {
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
import { dummyEvents } from '../data/dummyData';

type SignUpRoute = RouteProp<RootStackParamList, 'ParticipantSignUp'>;

export default function ParticipantSignUpScreen() {
  const { params } = useRoute<SignUpRoute>();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const event = dummyEvents.find((e) => e.id === params.eventId);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  if (!event) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFoundText}>Event not found</Text>
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
          onPress={() => navigation.navigate('HomeDashboard')}
          style={styles.solidBtn}
        >
          <Text style={styles.solidBtnText}>Back to Events</Text>
        </Pressable>
      </View>
    );
  }

  const handleSubmit = () => {
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

    // Milestone 1: no persistence, just show confirmation
    setError('');
    setSubmitted(true);
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
              style={[styles.slotOption, selected && styles.slotOptionSelected]}
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
        <Pressable onPress={handleSubmit} style={styles.solidBtn}>
          <Text style={styles.solidBtnText}>Sign Up</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, paddingBottom: 40 },
  centered: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  notFoundText: { fontSize: 18, color: '#666' },

  /* Event header */
  eventName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  eventMeta: { fontSize: 14, color: '#666', marginBottom: 16 },

  /* Form */
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 24,
    marginBottom: 8,
  },

  /* Slot picker */
  slotOption: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: 8,
    padding: 14,
    marginBottom: 8,
  },
  slotOptionSelected: { borderColor: '#4A90D9', backgroundColor: '#F0F6FF' },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#CCC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  radioSelected: { borderColor: '#4A90D9' },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4A90D9',
  },
  slotInfo: { flex: 1 },
  slotName: { fontSize: 16, color: '#333' },
  slotQty: { fontSize: 13, color: '#666', marginTop: 2 },

  /* Error */
  errorText: { color: '#FF3B30', fontSize: 14, marginTop: 16 },

  /* Buttons */
  solidBtn: {
    backgroundColor: '#4A90D9',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  solidBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },

  /* Confirmation */
  checkmark: { fontSize: 48, color: '#34C759', marginBottom: 16 },
  confirmTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  confirmDetail: { fontSize: 16, color: '#333', textAlign: 'center', marginBottom: 8 },
  confirmSub: { fontSize: 14, color: '#666', marginBottom: 2 },
  bold: { fontWeight: 'bold' },
});
