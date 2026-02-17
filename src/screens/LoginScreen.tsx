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
import { isValidEmail, isValidPassword } from '../utils/validation';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function LoginScreen() {
  const navigation = useNavigation<Nav>();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [apiError, setApiError] = useState('');

  // Track whether the user has left each field so we only show errors after interaction.
  const [emailTouched, setEmailTouched]       = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  // Derived field-level errors.
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

  const isFormValid = emailError === '' && passwordError === '';

  const handleSignIn = async () => {
    setApiError('');
    setLoading(true);

    try {
      await signIn(email.trim(), password);
      // No navigation.navigate() needed here.
      // AppNavigator listens to onAuthStateChanged and will automatically
      // swap this screen out for HomeDashboard when signIn succeeds.
    } catch (e: unknown) {
      setApiError(e instanceof Error ? e.message : 'Sign in failed. Please try again.');
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
          placeholder="Your password"
          placeholderTextColor="#999"
          secureTextEntry
          autoCapitalize="none"
          editable={!loading}
        />
        {passwordTouched && passwordError ? (
          <Text style={styles.fieldError}>{passwordError}</Text>
        ) : null}

        {/* API-level error (wrong credentials, network, etc.) */}
        {apiError ? <Text style={styles.error}>{apiError}</Text> : null}

        {/* Sign In button – disabled until both fields are valid */}
        <Pressable
          onPress={handleSignIn}
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
    marginBottom: 4,
    minHeight: 52,
  },
  // Red border when a touched field has an error.
  inputInvalid: { borderColor: '#FF6B6B' },
  // Appears below an invalid field; 14 px bottom gap restores original 18 px rhythm.
  fieldError: { color: '#FF6B6B', fontSize: 13, marginBottom: 14 },

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
});
