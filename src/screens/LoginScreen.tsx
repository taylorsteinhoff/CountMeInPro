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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { signIn } from '../services/auth';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function LoginScreen() {
  const navigation = useNavigation<Nav>();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleSignIn = async () => {
    const trimmedEmail    = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      setError('Email and password are required.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await signIn(trimmedEmail, trimmedPassword);
      // No navigation.navigate() needed here.
      // AppNavigator listens to onAuthStateChanged and will automatically
      // swap this screen out for HomeDashboard when signIn succeeds.
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Sign in failed. Please try again.');
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
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo / title area */}
        <View style={styles.header}>
          <Text style={styles.appName}>CountMeIn Pro</Text>
          <Text style={styles.tagline}>Organizer sign in</Text>
        </View>

        {/* Email */}
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor="#999"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
        />

        {/* Password */}
        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Your password"
          placeholderTextColor="#999"
          secureTextEntry
          autoCapitalize="none"
          editable={!loading}
        />

        {/* Error */}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* Sign In button */}
        <Pressable
          onPress={handleSignIn}
          style={({ pressed }) => [styles.primaryBtn, loading && styles.primaryBtnDisabled, pressed && !loading && styles.primaryBtnPressed]}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>Sign In</Text>
          )}
        </Pressable>

        {/* Link to Sign Up */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <Pressable onPress={() => navigation.navigate('Signup')} disabled={loading}>
            <Text style={styles.link}>Sign Up</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F9F9F9' },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    paddingBottom: 48,
  },

  /* Header */
  header: { alignItems: 'center', marginBottom: 48 },
  appName: { fontSize: 36, fontWeight: '800', color: '#4A90D9', marginBottom: 8 },
  tagline: { fontSize: 17, color: '#6B7280' },

  /* Form */
  label: { fontSize: 15, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1A1A2E',
    backgroundColor: '#fff',
    marginBottom: 18,
    minHeight: 52,
  },

  /* Error */
  error: { color: '#FF6B6B', fontSize: 15, marginBottom: 16 },

  /* Button */
  primaryBtn: {
    backgroundColor: '#4A90D9',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 6,
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnPressed: { opacity: 0.88 },
  primaryBtnText: { color: '#fff', fontSize: 19, fontWeight: '700' },

  /* Footer link */
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 28 },
  footerText: { fontSize: 16, color: '#6B7280' },
  link: { fontSize: 16, color: '#4A90D9', fontWeight: '600' },
});
