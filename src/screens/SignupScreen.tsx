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
import { signUp } from '../services/auth';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function SignupScreen() {
  const navigation = useNavigation<Nav>();

  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [confirmPassword, setConfirm] = useState('');
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [success, setSuccess]         = useState(false);

  const handleSignUp = async () => {
    const trimmedEmail    = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword || !confirmPassword.trim()) {
      setError('All fields are required.');
      return;
    }

    if (trimmedPassword !== confirmPassword.trim()) {
      setError('Passwords do not match.');
      return;
    }

    if (trimmedPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await signUp(trimmedEmail, trimmedPassword);
      // Show a confirmation message — Supabase sends a verification email
      // before the account is active. In dev you can disable this under
      // Authentication → Settings in the Supabase dashboard.
      setSuccess(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Sign up failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Success state ──────────────────────────────────────────────────────────
  if (success) {
    return (
      <View style={styles.centered}>
        <Text style={styles.checkmark}>✓</Text>
        <Text style={styles.successTitle}>Account created!</Text>
        <Text style={styles.successBody}>
          Check your email to confirm your address, then come back and sign in.
        </Text>
        <Pressable
          onPress={() => navigation.navigate('Login')}
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.primaryBtnPressed]}
        >
          <Text style={styles.primaryBtnText}>Go to Sign In</Text>
        </Pressable>
      </View>
    );
  }

  // ── Form ───────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title */}
        <View style={styles.header}>
          <Text style={styles.appName}>CountMeIn Pro</Text>
          <Text style={styles.tagline}>Create your organizer account</Text>
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
          placeholder="At least 6 characters"
          placeholderTextColor="#999"
          secureTextEntry
          autoCapitalize="none"
          editable={!loading}
        />

        {/* Confirm password */}
        <Text style={styles.label}>Confirm Password</Text>
        <TextInput
          style={styles.input}
          value={confirmPassword}
          onChangeText={setConfirm}
          placeholder="Re-enter your password"
          placeholderTextColor="#999"
          secureTextEntry
          autoCapitalize="none"
          editable={!loading}
        />

        {/* Error */}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* Sign Up button */}
        <Pressable
          onPress={handleSignUp}
          style={({ pressed }) => [styles.primaryBtn, loading && styles.primaryBtnDisabled, pressed && !loading && styles.primaryBtnPressed]}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>Create Account</Text>
          )}
        </Pressable>

        {/* Link to Login */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Pressable onPress={() => navigation.navigate('Login')} disabled={loading}>
            <Text style={styles.link}>Sign In</Text>
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

  /* Success state */
  centered: {
    flex: 1,
    backgroundColor: '#F9F9F9',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  checkmark: { fontSize: 64, color: '#34C759', marginBottom: 20 },
  successTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1A1A2E',
    marginBottom: 14,
    textAlign: 'center',
  },
  successBody: {
    fontSize: 17,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 36,
  },
});
