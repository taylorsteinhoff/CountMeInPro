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
import {
  isValidEmail,
  isValidPassword,
  getPasswordStrength,
  type PasswordStrength,
} from '../utils/validation';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Maps strength level to three bar colors (filled vs. empty).
const STRENGTH_BARS: Record<PasswordStrength, string[]> = {
  weak:   ['#FF6B6B', '#E5E7EB', '#E5E7EB'],
  medium: ['#F59E0B', '#F59E0B', '#E5E7EB'],
  strong: ['#34C759', '#34C759', '#34C759'],
};
const STRENGTH_COLOR: Record<PasswordStrength, string> = {
  weak: '#FF6B6B', medium: '#F59E0B', strong: '#34C759',
};

export default function SignupScreen() {
  const navigation = useNavigation<Nav>();

  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [confirmPassword, setConfirm] = useState('');
  const [loading, setLoading]         = useState(false);
  const [apiError, setApiError]       = useState('');
  const [success, setSuccess]         = useState(false);

  // Track whether the user has left each field.
  const [emailTouched,   setEmailTouched]   = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmTouched,  setConfirmTouched]  = useState(false);

  // ── Derived validation ────────────────────────────────────────────────────
  const emailError = !email.trim()
    ? 'Email is required.'
    : !isValidEmail(email)
    ? 'Email must include an @ symbol.'
    : '';

  const passwordError = !password
    ? 'Password is required.'
    : !isValidPassword(password)
    ? 'Password must be at least 6 characters.'
    : '';

  const confirmError = !confirmPassword
    ? 'Please confirm your password.'
    : confirmPassword !== password
    ? 'Passwords do not match.'
    : '';

  const isFormValid   = emailError === '' && passwordError === '' && confirmError === '';
  const passwordsMatch = password.length > 0 && confirmPassword === password;

  // Strength indicator (only when password has been typed).
  const strength = password.length > 0 ? getPasswordStrength(password) : null;

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSignUp = async () => {
    setApiError('');
    setLoading(true);

    try {
      await signUp(email.trim(), password);
      // Show a confirmation message — Supabase sends a verification email
      // before the account is active. In dev you can disable this under
      // Authentication → Settings in the Supabase dashboard.
      setSuccess(true);
    } catch (e: unknown) {
      setApiError(e instanceof Error ? e.message : 'Sign up failed. Please try again.');
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
          style={[styles.input, emailTouched && emailError ? styles.inputInvalid : null]}
          value={email}
          onChangeText={setEmail}
          onBlur={() => setEmailTouched(true)}
          placeholder="you@example.com"
          placeholderTextColor="#999"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
        />
        {emailTouched && emailError ? (
          <Text style={styles.fieldError}>{emailError}</Text>
        ) : null}

        {/* Password */}
        <Text style={styles.label}>Password</Text>
        <TextInput
          style={[styles.input, passwordTouched && passwordError ? styles.inputInvalid : null]}
          value={password}
          onChangeText={setPassword}
          onBlur={() => setPasswordTouched(true)}
          placeholder="At least 6 characters"
          placeholderTextColor="#999"
          secureTextEntry
          autoCapitalize="none"
          editable={!loading}
        />

        {/* Password strength indicator */}
        {strength ? (
          <View style={styles.strengthRow}>
            {STRENGTH_BARS[strength].map((color, i) => (
              <View key={i} style={[styles.strengthBar, { backgroundColor: color }]} />
            ))}
            <Text style={[styles.strengthLabel, { color: STRENGTH_COLOR[strength] }]}>
              {strength.charAt(0).toUpperCase() + strength.slice(1)}
            </Text>
          </View>
        ) : null}

        {passwordTouched && passwordError ? (
          <Text style={styles.fieldError}>{passwordError}</Text>
        ) : null}

        {/* Confirm password */}
        <Text style={styles.label}>Confirm Password</Text>
        <TextInput
          style={[styles.input, confirmTouched && confirmError ? styles.inputInvalid : null]}
          value={confirmPassword}
          onChangeText={setConfirm}
          onBlur={() => setConfirmTouched(true)}
          placeholder="Re-enter your password"
          placeholderTextColor="#999"
          secureTextEntry
          autoCapitalize="none"
          editable={!loading}
        />

        {/* Real-time match feedback */}
        {passwordsMatch ? (
          <Text style={styles.matchText}>✓ Passwords match</Text>
        ) : confirmTouched && confirmError ? (
          <Text style={styles.fieldError}>{confirmError}</Text>
        ) : null}

        {/* API-level error */}
        {apiError ? <Text style={styles.error}>{apiError}</Text> : null}

        {/* Sign Up button – disabled until all fields are valid */}
        <Pressable
          onPress={handleSignUp}
          style={({ pressed }) => [
            styles.primaryBtn,
            (!isFormValid || loading) && styles.primaryBtnDisabled,
            pressed && isFormValid && !loading && styles.primaryBtnPressed,
          ]}
          disabled={!isFormValid || loading}
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
    marginBottom: 4,
    minHeight: 52,
  },
  inputInvalid: { borderColor: '#FF6B6B' },
  fieldError: { color: '#FF6B6B', fontSize: 13, marginBottom: 14 },

  /* Password strength */
  strengthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  strengthLabel: { fontSize: 12, fontWeight: '600', marginLeft: 6, width: 50 },

  /* Passwords-match confirmation */
  matchText: { color: '#34C759', fontSize: 13, fontWeight: '600', marginBottom: 14 },

  /* API-level error */
  error: { color: '#FF6B6B', fontSize: 15, marginBottom: 16, marginTop: 4 },

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
