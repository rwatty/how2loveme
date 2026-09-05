import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, Snackbar, Surface, Text } from 'react-native-paper';
import { getAuth, reload, sendEmailVerification, signOut } from '@react-native-firebase/auth';

const RESEND_COOLDOWN_SECONDS = 30;

export default function EmailVerificationScreen() {
  const firebaseAuth = getAuth();
  const user = firebaseAuth.currentUser;
  const [snackbar, setSnackbar] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!cooldown) {
      return;
    }

    const timer = setInterval(() => {
      setCooldown(current => (current > 1 ? current - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldown]);

  const handleResend = async () => {
    if (!user || cooldown > 0) {
      return;
    }

    setLoading(true);
    setSnackbar('');
    try {
      await sendEmailVerification(user);
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setSnackbar('Verification email sent. Check your inbox.');
    } catch (e: any) {
      setSnackbar(e.message ?? 'Unable to resend verification email.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!user) {
      return;
    }

    setLoading(true);
    setSnackbar('');

    try {
      await reload(user);
      const refreshedUser = getAuth().currentUser;

      if (refreshedUser?.emailVerified) {
        await refreshedUser.getIdToken(true);
      }

      setSnackbar(
        refreshedUser?.emailVerified
          ? 'Email verified. Taking you in now.'
          : 'Still waiting on verification. Try again after you confirm your email.',
      );
    } catch (e: any) {
      setSnackbar(e.message ?? 'Unable to refresh your verification status right now.');
    } finally {
      setLoading(false);
    }
  };

  const handleUseDifferentEmail = async () => {
    setLoading(true);
    await signOut(firebaseAuth);
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <Surface style={styles.card} elevation={2}>
        <Text variant="headlineMedium" style={styles.header}>
          Verify your email
        </Text>
        <Text style={styles.subheader}>
          We sent a verification link to the email below. Open it, confirm, then come back here.
        </Text>
        <Text style={styles.email}>{user?.email}</Text>
        <Button
          mode="contained"
          onPress={handleResend}
          loading={loading}
          style={styles.button}
          contentStyle={styles.buttonContent}
          disabled={loading || cooldown > 0}
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Verification Email'}
        </Button>
        <Button
          mode="outlined"
          onPress={handleRefresh}
          loading={loading}
          style={styles.button}
          contentStyle={styles.buttonContent}
          disabled={loading}
        >
          I Verified, Refresh
        </Button>
        <Button
          mode="text"
          onPress={handleUseDifferentEmail}
          disabled={loading}
          style={styles.link}
        >
          Use a Different Email
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
    marginBottom: 8,
    textAlign: 'center',
    color: '#3F2831',
    fontSize: 16,
    lineHeight: 22,
    opacity: 0.76,
  },
  email: {
    textAlign: 'center',
    color: '#B25B63',
    fontSize: 18,
    marginBottom: 18,
    fontWeight: '600',
  },
  button: {
    marginBottom: 10,
    borderRadius: 14,
  },
  buttonContent: {
    height: 52,
  },
  link: {
    alignSelf: 'center',
    marginTop: 4,
  },
  snackbar: {
    marginHorizontal: 16,
    borderRadius: 12,
  },
});
