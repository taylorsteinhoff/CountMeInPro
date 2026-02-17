import { useState } from 'react';
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
import { createEvent } from '../services/events';

type CreateEventRoute = RouteProp<RootStackParamList, 'CreateEvent'>;

interface SlotRow {
  id: string;
  name: string;
  quantity: string;
}

let nextSlotId = 1;
function makeSlot(): SlotRow {
  return { id: String(nextSlotId++), name: '', quantity: '1' };
}

export default function CreateEventScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { params } = useRoute<CreateEventRoute>();
  const { userId } = params;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [capacity, setCapacity] = useState('');
  const [slots, setSlots] = useState<SlotRow[]>([makeSlot()]);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  // Tracks whether the user has tried to save at least once, so we know
  // when to start showing validation errors.
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const addSlot = () => setSlots((prev) => [...prev, makeSlot()]);

  const removeSlot = (id: string) =>
    setSlots((prev) => prev.filter((s) => s.id !== id));

  const updateSlot = (id: string, field: 'name' | 'quantity', value: string) =>
    setSlots((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)),
    );

  // ── Derived validation ────────────────────────────────────────────────────
  const titleError = !title.trim()
    ? 'Event title is required.'
    : title.trim().length < 3
    ? 'Event title must be at least 3 characters long.'
    : '';

  const parsedCapacity = parseInt(capacity, 10);
  const capacityError = !capacity.trim()
    ? 'Capacity is required.'
    : isNaN(parsedCapacity) || parsedCapacity <= 0
    ? 'Capacity must be a positive number (e.g. 20).'
    : '';

  const slotsError = !slots.some((s) => s.name.trim())
    ? 'At least one slot must have a name.'
    : '';

  // Collect all active validation errors into one list.
  const validationErrors = [titleError, capacityError, slotsError].filter(Boolean);
  const isFormValid = validationErrors.length === 0;

  const handleSave = async () => {
    setSubmitAttempted(true);

    if (!isFormValid) return;

    setApiError('');
    setLoading(true);

    try {
      await createEvent(userId, {
        title: title.trim(),
        description: description.trim() || undefined,
        date: date.trim(),
        time: time.trim(),
        location: location.trim() || undefined,
        capacity: parsedCapacity,
        slots: slots.map((s) => ({
          name: s.name.trim(),
          quantity: parseInt(s.quantity, 10) || 1,
        })),
      });
      navigation.goBack();
    } catch (e: unknown) {
      setApiError(e instanceof Error ? e.message : 'Failed to save event.');
    } finally {
      setLoading(false);
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
        {/* Event Title */}
        <Text style={styles.label}>Event Title *</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. PTA Bake Sale"
          placeholderTextColor="#999"
        />

        {/* Description */}
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={description}
          onChangeText={setDescription}
          placeholder="What is this event about?"
          placeholderTextColor="#999"
          multiline
          numberOfLines={3}
        />

        {/* Date */}
        <Text style={styles.label}>Date</Text>
        <TextInput
          style={styles.input}
          value={date}
          onChangeText={setDate}
          placeholder="March 15, 2026"
          placeholderTextColor="#999"
        />

        {/* Time */}
        <Text style={styles.label}>Time</Text>
        <TextInput
          style={styles.input}
          value={time}
          onChangeText={setTime}
          placeholder="10:00 AM"
          placeholderTextColor="#999"
        />

        {/* Location */}
        <Text style={styles.label}>Location</Text>
        <TextInput
          style={styles.input}
          value={location}
          onChangeText={setLocation}
          placeholder="e.g. Lincoln Elementary Gym"
          placeholderTextColor="#999"
        />

        {/* Capacity */}
        <Text style={styles.label}>Capacity Limit</Text>
        <TextInput
          style={styles.input}
          value={capacity}
          onChangeText={setCapacity}
          placeholder="e.g. 20"
          placeholderTextColor="#999"
          keyboardType="number-pad"
        />

        {/* Signup Slots */}
        <Text style={styles.sectionTitle}>Signup Slots</Text>

        {slots.map((slot) => (
          <View key={slot.id} style={styles.slotRow}>
            <TextInput
              style={styles.slotName}
              value={slot.name}
              onChangeText={(v) => updateSlot(slot.id, 'name', v)}
              placeholder="Slot name"
              placeholderTextColor="#999"
            />
            <TextInput
              style={styles.slotQty}
              value={slot.quantity}
              onChangeText={(v) => updateSlot(slot.id, 'quantity', v)}
              placeholder="Qty"
              placeholderTextColor="#999"
              keyboardType="number-pad"
            />
            <Pressable
              onPress={() => removeSlot(slot.id)}
              style={styles.removeBtn}
            >
              <Text style={styles.removeBtnText}>X</Text>
            </Pressable>
          </View>
        ))}

        <Pressable onPress={addSlot} style={styles.addSlotBtn}>
          <Text style={styles.addSlotText}>+ Add Slot</Text>
        </Pressable>

        {/* Validation errors (shown after first save attempt) */}
        {submitAttempted && validationErrors.length > 0 ? (
          <View style={styles.validationBox}>
            {validationErrors.map((err, i) => (
              <Text key={i} style={styles.validationItem}>• {err}</Text>
            ))}
          </View>
        ) : null}

        {/* API-level error */}
        {apiError ? <Text style={styles.errorText}>{apiError}</Text> : null}

        {/* Save */}
        <Pressable
          onPress={handleSave}
          style={({ pressed }) => [
            styles.saveBtn,
            loading && styles.saveBtnDisabled,
            pressed && !loading && styles.saveBtnPressed,
          ]}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>Save Event</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F9F9F9' },
  content: { padding: 20, paddingBottom: 48 },
  label: { fontSize: 15, fontWeight: '600', color: '#374151', marginTop: 20, marginBottom: 6 },
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
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A2E',
    marginTop: 28,
    marginBottom: 10,
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  slotName: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1A1A2E',
    backgroundColor: '#fff',
  },
  slotQty: {
    width: 70,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1A1A2E',
    backgroundColor: '#fff',
    textAlign: 'center',
  },
  removeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF6B6B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  addSlotBtn: { marginTop: 6, marginBottom: 24, paddingVertical: 10 },
  addSlotText: { color: '#4A90D9', fontSize: 16, fontWeight: '600' },

  /* Validation error block above the save button */
  validationBox: {
    backgroundColor: '#FFF0F0',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  validationItem: { color: '#D93025', fontSize: 14, marginBottom: 4 },

  /* API-level error */
  errorText: { color: '#FF6B6B', fontSize: 15, marginBottom: 12 },

  saveBtn: {
    backgroundColor: '#4A90D9',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnPressed: { opacity: 0.88 },
  saveBtnText: { color: '#fff', fontSize: 19, fontWeight: '700' },
});
