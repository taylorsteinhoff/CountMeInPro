


import { useEffect, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { getEventDetail, type EventDetail } from '../services/events';
import { supabase } from '../services/supabase';
type DetailRoute = RouteProp<RootStackParamList, 'EventDetail'>;
export default function EventDetailScreen() {
  const { params } = useRoute<DetailRoute>();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [swapRequests, setSwapRequests] = useState<any[]>([]);
  const SWAP_SELECT =
    '*, requester:requester_signup_id(*, participants(*), signup_slots(*)), target:target_signup_id(*, participants(*), signup_slots(*))';
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getEventDetail(params.eventId);
        if (!cancelled) setEvent(data);
        const { data: swaps } = await supabase
          .from('swap_requests')
          .select(SWAP_SELECT)
          .eq('event_id', params.eventId)
          .eq('status', 'pending');
        if (!cancelled) setSwapRequests(swaps || []);
      } catch (e: unknown) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Failed to load event.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [params.eventId]);
  const refreshEvent = async () => {
    try {
      const [data, { data: swaps }] = await Promise.all([
        getEventDetail(params.eventId),
        supabase
          .from('swap_requests')
          .select(SWAP_SELECT)
          .eq('event_id', params.eventId)
          .eq('status', 'pending'),
      ]);
      setEvent(data);
      setSwapRequests(swaps || []);
    } catch {
      // silent on background refresh
    }
  };
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4A90D9" />
      </View>
    );
  }
  if (error || !event) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFound}>{error || 'Event not found'}</Text>
      </View>
    );
  }
  const handleShare = async () => {
    const shareUrl = `https://taylorsteinhoff.github.io/CountMeInPro/event.html?id=${event.id}`;
    await Share.share({
      message: `You're invited to "${event.title}"!\n${event.date} at ${event.time}\n${event.location}\n\nSign up here: ${shareUrl}`,
    });
  };
  const handleExport = async () => {
    const lines = event.signups.length
      ? event.signups.map((p) => `${p.name} \u2013 ${p.email}`).join('\n')
      : 'No signups yet.';
    await Share.share({
      message: `Signup list for ${event.title}:\n\n${lines}`,
    });
  };
  const handleExportCSV = async () => {
    try {
      let csv = 'Slot Name,Participant Name,Email,Phone,Signed Up At\n';
      const { data: slots } = await supabase
        .from('signup_slots')
        .select('*')
        .eq('event_id', params.eventId)
        .order('created_at', { ascending: true });
      const { data: allSignups } = await supabase
        .from('event_signups')
        .select('*, participants(*), signup_slots(*)')
        .eq('event_id', params.eventId);
      for (const slot of slots || []) {
        const slotSignups = (allSignups || []).filter((s) => s.slot_id === slot.id);
        if (slotSignups.length === 0) {
          csv += `"${slot.name}","(empty)","","",""\n`;
        } else {
          for (const signup of slotSignups) {
            csv += `"${slot.name}","${signup.participants?.name || ''}","${signup.participants?.email || ''}","${signup.participants?.phone || ''}","${signup.signed_up_at || ''}"\n`;
          }
        }
      }
      await Share.share({
        message: csv,
        title: `${event?.title} - Signups Export`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to export data';
      Alert.alert('Export Error', msg);
    }
  };
  const handleDuplicateEvent = async () => {
    Alert.alert(
      'Duplicate Event',
      `Create a copy of "${event.title}"?`,
      [
        { text: 'Cancel' },
        {
          text: 'Duplicate',
          onPress: async () => {
            try {
              const { data: user } = await supabase.auth.getUser();
              if (!user.user?.id) throw new Error('Not authenticated');
              const nextWeek = new Date();
              nextWeek.setDate(nextWeek.getDate() + 7);
              const newDate = nextWeek.toISOString().split('T')[0];
              const { data: newEvent, error: eventError } = await supabase
                .from('events')
                .insert({
                  user_id: user.user.id,
                  title: `${event.title} (Copy)`,
                  description: event.description,
                  date: newDate,
                  time: event.time,
                  location: event.location,
                  capacity: event.capacity,
                })
                .select()
                .single();
              if (eventError) throw eventError;
              const { data: originalSlots } = await supabase
                .from('signup_slots')
                .select('*')
                .eq('event_id', params.eventId);
              if (originalSlots && originalSlots.length > 0) {
                const newSlots = originalSlots.map((s) => ({
                  event_id: newEvent.id,
                  name: s.name,
                  quantity: s.quantity,
                }));
                await supabase.from('signup_slots').insert(newSlots);
              }
              Alert.alert(
                'Event Duplicated!',
                `"${event.title} (Copy)" has been created for ${newDate}.`,
                [
                  {
                    text: 'Go to Dashboard',
                    onPress: () => navigation.navigate('HomeDashboard', { userId: event.user_id }),
                  },
                  { text: 'Stay Here' },
                ],
              );
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : 'Failed to duplicate event';
              Alert.alert('Error', msg);
            }
          },
        },
      ],
    );
  };

  // Move a participant to a different slot using ActionSheetIOS (handles unlimited options)
  const handleMoveSignup = (pSignupId: string, pName: string, currentSlotId: string) => {
    const otherSlots = event.slots.filter((s) => s.id !== currentSlotId);
    if (otherSlots.length === 0) {
      Alert.alert('No Other Slots', 'There are no other slots to move to.');
      return;
    }
    const options = [...otherSlots.map((s) => s.name), 'Cancel'];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: `Move ${pName} to:`,
          options,
          cancelButtonIndex: options.length - 1,
        },
        async (buttonIndex) => {
          if (buttonIndex === options.length - 1) return;
          const selectedSlot = otherSlots[buttonIndex];
          try {
            const { error: moveErr } = await supabase
              .from('event_signups')
              .update({ slot_id: selectedSlot.id })
              .eq('id', pSignupId);
            if (moveErr) throw moveErr;
            Alert.alert('Moved', `${pName} moved to "${selectedSlot.name}".`);
            refreshEvent();
          } catch (err: unknown) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed to move signup');
          }
        },
      );
    } else {
      // Android fallback
      const alertOptions = otherSlots.map((s) => ({
        text: s.name,
        onPress: async () => {
          try {
            const { error: moveErr } = await supabase
              .from('event_signups')
              .update({ slot_id: s.id })
              .eq('id', pSignupId);
            if (moveErr) throw moveErr;
            Alert.alert('Moved', `${pName} moved to "${s.name}".`);
            refreshEvent();
          } catch (err: unknown) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed to move signup');
          }
        },
      }));
      alertOptions.push({ text: 'Cancel', onPress: () => {} } as any);
      Alert.alert(`Move ${pName} to:`, 'Select a new slot:', alertOptions as any);
    }
  };

  // Swap two participants' slots instantly
  const handleRequestSwap = (mySignupId: string, mySlotName: string, mySlotId: string) => {
    const allSignups = event.signups.filter((s) => s.slot_id !== mySlotId);
    if (allSignups.length === 0) {
      Alert.alert('No Swaps Available', 'No other participants in different slots to swap with.');
      return;
    }
    const options = [...allSignups.map((s) => `${s.name} (${s.slot_name || 'Unknown slot'})`), 'Cancel'];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: `Swap "${mySlotName}" with:`,
          options,
          cancelButtonIndex: options.length - 1,
        },
        async (buttonIndex) => {
          if (buttonIndex === options.length - 1) return;
          const target = allSignups[buttonIndex];
          try {
            await supabase
              .from('event_signups')
              .update({ slot_id: target.slot_id })
              .eq('id', mySignupId);
            await supabase
              .from('event_signups')
              .update({ slot_id: mySlotId })
              .eq('id', target.signup_id);
            const myName = event.signups.find((x) => x.signup_id === mySignupId)?.name ?? '';
            Alert.alert('Swapped!', `${myName} and ${target.name} have been swapped.`);
            refreshEvent();
          } catch (err: unknown) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed to swap');
          }
        },
      );
    } else {
      const alertOptions = allSignups.map((s) => ({
        text: `${s.name} (${s.slot_name || 'Unknown slot'})`,
        onPress: async () => {
          try {
            await supabase.from('event_signups').update({ slot_id: s.slot_id }).eq('id', mySignupId);
            await supabase.from('event_signups').update({ slot_id: mySlotId }).eq('id', s.signup_id);
            Alert.alert('Swapped!', `Slots have been swapped.`);
            refreshEvent();
          } catch (err: unknown) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed to swap');
          }
        },
      }));
      alertOptions.push({ text: 'Cancel', onPress: () => {} } as any);
      Alert.alert(`Swap "${mySlotName}" with:`, 'Choose who to swap with:', alertOptions as any);
    }
  };

  const handleRespondToSwap = async (swapId: string, response: 'accepted' | 'declined') => {
    try {
      if (response === 'accepted') {
        const { data: swap } = await supabase
          .from('swap_requests')
          .select('*, requester:requester_signup_id(*), target:target_signup_id(*)')
          .eq('id', swapId)
          .single();
        if (!swap) throw new Error('Swap not found');
        const requesterSlotId = swap.requester?.slot_id;
        const targetSlotId = swap.target?.slot_id;
        await supabase
          .from('event_signups')
          .update({ slot_id: targetSlotId })
          .eq('id', swap.requester_signup_id);
        await supabase
          .from('event_signups')
          .update({ slot_id: requesterSlotId })
          .eq('id', swap.target_signup_id);
      }
      await supabase
        .from('swap_requests')
        .update({ status: response, updated_at: new Date().toISOString() })
        .eq('id', swapId);
      Alert.alert('Done', response === 'accepted' ? 'Slots swapped!' : 'Swap declined.');
      refreshEvent();
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to process swap');
    }
  };
  const handleAddToCalendar = () => {
    const eventTitle = encodeURIComponent(event.title);
    const eventLocation = encodeURIComponent(event.location || '');
    const eventDescription = encodeURIComponent(event.description || '');
    const startDate = event.date.replace(/-/g, '');
    const startTime = event.time.replace(/:/g, '').slice(0, 6);
    const googleUrl =
      `https://calendar.google.com/calendar/render?action=TEMPLATE` +
      `&text=${eventTitle}` +
      `&dates=${startDate}T${startTime}/${startDate}T${startTime}` +
      `&location=${eventLocation}` +
      `&details=${eventDescription}`;
    const outlookUrl =
      `https://outlook.live.com/calendar/0/deeplink/compose?subject=${eventTitle}` +
      `&startdt=${event.date}T${event.time}` +
      `&enddt=${event.date}T${event.time}` +
      `&location=${eventLocation}` +
      `&body=${eventDescription}`;
    Alert.alert(
      'Add to Calendar',
      'Choose your calendar:',
      [
        {
          text: 'Google Calendar',
          onPress: () => Linking.openURL(googleUrl).catch(() =>
            Alert.alert('Error', 'Could not open Google Calendar.')
          ),
        },
        {
          text: 'Outlook',
          onPress: () => Linking.openURL(outlookUrl).catch(() =>
            Alert.alert('Error', 'Could not open Outlook.')
          ),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };
  const handleSignUp = () => {
    navigation.navigate('ParticipantSignUp', { eventId: event.id });
  };
  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      {/* ── Event Info Card ── */}
      <View style={styles.card}>
        <Text style={styles.title}>{event.title}</Text>
        <Text style={styles.description}>{event.description}</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Date & Time</Text>
          <Text style={styles.infoValue}>
            {event.date}  {'\u00B7'}  {event.time}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Location</Text>
          <Text style={styles.infoValue}>{event.location}</Text>
        </View>
      </View>

      {/* ── Signup Slots ── */}
      <Text style={styles.sectionTitle}>Signup Slots</Text>
      {event.slots.map((slot) => {
        const slotSignups = event.signups.filter((s) => s.slot_id === slot.id);
        const spotsLeft = slot.quantity - slotSignups.length;
        const isFull = spotsLeft <= 0;
        return (
          <View key={slot.id} style={[styles.slotRow, isFull && styles.slotRowFull]}>
            <Text style={[styles.slotName, isFull && styles.slotNameFull]}>{slot.name}</Text>
            <Text style={[styles.slotAvailability, isFull && styles.slotAvailabilityFull]}>
              {isFull ? 'Full' : `${spotsLeft} of ${slot.quantity} available`}
            </Text>
          </View>
        );
      })}

      {/* ── Signups Grouped by Slot ── */}
      <Text style={styles.sectionTitle}>
        Signed Up ({event.signups.length})
      </Text>
      {event.signups.length === 0 ? (
        <Text style={styles.emptyText}>No signups yet</Text>
      ) : (
        event.slots.map((slot) => {
          const slotSignups = event.signups.filter((s) => s.slot_id === slot.id);
          const spotsLeft = slot.quantity - slotSignups.length;
          return (
            <View key={slot.id} style={styles.slotGroup}>
              <View style={styles.slotGroupHeader}>
                <Text style={styles.slotGroupName}>{slot.name}</Text>
                <Text style={[styles.slotGroupCount, spotsLeft <= 0 && styles.slotGroupCountFull]}>
                  {spotsLeft <= 0 ? 'Full' : `${spotsLeft} of ${slot.quantity} available`}
                </Text>
              </View>
              {slotSignups.length === 0 ? (
                <Text style={styles.slotGroupEmpty}>No signups for this slot</Text>
              ) : (
                slotSignups.map((p) => (
                  <View key={p.signup_id} style={styles.participantRow}>
                    <View style={styles.participantInfo}>
                      <Text style={styles.participantName}>{p.name}</Text>
                      <Text style={styles.participantDetail}>{p.email}</Text>
                      {p.phone ? <Text style={styles.participantDetail}>{p.phone}</Text> : null}
                      {p.notes ? <Text style={styles.participantNotes}>{p.notes}</Text> : null}
                    </View>
                    <View style={styles.participantActions}>
                      <TouchableOpacity
                        style={styles.changeSlotBtn}
                        onPress={() => handleMoveSignup(p.signup_id, p.name, slot.id)}
                      >
                        <Text style={styles.changeSlotBtnText}>Move</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.removeSignupBtn}
                        onPress={() => {
                          Alert.alert(
                            'Remove Signup',
                            `Remove ${p.name} from "${slot.name}"?`,
                            [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Remove',
                                style: 'destructive',
                                onPress: async () => {
                                  try {
                                    const { error: delErr } = await supabase
                                      .from('event_signups')
                                      .delete()
                                      .eq('id', p.signup_id);
                                    if (delErr) throw delErr;
                                    Alert.alert('Removed', `${p.name} has been removed.`);
                                    refreshEvent();
                                  } catch (err: unknown) {
                                    Alert.alert('Error', err instanceof Error ? err.message : 'Failed to remove signup');
                                  }
                                },
                              },
                            ],
                          );
                        }}
                      >
                        <Text style={styles.removeSignupBtnText}>X</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.swapBtn}
                        onPress={() => handleRequestSwap(p.signup_id, slot.name, slot.id)}
                      >
                        <Text style={styles.swapBtnText}>Swap</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>
          );
        })
      )}

      {/* ── Pending Swap Requests ── */}
      {swapRequests.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>
            Pending Swaps ({swapRequests.length})
          </Text>
          {swapRequests.map((swap) => (
            <View key={swap.id} style={styles.swapRequestRow}>
              <Text style={styles.swapRequestText}>
                <Text style={{ fontWeight: '700' }}>
                  {swap.requester?.participants?.name || 'Someone'}
                </Text>
                {' wants to swap\n'}
                <Text style={{ fontWeight: '600' }}>
                  "{swap.requester?.signup_slots?.name || '?'}"
                </Text>
                {' \u2194 '}
                <Text style={{ fontWeight: '600' }}>
                  "{swap.target?.signup_slots?.name || '?'}"
                </Text>
              </Text>
              <View style={styles.swapResponseRow}>
                <TouchableOpacity
                  style={styles.acceptBtn}
                  onPress={() => handleRespondToSwap(swap.id, 'accepted')}
                >
                  <Text style={styles.acceptBtnText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.declineBtn}
                  onPress={() => handleRespondToSwap(swap.id, 'declined')}
                >
                  <Text style={styles.declineBtnText}>Decline</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </>
      )}

      {/* ── Action Buttons ── */}
      <View style={styles.actions}>
        {/* Sign Up is first so it's easy to find */}
        <Pressable onPress={handleSignUp} style={({ pressed }) => [styles.solidBtn, pressed && styles.solidBtnPressed]}>
          <Text style={styles.solidBtnText}>Sign Up</Text>
        </Pressable>
        <Pressable onPress={handleShare} style={({ pressed }) => [styles.outlineBtn, pressed && styles.outlineBtnPressed]}>
          <Text style={styles.outlineBtnText}>Share Event</Text>
        </Pressable>
        <Pressable onPress={handleExport} style={({ pressed }) => [styles.outlineBtn, pressed && styles.outlineBtnPressed]}>
          <Text style={styles.outlineBtnText}>Export Signup List</Text>
        </Pressable>
        <TouchableOpacity style={styles.duplicateButton} onPress={handleDuplicateEvent}>
          <Text style={styles.duplicateButtonText}>{'\uD83D\uDCCB'} Duplicate Event</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.exportButton} onPress={handleExportCSV}>
          <Text style={styles.exportButtonText}>{'\uD83D\uDCCA'} Export CSV</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.calendarButton} onPress={handleAddToCalendar}>
          <Text style={styles.calendarButtonText}>{'\uD83D\uDCC5'} Add to Calendar</Text>
        </TouchableOpacity>
        <Pressable
          onPress={() => {
            Alert.alert(
              'Delete Event',
              `Are you sure you want to delete "${event.title}"? This cannot be undone.`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      const { error: delError } = await supabase
                        .from('events')
                        .delete()
                        .eq('id', event.id);
                      if (delError) throw delError;
                      Alert.alert('Deleted', 'Event has been deleted.', [
                        { text: 'OK', onPress: () => navigation.goBack() },
                      ]);
                    } catch (err: unknown) {
                      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to delete event');
                    }
                  },
                },
              ],
            );
          }}
          style={({ pressed }) => [styles.deleteBtn, pressed && styles.deleteBtnPressed]}
        >
          <Text style={styles.deleteBtnText}>Delete Event</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F9F9F9' },
  content: { padding: 20, paddingBottom: 48 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9F9F9' },
  notFound: { fontSize: 18, color: '#6B7280' },
  card: {
    borderRadius: 14,
    padding: 20,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
  title: { fontSize: 26, fontWeight: '800', color: '#1A1A2E', marginBottom: 8 },
  description: { fontSize: 16, color: '#6B7280', marginBottom: 18, lineHeight: 24 },
  infoRow: { marginBottom: 14 },
  infoLabel: { fontSize: 12, fontWeight: '700', color: '#9CA3AF', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { fontSize: 17, color: '#1A1A2E', fontWeight: '500' },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A2E',
    marginTop: 28,
    marginBottom: 10,
  },
  slotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  slotName: { fontSize: 16, color: '#1A1A2E', fontWeight: '500' },
  slotQty: { fontSize: 15, color: '#6B7280', fontWeight: '600' },
  slotRowFull: { opacity: 0.5 },
  slotNameFull: { color: '#9CA3AF' },
  slotAvailability: { fontSize: 14, color: '#059669', fontWeight: '600' },
  slotAvailabilityFull: { color: '#EF4444' },
  emptyText: { fontSize: 15, color: '#9CA3AF', marginBottom: 8 },
  participantRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  slotGroup: {
    marginBottom: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  slotGroupHeader: {
    backgroundColor: '#F3E8FF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  slotGroupName: { fontSize: 16, fontWeight: '700', color: '#6B21A8' },
  slotGroupCount: { fontSize: 13, fontWeight: '600', color: '#059669' },
  slotGroupCountFull: { color: '#EF4444' },
  slotGroupEmpty: { fontSize: 14, color: '#9CA3AF', padding: 16, fontStyle: 'italic' },
  participantInfo: { flex: 1 },
  participantName: { fontSize: 17, fontWeight: '600', color: '#1A1A2E' },
  participantDetail: { fontSize: 14, color: '#6B7280', marginTop: 2 },
  participantSlot: { fontSize: 12, color: '#4A90D9', fontWeight: '600', marginTop: 3 },
  participantNotes: { fontSize: 13, color: '#6B7280', fontStyle: 'italic', marginTop: 3 },
  swapBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    marginLeft: 4,
  },
  swapBtnText: { fontSize: 13, color: '#6B7280', fontWeight: '600' },
  participantActions: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 8 },
  changeSlotBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#EEF4FF',
    borderWidth: 1,
    borderColor: '#4A90D9',
  },
  changeSlotBtnText: { fontSize: 12, color: '#4A90D9', fontWeight: '700' },
  removeSignupBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  removeSignupBtnText: { color: '#EF4444', fontSize: 13, fontWeight: '700' },
  swapRequestRow: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  swapRequestText: { fontSize: 14, color: '#1A1A2E', lineHeight: 20, marginBottom: 10 },
  swapResponseRow: { flexDirection: 'row', gap: 8 },
  acceptBtn: {
    flex: 1,
    backgroundColor: '#059669',
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
  },
  acceptBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  declineBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
  },
  declineBtnText: { color: '#6B7280', fontWeight: '600', fontSize: 14 },
  swapButton: {
    backgroundColor: '#F3E8FF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginLeft: 8,
  },
  swapButtonText: { fontSize: 16 },
  actions: { marginTop: 36, gap: 12 },
  outlineBtn: {
    borderWidth: 1.5,
    borderColor: '#4A90D9',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  outlineBtnPressed: { opacity: 0.8 },
  outlineBtnText: { color: '#4A90D9', fontSize: 17, fontWeight: '600' },
  solidBtn: {
    backgroundColor: '#4A90D9',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
  },
  solidBtnPressed: { opacity: 0.88 },
  solidBtnText: { color: '#fff', fontSize: 19, fontWeight: '700' },
  exportButton: {
    backgroundColor: '#059669',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  exportButtonText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  duplicateButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  duplicateButtonText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  calendarButton: {
    backgroundColor: '#0EA5E9',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  calendarButtonText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  deleteBtn: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1.5,
    borderColor: '#EF4444',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
  },
  deleteBtnPressed: { opacity: 0.8 },
  deleteBtnText: { color: '#EF4444', fontSize: 17, fontWeight: '700' },
});