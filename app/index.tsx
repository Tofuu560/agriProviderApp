import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

const colors = {
  primary: '#1F6B3A',
  amber: '#F2A93B',
  danger: '#C8442B',
  background: '#F7F8F5',
  card: '#FFFFFF',
  text: '#1A1A1A',
  muted: '#727A73',
  border: '#DDE2DC',
};

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function signIn() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      Alert.alert('Email required', 'Enter your email address to continue.');
      return;
    }

    if (normalizedEmail.includes('provider')) {
      router.replace('/provider');
    } else if (normalizedEmail.includes('qa')) {
      router.replace('/qa');
    } else if (normalizedEmail.includes('assessor')) {
      router.replace('/assessor');
    } else {
      Alert.alert(
        'Account not recognized',
        'Use an email containing provider, qa, or assessor to continue.',
      );
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboard}
      >
        <View style={styles.content}>
          <View style={styles.brand}>
            <View style={styles.logo}>
              <Text style={styles.logoMark}>✦</Text>
            </View>
            <Text style={styles.title}>AgriProvider</Text>
            <Text style={styles.subtitle}>Sign in to continue</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Email address</Text>
            <TextInput
              accessibilityLabel="Email address"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="name@example.com"
              placeholderTextColor="#9AA19B"
              returnKeyType="next"
              style={styles.input}
              value={email}
            />
            <Text style={[styles.label, styles.passwordLabel]}>Password</Text>
            <TextInput
              accessibilityLabel="Password"
              autoCapitalize="none"
              onChangeText={setPassword}
              placeholder="Enter your password"
              placeholderTextColor="#9AA19B"
              returnKeyType="go"
              onSubmitEditing={signIn}
              secureTextEntry
              style={styles.input}
              value={password}
            />
            <Pressable
              accessibilityRole="button"
              onPress={signIn}
              style={({ pressed }) => [styles.signInButton, pressed && styles.pressed]}
            >
              <Text style={styles.signInText}>Sign in</Text>
            </Pressable>
          </View>

          <Text style={styles.footer}>Secured by Identity Service</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  keyboard: { flex: 1 },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  brand: { alignItems: 'center', marginBottom: 42 },
  logo: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  logoMark: { color: colors.card, fontSize: 34, fontWeight: '700' },
  title: { color: colors.text, fontSize: 29, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: colors.muted, fontSize: 16, marginTop: 8 },
  form: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#ECEFEB',
  },
  label: { color: colors.text, fontWeight: '600', fontSize: 14, marginBottom: 8 },
  passwordLabel: { marginTop: 18 },
  input: {
    height: 52,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    color: colors.text,
    fontSize: 16,
  },
  signInButton: {
    minHeight: 52,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  signInText: { color: colors.card, fontSize: 16, fontWeight: '700' },
  pressed: { opacity: 0.82 },
  footer: { color: colors.muted, textAlign: 'center', marginTop: 28, fontSize: 13 },
});
