import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthStateChanged } from '../services/auth';

import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import HomeDashboardScreen from '../screens/HomeDashboardScreen';
import CreateEventScreen from '../screens/CreateEventScreen';
import EventDetailScreen from '../screens/EventDetailScreen';
import ParticipantSignUpScreen from '../screens/ParticipantSignUpScreen';

// ---------------------------------------------------------------------------
// Route param types
// ---------------------------------------------------------------------------

export type RootStackParamList = {
  // Auth stack
  Login: undefined;
  Signup: undefined;
  // App stack
  HomeDashboard: { userId: string };
  CreateEvent: {
    userId: string;
    prefill?: {
      title: string;
      description: string;
      time: string;
      location: string;
      capacity: string;
      slots: Array<{ name: string; quantity: string }>;
    };
  };
  EventDetail: { eventId: string };
  ParticipantSignUp: { eventId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const sharedHeaderOptions = {
  headerStyle: { backgroundColor: '#4A90D9' },
  headerTintColor: '#fff',
  headerTitleStyle: { fontWeight: '700' as const, fontSize: 18 },
};

// ---------------------------------------------------------------------------
// AppNavigator
//
// Auth pattern: two conditional groups inside one Stack.Navigator.
// When userId is null  → only Login + Signup screens are mounted.
// When userId is set   → only the app screens are mounted.
//
// React Navigation automatically animates between the groups when auth state
// changes, so LoginScreen does not need to call navigation.navigate() on
// success — signIn() triggers onAuthStateChanged, which updates userId here,
// which re-renders the navigator with HomeDashboard as the top screen.
// ---------------------------------------------------------------------------

export default function AppNavigator() {
  const [userId, setUserId]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // onAuthStateChanged fires immediately with the current session on mount,
    // so the loading flash is imperceptibly brief in practice.
    const unsubscribe = onAuthStateChanged((uid) => {
      setUserId(uid);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Show a centered spinner while the session is being resolved.
  // Without this, there's a single-frame flash of the wrong screen.
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#4A90D9" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={sharedHeaderOptions}>
      {userId === null ? (
        // ── Auth stack ───────────────────────────────────────────────────────
        // These screens are only reachable when no user is logged in.
        <>
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ title: 'Sign In', headerShown: false }}
          />
          <Stack.Screen
            name="Signup"
            component={SignupScreen}
            options={{ title: 'Create Account', headerShown: false }}
          />
        </>
      ) : (
        // ── App stack ────────────────────────────────────────────────────────
        // These screens are only reachable when a user is logged in.
        // userId is passed as initialParams so HomeDashboard always has it.
        <>
          <Stack.Screen
            name="HomeDashboard"
            component={HomeDashboardScreen}
            options={{ title: 'My Events' }}
            initialParams={{ userId }}
          />
          <Stack.Screen
            name="CreateEvent"
            component={CreateEventScreen}
            options={{ title: 'Create Event' }}
          />
          <Stack.Screen
            name="EventDetail"
            component={EventDetailScreen}
            options={{ title: 'Event Details' }}
          />
          <Stack.Screen
            name="ParticipantSignUp"
            component={ParticipantSignUpScreen}
            options={{ title: 'Sign Up' }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}
