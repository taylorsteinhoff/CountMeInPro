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

function formatDateDisplay(iso: string): string {
  if (!iso) return '';
  const [year, month, day] = iso.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatShortDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getDateRange(startIso: string, endIso: string): string[] {
  const dates: string[] = [];
  const current = new Date(startIso + 'T00:00:00');
  const end = new Date(endIso + 'T00:00:00');
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
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

export default function CreateEventScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { params } = useRoute<CreateEventRoute>();
  const { userId, prefill } = params;

  const [title, setTitle] = useState(prefill?.title ?? '');
  const [description, setDescription] = useState(prefill?.description ?? '');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [time, setTime] = useState(prefill?.time ?? '');
  const [location, setLocation] = useState(prefill?.location ?? '');
  const [slots, setSlots] = useState<SlotRow[]>(
    prefill?.slots && prefill.slots.length > 0
      ? prefill.slots.map((s) => makeSlot(s.name, s.quantity))
      : [makeSlot()],
  );

  const [recurrence, setRecurrence] = useState<'none' | 'weekly' | 'biweekly' | 'monthly'>('none');
  const [recurrenceCount, setRecurrenceCount] = useState('4');
  const [showCalendar, setShowCalendar] = useState(false);
  const [datePickerTarget, setDatePickerTarget] = useState<'start' | 'end'>('start');
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [submitAttempted, setSubmitAttempted] = useState(false);

  // Multi-day slot mode
  const [slotMode, setSlotMode] = useState<'same' | 'different'>('same');
  const [perDaySlots, setPerDaySlots] = useState<Record<string, SlotRow[]>>({});
  const [activeDayTab, setActiveDayTab] = useState('');

  const isMultiDay = startDate && endDate && startDate !== endDate;
  const eventDays = isMultiDay ? getDateRange(startDate, endDate) : [];

  // Initialize per-day slots when switching to "different" mode
  const handleSlotModeChange = (mode: 'same' | 'different') => {
    setSlotMode(mode);
    if (mode === 'different' && eventDays.length > 0) {
      const newPerDay: Record<string, SlotRow[]> = {};
      for (const day of eventDays) {
        if (!perDaySlots[day] || perDaySlots[day].length === 0) {
          newPerDay[day] = slots.map((s) => makeSlot(s.name, s.quantity));
        } else {
          newPerDay[day] = perDaySlots[day];
        }
      }
      setPerDaySlots(newPerDay);
      if (!activeDayTab || !eventDays.includes(activeDayTab)) {
        setActiveDayTab(eventDays[0]);
      }
    }
  };

  const addSlot = () => setSlots((prev) => [...prev, makeSlot()]);
  const removeSlot = (id: string) =>
    setSlots((prev) => prev.filter((s) => s.id !== id));
  const updateSlot = (id: string, field: 'name' | 'quantity', value: string) =>
    setSlots((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)),
    );

  const addDaySlot = (day: string) => {
    setPerDaySlots((prev) => ({
      ...prev,
      [day]: [...(prev[day] || []), makeSlot()],
    }));
  };
  const removeDaySlot = (day: string, id: string) => {
    setPerDaySlots((prev) => ({
      ...prev,
      [day]: (prev[day] || []).filter((s) => s.id !== id),
    }));
  };
  const updateDaySlot = (day: string, id: string, field: 'name' | 'quantity', value: string) => {
    setPerDaySlots((prev) => ({
      ...prev,
      [day]: (prev[day] || []).map((s) => (s.id === id ? { ...s, [field]: value } : s)),
    }));
  };

  const openDatePicker = (target: 'start' | 'end') => {
    setDatePickerTarget(target);
    setShowCalendar(true);
  };

  const handleDateSelect = (dateString: string) => {
    if (datePickerTarget === 'start') {
      setStartDate(dateString);
      if (!endDate || dateString > endDate) {
        setEndDate(dateString);
      }
    } else {
      setEndDate(dateString);
    }
    setShowCalendar(false);
  };

  const titleError = !title.trim()
    ? 'Event title is required.'
    : title.trim().length < 3
    ? 'Event title must be at least 3 characters long.'
    : '';

  const dateError = !startDate ? 'Start date is required.' : '';
  const endDateError = !endDate
    ? 'End date is required.'
    : endDate < startDate
    ? 'End date must be on or after start date.'
    : '';

  const slotsError = (() => {
    if (isMultiDay && slotMode === 'different') {
      for (const day of eventDays) {
        if (!(perDaySlots[day] || []).some((s) => s.name.trim())) {
          return `${formatShortDate(day)} needs at least one slot with a name.`;
        }
      }
      return '';
    }
    return !slots.some((s) => s.name.trim()) ? 'At least one slot must have a name.' : '';
  })();

  const validationErrors = [titleError, dateError, endDateError, slotsError].filter(Boolean);
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
        const baseStart = new Date(startDate + 'T00:00:00Z');
        const baseEnd = new Date(endDate + 'T00:00:00Z');
        if (recurrence === 'weekly') {
          baseStart.setDate(baseStart.getDate() + (i * 7));
          baseEnd.setDate(baseEnd.getDate() + (i * 7));
        } else if (recurrence === 'biweekly') {
          baseStart.setDate(baseStart.getDate() + (i * 14));
          baseEnd.setDate(baseEnd.getDate() + (i * 14));
        } else if (recurrence === 'monthly') {
          baseStart.setMonth(baseStart.getMonth() + i);
          baseEnd.setMonth(baseEnd.getMonth() + i);
        }
        const eventStartDate = baseStart.toISOString().split('T')[0];
        const eventEndDate = baseEnd.toISOString().split('T')[0];
        const { data: newEvent, error: eventError } = await supabase
          .from('events')
          .insert({
            user_id: user.user.id,
            title: count > 1
              ? `${title.trim()} (${i + 1}/${count})`
              : title.trim(),
            description: description.trim() || null,
            date: eventStartDate,
            end_date: eventEndDate,
            time: time.trim(),
            location: location.trim() || null,
            capacity: 0,
          })
          .select()
          .single();
        if (eventError) throw eventError;

        // Build slots based on mode
        const eventDates = getDateRange(eventStartDate, eventEndDate);
        const isMulti = eventDates.length > 1;
        const newSlots: Array<{ event_id: string; name: string; quantity: number }> = [];

        if (isMulti && slotMode === 'different') {
          // Different slots per day
          const origDays = getDateRange(startDate, endDate);
          for (let dayIdx = 0; dayIdx < eventDates.length; dayIdx++) {
            const origDay = origDays[dayIdx] || origDays[0];
            const daySlots = perDaySlots[origDay] || [];
            const validDaySlots = daySlots.filter((s) => s.name.trim());
            for (const s of validDaySlots) {
              newSlots.push({
                event_id: newEvent.id,
                name: `${s.name.trim()} (${formatShortDate(eventDates[dayIdx])})`,
                quantity: parseInt(s.quantity, 10) || 1,
              });
            }
          }
        } else if (isMulti) {
          // Same slots each day
          const validSlots = slots.filter((s) => s.name.trim());
          for (const slotDate of eventDates) {
            for (const s of validSlots) {
              newSlots.push({
                event_id: newEvent.id,
                name: `${s.name.trim()} (${formatShortDate(slotDate)})`,
                quantity: parseInt(s.quantity, 10) || 1,
              });
            }
          }
        } else {
          // Single day event
          const validSlots = slots.filter((s) => s.name.trim());
          for (const s of validSlots) {
            newSlots.push({
              event_id: newEvent.id,
              name: s.name.trim(),
              quantity: parseInt(s.quantity, 10) || 1,
            });
          }
        }

        if (newSlots.length > 0) {
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

  const getMarkedDates = () => {
    const marked: any = {};
    if (startDate && endDate && startDate !== endDate) {
      const dates = getDateRange(startDate, endDate);
      dates.forEach((d, index) => {
        marked[d] = {
          selected: true,
          color: index === 0 || index === dates.length - 1 ? '#7C3AED' : '#DDD6FE',
          textColor: index === 0 || index === dates.length - 1 ? '#fff' : '#7C3AED',
        };
      });
    } else if (startDate) {
      marked[startDate] = { selected: true, selectedColor: '#7C3AED' };
    }
    return marked;
  };

  // Render slot rows for a given array + callbacks
  const renderSlotRows = (
    slotList: SlotRow[],
    onUpdate: (id: string, field: 'name' | 'quantity', value: string) => void,
    onRemove: (id: string) => void,
    onAdd: () => void,
  ) => (
    <>
      {slotList.map((slot) => (
        <View key={slot.id} style={styles.slotRow}>
          <TextInput
            style={styles.slotName}
            value={slot.name}
            onChangeText={(v) => onUpdate(slot.id, 'name', v)}
            placeholder="Slot name"
            placeholderTextColor="#999"
          />
          <TextInput
            style={styles.slotQty}
            value={slot.quantity}
            onChangeText={(v) => onUpdate(slot.id, 'quantity', v)}
            placeholder="Qty"
            placeholderTextColor="#999"
            keyboardType="number-pad"
          />
          <Pressable onPress={() => onRemove(slot.id)} style={styles.removeBtn}>
            <Text style={styles.removeBtnText}>X</Text>
          </Pressable>
        </View>
      ))}
      <Pressable onPress={onAdd} style={styles.addSlotBtn}>
        <Text style={styles.addSlotText}>+ Add Slot</Text>
      </Pressable>
    </>
  );
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
        <Text style={styles.label}>Event Title *</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. PTA Bake Sale"
          placeholderTextColor="#999"
        />

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

        <Text style={styles.label}>Start Date *</Text>
        <Pressable
          style={({ pressed }) => [styles.input, styles.datePicker, pressed && styles.datePickerPressed]}
          onPress={() => openDatePicker('start')}
        >
          <Text style={startDate ? styles.dateText : styles.datePlaceholder}>
            {startDate ? formatDateDisplay(startDate) : 'Tap to select start date'}
          </Text>
          <Text style={styles.calendarIcon}>📅</Text>
        </Pressable>

        <Text style={styles.label}>End Date *</Text>
        <Pressable
          style={({ pressed }) => [styles.input, styles.datePicker, pressed && styles.datePickerPressed]}
          onPress={() => openDatePicker('end')}
        >
          <Text style={endDate ? styles.dateText : styles.datePlaceholder}>
            {endDate ? formatDateDisplay(endDate) : 'Tap to select end date'}
          </Text>
          <Text style={styles.calendarIcon}>📅</Text>
        </Pressable>

        {isMultiDay && (
          <View style={styles.multiDayBanner}>
            <Text style={styles.multiDayText}>
              Multi-day event: {formatShortDate(startDate)} - {formatShortDate(endDate)} ({eventDays.length} days)
            </Text>
          </View>
        )}

        <Modal
          visible={showCalendar}
          transparent
          animationType="fade"
          onRequestClose={() => setShowCalendar(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setShowCalendar(false)}>
            <Pressable style={styles.modalCard} onPress={() => {}}>
              <Text style={styles.modalTitle}>
                {datePickerTarget === 'start' ? 'Select Start Date' : 'Select End Date'}
              </Text>
              <Calendar
                current={datePickerTarget === 'start' ? (startDate || undefined) : (endDate || startDate || undefined)}
                minDate={datePickerTarget === 'end' ? startDate : undefined}
                onDayPress={(day: { dateString: string }) => {
                  handleDateSelect(day.dateString);
                }}
                markedDates={getMarkedDates()}
                markingType={startDate && endDate && startDate !== endDate ? 'period' : 'dot'}
                theme={{
                  backgroundColor: '#fff',
                  calendarBackground: '#fff',
                  todayTextColor: '#7C3AED',
                  selectedDayBackgroundColor: '#7C3AED',
                  selectedDayTextColor: '#fff',
                  arrowColor: '#7C3AED',
                  monthTextColor: '#1A1A2E',
                  textMonthFontWeight: '700',
                  textMonthFontSize: 16,
                  dayTextColor: '#374151',
                  textDayFontSize: 15,
                  textDayHeaderFontSize: 13,
                  textDayHeaderFontWeight: '600',
                  dotColor: '#7C3AED',
                }}
              />
              <Pressable style={styles.modalClose} onPress={() => setShowCalendar(false)}>
                <Text style={styles.modalCloseText}>Done</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>

        <Text style={styles.label}>Time</Text>
        <TextInput
          style={styles.input}
          value={time}
          onChangeText={setTime}
          placeholder="10:00 AM"
          placeholderTextColor="#999"
        />

        <Text style={styles.label}>Location</Text>
        <TextInput
          style={styles.input}
          value={location}
          onChangeText={setLocation}
          placeholder="e.g. Lincoln Elementary Gym"
          placeholderTextColor="#999"
        />

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

        {isMultiDay && (
          <View style={styles.slotModeContainer}>
            <TouchableOpacity
              style={[styles.slotModeOption, slotMode === 'same' && styles.slotModeOptionSelected]}
              onPress={() => handleSlotModeChange('same')}
            >
              <Text style={[styles.slotModeText, slotMode === 'same' && styles.slotModeTextSelected]}>
                Same slots each day
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.slotModeOption, slotMode === 'different' && styles.slotModeOptionSelected]}
              onPress={() => handleSlotModeChange('different')}
            >
              <Text style={[styles.slotModeText, slotMode === 'different' && styles.slotModeTextSelected]}>
                Different slots each day
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {isMultiDay && slotMode === 'different' ? (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayTabsScroll}>
              <View style={styles.dayTabs}>
                {eventDays.map((day) => (
                  <TouchableOpacity
                    key={day}
                    style={[styles.dayTab, activeDayTab === day && styles.dayTabActive]}
                    onPress={() => setActiveDayTab(day)}
                  >
                    <Text style={[styles.dayTabText, activeDayTab === day && styles.dayTabTextActive]}>
                      {formatShortDate(day)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            {activeDayTab && (
              <View style={styles.daySlotContainer}>
                <Text style={styles.daySlotTitle}>Slots for {formatShortDate(activeDayTab)}</Text>
                {renderSlotRows(
                  perDaySlots[activeDayTab] || [],
                  (id, field, value) => updateDaySlot(activeDayTab, id, field, value),
                  (id) => removeDaySlot(activeDayTab, id),
                  () => addDaySlot(activeDayTab),
                )}
              </View>
            )}
          </>
        ) : (
          renderSlotRows(slots, updateSlot, removeSlot, addSlot)
        )}

        {submitAttempted && validationErrors.length > 0 ? (
          <View style={styles.validationBox}>
            {validationErrors.map((err, i) => (
              <Text key={i} style={styles.validationItem}>* {err}</Text>
            ))}
          </View>
        ) : null}

        {apiError ? <Text style={styles.errorText}>{apiError}</Text> : null}

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
  datePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  datePickerPressed: { opacity: 0.75 },
  dateText: { fontSize: 16, color: '#1A1A2E' },
  datePlaceholder: { fontSize: 16, color: '#999' },
  calendarIcon: { fontSize: 20 },
  multiDayBanner: {
    backgroundColor: '#F3E8FF',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  multiDayText: {
    fontSize: 14,
    color: '#6B21A8',
    fontWeight: '500',
  },
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
    backgroundColor: '#7C3AED',
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
  addSlotText: { color: '#7C3AED', fontSize: 16, fontWeight: '600' },
  /* Slot mode toggle */
  slotModeContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  slotModeOption: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    alignItems: 'center',
  },
  slotModeOptionSelected: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  slotModeText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
    textAlign: 'center',
  },
  slotModeTextSelected: {
    color: '#FFFFFF',
  },
  /* Day tabs */
  dayTabsScroll: {
    marginBottom: 12,
  },
  dayTabs: {
    flexDirection: 'row',
    gap: 8,
  },
  dayTab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dayTabActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  dayTabText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
  dayTabTextActive: {
    color: '#FFFFFF',
  },
  daySlotContainer: {
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
  },
  daySlotTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6B21A8',
    marginBottom: 12,
  },
  validationBox: {
    backgroundColor: '#FFF0F0',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  validationItem: { color: '#D93025', fontSize: 14, marginBottom: 4 },
  errorText: { color: '#FF6B6B', fontSize: 15, marginBottom: 12 },
  saveBtn: {
    backgroundColor: '#7C3AED',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnPressed: { opacity: 0.88 },
  saveBtnText: { color: '#fff', fontSize: 19, fontWeight: '700' },
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