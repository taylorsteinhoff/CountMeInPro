import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeDashboardScreen from '../screens/HomeDashboardScreen';
import CreateEventScreen from '../screens/CreateEventScreen';
import EventDetailScreen from '../screens/EventDetailScreen';
import ParticipantSignUpScreen from '../screens/ParticipantSignUpScreen';

export type RootStackParamList = {
  HomeDashboard: undefined;
  CreateEvent: undefined;
  EventDetail: { eventId: string };
  ParticipantSignUp: { eventId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="HomeDashboard"
      screenOptions={{
        headerStyle: { backgroundColor: '#4A90D9' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <Stack.Screen
        name="HomeDashboard"
        component={HomeDashboardScreen}
        options={{ title: 'My Events' }}
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
    </Stack.Navigator>
  );
}
