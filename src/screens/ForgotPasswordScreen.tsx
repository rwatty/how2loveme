import React, { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, HelperText, Snackbar, Surface, Text, TextInput } from 'react-native-paper';
import { getAuth, sendPasswordResetEmail } from '@react-native-firebase/auth';
import { useNavigation } from '@react-navigation/native';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getFriendlyResetError(error: { code?: string; message?: string }) {
  switch (error.code) {
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/user-not-found':
      return 'We could not find an account with that email.';
    default:
      return error.message ?? 'Unable to send reset email right now.';
  }
}

export default function ForgotPasswordScreen() {
  const navigation = useNavigation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState('');
  const [error, setError] = useState('');
  const trimmedEmail = email.trim();
  const emailError = useMemo(
    () => trimmedEmail.length > 0 && !EMAIL_REGEX.test(trimmedEmail),
    [trimmedEmail],
  );

  const handleReset = async () => {
    if (emailError || !trimmedEmail) {
      return;
    }

    setLoading(true);
    setSnackbar('');
    setError('');
    try {
      await sendPasswordResetEmail(getAuth(), trimmedEmail);
      setSnackbar('Password reset email sent. Check your inbox.');
    } catch (e: any) {
      setError(getFriendlyResetError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Surface style={styles.card} elevation={2}>
        <Text variant="headlineMedium" style={styles.header}>
          Reset your password
        </Text>
        <Text style={styles.subheader}>
          Enter the email tied to your account and we will send a secure reset link.
        </Text>
        <TextInput
          mode="outlined"
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
          disabled={loading}
          error={emailError}
          left={<TextInput.Icon icon="email-outline" />}
        />
        <HelperText type="error" visible={emailError}>
          Please enter a valid email address.
        </HelperText>
        <Button
          mode="contained"
          loading={loading}
          onPress={handleReset}
          style={styles.button}
          contentStyle={styles.buttonContent}
          disabled={!trimmedEmail || emailError || loading}
        >
          Send Reset Email
        </Button>
        <Button
          onPress={() => navigation.goBack()}
          style={styles.link}
          compact
          disabled={loading}
        >
          Back to Login
        </Button>
      </Surface>
      <Snackbar
        visible={!!snackbar}
        onDismiss={() => setSnackbar('')}
        duration={3500}
        style={styles.snackbar}
      >
        {snackbar}
      </Snackbar>
      <Snackbar
        visible={!!error}
        onDismiss={() => setError('')}
        duration={4000}
        style={[styles.snackbar, styles.errorSnackbar]}
      >
        {error}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: '#FFF3EA',
  },
  card: {
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 24,
    backgroundColor: '#F3C8BA',
  },
  header: {
    textAlign: 'center',
    color: '#3F2831',
    fontWeight: '700',
  },
  subheader: {
    marginTop: 8,
    marginBottom: 16,
    textAlign: 'center',
    color: '#3F2831',
    fontSize: 16,
    lineHeight: 22,
    opacity: 0.76,
  },
  input: {
    backgroundColor: '#FFF3EA',
  },
  button: {
    borderRadius: 14,
    marginTop: 8,
  },
  buttonContent: {
    height: 52,
  },
  link: {
    alignSelf: 'center',
    marginTop: 6,
  },
  snackbar: {
    marginHorizontal: 16,
    borderRadius: 12,
  },
  errorSnackbar: {
    backgroundColor: '#B25B63',
  },
});
