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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';

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

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [capacity, setCapacity] = useState('');
  const [slots, setSlots] = useState<SlotRow[]>([makeSlot()]);

  const addSlot = () => setSlots((prev) => [...prev, makeSlot()]);

  const removeSlot = (id: string) =>
    setSlots((prev) => prev.filter((s) => s.id !== id));

  const updateSlot = (id: string, field: 'name' | 'quantity', value: string) =>
    setSlots((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)),
    );

  const handleSave = () => {
    // Milestone 1: just navigate back, no validation or persistence
    navigation.goBack();
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

        {/* Save */}
        <Pressable onPress={handleSave} style={styles.saveBtn}>
          <Text style={styles.saveBtnText}>Save Event</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, paddingBottom: 40 },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginTop: 16, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 24,
    marginBottom: 8,
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  slotName: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  slotQty: {
    width: 60,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
  removeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  addSlotBtn: { marginTop: 4, marginBottom: 24, paddingVertical: 8 },
  addSlotText: { color: '#4A90D9', fontSize: 16, fontWeight: '600' },
  saveBtn: {
    backgroundColor: '#4A90D9',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
