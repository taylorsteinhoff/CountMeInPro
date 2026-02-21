import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { createEvent } from '../services/events';
import { supabase } from '../services/supabase';

// Format YYYY-MM-DD → "March 15, 2026" for display
function formatDateDisplay(iso: string): string {
  if (!iso) return '';
  const [year, month, day] = iso.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

type CreateEventRoute = RouteProp<RootStackParamList, 'CreateEvent'>;

interface SlotRow {
  id: string;
  name: string;
  quantity: string;
}

let nextSlotId = 1;
function makeSlot(name = '', quantity = '1'): SlotRow {
  return { id: String(nextSlotId++), name, quantity };
}

async function fetchSlotSuggestions(title: string, description: string): Promise<string[]> {
  // Calls the Supabase Edge Function, which holds the Anthropic API key
  // securely in server-side secrets — never exposed to the client.
  const { data, error } = await supabase.functions.invoke('suggest-slots', {
    body: { eventTitle: title, eventDescription: description },
  });

  if (error) throw new Error('AI suggestions unavailable right now.');

  const suggestions = data?.suggestions;
  if (!Array.isArray(suggestions)) throw new Error('Could not parse suggestions.');
  return suggestions as string[];
}

export default function CreateEventScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { params } = useRoute<CreateEventRoute>();
  const { userId, prefill } = params;

  const [title, setTitle] = useState(prefill?.title ?? '');
  const [description, setDescription] = useState(prefill?.description ?? '');
  const [date, setDate] = useState(''); // always empty — user must pick a new date
  const [time, setTime] = useState(prefill?.time ?? '');
  const [location, setLocation] = useState(prefill?.location ?? '');
  const [capacity, setCapacity] = useState(prefill?.capacity ?? '');
  const [slots, setSlots] = useState<SlotRow[]>(
    prefill?.slots && prefill.slots.length > 0
      ? prefill.slots.map((s) => makeSlot(s.name, s.quantity))
      : [makeSlot()],
  );
  const [recurrence, setRecurrence] = useState<'none' | 'weekly' | 'biweekly' | 'monthly'>('none');
  const [recurrenceCount, setRecurrenceCount] = useState('4');
  const [showCalendar, setShowCalendar] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState('');

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

  const addSuggestedSlot = (name: string) => {
    // If the only slot is blank, fill it instead of adding a new one.
    setSlots((prev) => {
      const hasBlank = prev.length === 1 && !prev[0].name.trim();
      if (hasBlank) return [{ ...prev[0], name }];
      return [...prev, makeSlot(name)];
    });
    // Remove from suggestions list so it can't be added twice.
    setSuggestions((prev) => prev.filter((s) => s !== name));
  };

  const handleGetSuggestions = async () => {
    if (!title.trim()) {
      setSuggestionsError('Enter an event title first so AI knows what to suggest.');
      return;
    }
    setSuggestionsError('');
    setSuggestions([]);
    setSuggestionsLoading(true);
    try {
      const results = await fetchSlotSuggestions(title.trim(), description.trim());
      setSuggestions(results);
    } catch (e: unknown) {
      setSuggestionsError(e instanceof Error ? e.message : 'Could not load suggestions.');
    } finally {
      setSuggestionsLoading(false);
    }
  };

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
      const { data: user } = await supabase.auth.getUser();
      if (!user.user?.id) throw new Error('Not authenticated');

      const count = recurrence === 'none' ? 1 : Math.min(Number(recurrenceCount) || 1, 52);
      let eventsCreated = 0;

      for (let i = 0; i < count; i++) {
        const startDate = new Date(date + 'T00:00:00Z');

        if (recurrence === 'weekly') {
          startDate.setDate(startDate.getDate() + (i * 7));
        } else if (recurrence === 'biweekly') {
          startDate.setDate(startDate.getDate() + (i * 14));
        } else if (recurrence === 'monthly') {
          startDate.setMonth(startDate.getMonth() + i);
        }

        const eventDate = startDate.toISOString().split('T')[0];

        const { data: newEvent, error: eventError } = await supabase
          .from('events')
          .insert({
            user_id: user.user.id,
            title: count > 1
              ? `${title.trim()} (${i + 1}/${count})`
              : title.trim(),
            description: description.trim() || null,
            date: eventDate,
            time: time.trim(),
            location: location.trim() || null,
            capacity: parsedCapacity,
          })
          .select()
          .single();

        if (eventError) throw eventError;

        const validSlots = slots.filter((s) => s.name.trim());
        if (validSlots.length > 0) {
          const newSlots = validSlots.map((s) => ({
            event_id: newEvent.id,
            name: s.name.trim(),
            quantity: parseInt(s.quantity, 10) || 1,
          }));
          await supabase.from('signup_slots').insert(newSlots);
        }

        eventsCreated++;
      }

      Alert.alert(
        'Success',
        eventsCreated === 1
          ? 'Event created successfully!'
          : `${eventsCreated} recurring events created!`,
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (e: unknown) {
      setApiError(e instanceof Error ? e.message : 'Failed to create event.');
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

        {/* AI Suggestions button */}
        <Pressable
          onPress={handleGetSuggestions}
          disabled={suggestionsLoading}
          style={({ pressed }) => [styles.aiBtn, pressed && styles.aiBtnPressed]}
        >
          {suggestionsLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.aiBtnText}>✨ Get AI Slot Suggestions</Text>
          )}
        </Pressable>
        {suggestionsError ? (
          <Text style={styles.suggestionsError}>{suggestionsError}</Text>
        ) : null}

        {/* Suggestions panel */}
        {suggestions.length > 0 ? (
          <View style={styles.suggestionsPanel}>
            <Text style={styles.suggestionsPanelTitle}>AI Suggestions — tap + to add</Text>
            {suggestions.map((s) => (
              <View key={s} style={styles.suggestionRow}>
                <Text style={styles.suggestionText}>{s}</Text>
                <Pressable
                  onPress={() => addSuggestedSlot(s)}
                  style={({ pressed }) => [styles.addSuggBtn, pressed && styles.addSuggBtnPressed]}
                >
                  <Text style={styles.addSuggBtnText}>+ Add</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        {/* Date */}
        <Text style={styles.label}>Date</Text>
        <Pressable
          style={({ pressed }) => [styles.input, styles.datePicker, pressed && styles.datePickerPressed]}
          onPress={() => setShowCalendar(true)}
        >
          <Text style={date ? styles.dateText : styles.datePlaceholder}>
            {date ? formatDateDisplay(date) : 'Tap to select a date'}
          </Text>
          <Text style={styles.calendarIcon}>📅</Text>
        </Pressable>

        {/* Calendar Modal */}
        <Modal
          visible={showCalendar}
          transparent
          animationType="fade"
          onRequestClose={() => setShowCalendar(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setShowCalendar(false)}>
            <Pressable style={styles.modalCard} onPress={() => {}}>
              <Text style={styles.modalTitle}>Select a Date</Text>
              <Calendar
                current={date || undefined}
                onDayPress={(day: { dateString: string }) => {
                  setDate(day.dateString);
                  setShowCalendar(false);
                }}
                markedDates={
                  date ? { [date]: { selected: true, selectedColor: '#4A90D9' } } : {}
                }
                theme={{
                  backgroundColor: '#fff',
                  calendarBackground: '#fff',
                  todayTextColor: '#4A90D9',
                  selectedDayBackgroundColor: '#4A90D9',
                  selectedDayTextColor: '#fff',
                  arrowColor: '#4A90D9',
                  monthTextColor: '#1A1A2E',
                  textMonthFontWeight: '700',
                  textMonthFontSize: 16,
                  dayTextColor: '#374151',
                  textDayFontSize: 15,
                  textDayHeaderFontSize: 13,
                  textDayHeaderFontWeight: '600',
                  dotColor: '#4A90D9',
                }}
              />
              <Pressable style={styles.modalClose} onPress={() => setShowCalendar(false)}>
                <Text style={styles.modalCloseText}>Done</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>

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

        {/* Recurrence Options */}
        <Text style={styles.label}>Repeat Event</Text>
        <View style={styles.recurrenceContainer}>
          {(['none', 'weekly', 'biweekly', 'monthly'] as const).map((option) => (
            <TouchableOpacity
              key={option}
              style={[
                styles.recurrenceOption,
                recurrence === option && styles.recurrenceOptionSelected,
              ]}
              onPress={() => setRecurrence(option)}
            >
              <Text
                style={[
                  styles.recurrenceOptionText,
                  recurrence === option && styles.recurrenceOptionTextSelected,
                ]}
              >
                {option === 'none' ? 'One-time' : option === 'biweekly' ? 'Every 2 weeks' : option.charAt(0).toUpperCase() + option.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {recurrence !== 'none' && (
          <View style={styles.recurrenceCountContainer}>
            <Text style={styles.label}>How many times?</Text>
            <TextInput
              style={styles.recurrenceCountInput}
              value={recurrenceCount}
              onChangeText={setRecurrenceCount}
              keyboardType="number-pad"
              placeholder="4"
            />
            <Text style={styles.recurrencePreview}>
              Creates {recurrenceCount || '0'} events ({recurrence === 'weekly' ? 'every week' : recurrence === 'biweekly' ? 'every 2 weeks' : 'every month'})
            </Text>
          </View>
        )}

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

  /* Date picker button */
  datePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  datePickerPressed: { opacity: 0.75 },
  dateText: { fontSize: 16, color: '#1A1A2E' },
  datePlaceholder: { fontSize: 16, color: '#999' },
  calendarIcon: { fontSize: 20 },

  /* Calendar modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalClose: {
    marginTop: 16,
    backgroundColor: '#4A90D9',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalCloseText: { color: '#fff', fontSize: 16, fontWeight: '700' },
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

  /* AI suggestions button */
  aiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7C3AED',
    borderRadius: 12,
    paddingVertical: 13,
    marginTop: 10,
  },
  aiBtnPressed: { opacity: 0.85 },
  aiBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  suggestionsError: { color: '#FF6B6B', fontSize: 13, marginTop: 6 },

  /* Suggestions panel */
  suggestionsPanel: {
    backgroundColor: '#F5F0FF',
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  suggestionsPanelTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7C3AED',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#EDE9FE',
  },
  suggestionText: { flex: 1, fontSize: 15, color: '#1A1A2E', marginRight: 10 },
  addSuggBtn: {
    backgroundColor: '#7C3AED',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addSuggBtnPressed: { opacity: 0.8 },
  addSuggBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  recurrenceContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  recurrenceOption: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  recurrenceOptionSelected: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  recurrenceOptionText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  recurrenceOptionTextSelected: {
    color: '#FFFFFF',
  },
  recurrenceCountContainer: {
    backgroundColor: '#F3E8FF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  recurrenceCountInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    color: '#1A1A2E',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    width: 80,
    marginVertical: 8,
  },
  recurrencePreview: {
    fontSize: 13,
    color: '#6B21A8',
    fontStyle: 'italic',
  },
});
