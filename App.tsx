import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import AppNavigator from './src/navigation/AppNavigator';

const prefix = Linking.createURL('/');

const linking = {
  prefixes: [prefix, 'countmeinpro://', 'https://taylorsteinhoff.github.io/CountMeInPro'],
  config: {
    screens: {
      EventDetail: 'event/:eventId',
      ParticipantSignUp: 'signup/:eventId',
    },
  },
};

export default function App() {
  return (
    <NavigationContainer linking={linking}>
      <StatusBar style="light" />
      <AppNavigator />
    </NavigationContainer>
  );
}