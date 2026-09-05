import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ReactNativeBiometrics, { type BiometryType } from 'react-native-biometrics';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Avatar,
  Button,
  Card,
  Dialog,
  Divider,
  Paragraph,
  Portal,
  Snackbar,
  Surface,
  Switch,
  Text,
  TextInput,
} from 'react-native-paper';
import { getAuth, signOut } from '@react-native-firebase/auth';
import {
  acceptPartnerInvite,
  cancelPartnerInvite,
  declinePartnerInvite,
  sendPartnerInvite,
} from '../lib/relationshipSync';
import { useBiometricLockStore } from '../store/useBiometricLockStore';
import { useRelationshipStore } from '../store/useRelationshipStore';

const BIOMETRIC_LOCK_STORAGE_KEY = '@how2loveme/biometric-lock-enabled';
const rnBiometrics = new ReactNativeBiometrics();
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getBiometricLabel(biometryType: BiometryType | null) {
  switch (biometryType) {
    case 'FaceID':
      return 'Face ID';
    case 'TouchID':
      return 'Touch ID';
    default:
      return 'biometrics';
  }
}

export default function UsScreen() {
  const user = getAuth().currentUser;
  const hydrated = useBiometricLockStore(state => state.hydrated);
  const biometricEnabled = useBiometricLockStore(state => state.enabled);
  const biometricAvailable = useBiometricLockStore(state => state.available);
  const biometryType = useBiometricLockStore(state => state.biometryType);
  const setBiometricEnabled = useBiometricLockStore(state => state.setEnabled);
  const setBiometricAvailability = useBiometricLockStore(state => state.setAvailability);
  const relationshipSyncing = useRelationshipStore(state => state.syncing);
  const relationshipError = useRelationshipStore(state => state.error);
  const profile = useRelationshipStore(state => state.profile);
  const incomingInvites = useRelationshipStore(state => state.incomingInvites);
  const outgoingInvite = useRelationshipStore(state => state.outgoingInvite);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [respondingInviteId, setRespondingInviteId] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState('');
  const biometricLabel = getBiometricLabel(biometryType);
  const trimmedInviteEmail = inviteEmail.trim();
  const inviteEmailError = trimmedInviteEmail.length > 0 && !EMAIL_REGEX.test(trimmedInviteEmail);

  const initials = useMemo(() => {
    const source = user?.email ?? 'H2';
    return source.slice(0, 2).toUpperCase();
  }, [user?.email]);

  const biometricDescription = useMemo(() => {
    if (!hydrated) {
      return 'Checking this device for supported unlock methods.';
    }

    if (!biometricAvailable) {
      return 'Set up Face ID, Touch ID, or biometrics on this device to turn on quick secure unlock.';
    }

    return `Use ${biometricLabel} to reopen the app whenever you come back to your Love Space.`;
  }, [biometricAvailable, biometricLabel, hydrated]);

  const relationshipDescription = useMemo(() => {
    if (relationshipSyncing && !profile) {
      return 'Syncing your relationship space...';
    }

    if (profile?.coupleId) {
      return `Connected with ${profile.partnerEmail ?? 'your partner'} for shared mirror notes.`;
    }

    if (outgoingInvite) {
      return `Invite sent to ${outgoingInvite.toEmail}. They can accept it from their Us tab.`;
    }

    if (incomingInvites.length > 0) {
      return 'A partner invite is waiting for you below.';
    }

    return 'Invite your partner by email to turn mirror notes into a live shared thread.';
  }, [incomingInvites.length, outgoingInvite, profile, relationshipSyncing]);

  const handleBiometricToggle = async (nextValue: boolean) => {
    setBiometricLoading(true);

    try {
      if (nextValue) {
        const result = await rnBiometrics.isSensorAvailable();
        const available = result.available;
        const nextBiometryType = result.biometryType ?? null;

        setBiometricAvailability(available, nextBiometryType);

        if (!available) {
          setSnackbar('Set up biometrics on this device first, then try again.');
          return;
        }
      }

      await AsyncStorage.setItem(BIOMETRIC_LOCK_STORAGE_KEY, String(nextValue));
      setBiometricEnabled(nextValue);
      setSnackbar(nextValue ? `${biometricLabel} unlock is on.` : 'Biometric unlock is off.');
    } catch (error: any) {
      setSnackbar(error.message ?? 'Unable to update biometric unlock right now.');
    } finally {
      setBiometricLoading(false);
    }
  };

  const handleSendInvite = async () => {
    if (!user) {
      setSnackbar('Sign in again to invite your partner.');
      return;
    }

    if (!trimmedInviteEmail || inviteEmailError) {
      setSnackbar('Enter a valid partner email first.');
      return;
    }

    setInviteLoading(true);

    try {
      const result = await sendPartnerInvite(user, trimmedInviteEmail);
      setInviteEmail('');
      setSnackbar(result.deliveryErrorMessage ?? 'Partner invite sent.');
    } catch (error: any) {
      setSnackbar(error.message ?? 'Unable to send that partner invite right now.');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleAcceptInvite = async (inviteId: string) => {
    if (!user) {
      setSnackbar('Sign in again to accept that invite.');
      return;
    }

    setRespondingInviteId(inviteId);

    try {
      await acceptPartnerInvite(user, inviteId);
      setSnackbar('You are now connected with your partner.');
    } catch (error: any) {
      setSnackbar(error.message ?? 'Unable to accept that partner invite right now.');
    } finally {
      setRespondingInviteId(null);
    }
  };

  const handleDeclineInvite = async (inviteId: string) => {
    setRespondingInviteId(inviteId);

    try {
      await declinePartnerInvite(inviteId);
      setSnackbar('Partner invite declined.');
    } catch (error: any) {
      setSnackbar(error.message ?? 'Unable to decline that partner invite right now.');
    } finally {
      setRespondingInviteId(null);
    }
  };

  const handleCancelInvite = async () => {
    if (!outgoingInvite) {
      return;
    }

    setInviteLoading(true);

    try {
      await cancelPartnerInvite(outgoingInvite.id);
      setSnackbar('Partner invite cancelled.');
    } catch (error: any) {
      setSnackbar(error.message ?? 'Unable to cancel that partner invite right now.');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await signOut(getAuth());
      setDialogVisible(false);
    } catch (error: any) {
      setSnackbar(error.message ?? 'Unable to sign out right now.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SafeAreaView style={styles.screen} edges={['top']}>
        <ScrollView contentInsetAdjustmentBehavior="never" style={styles.scrollView} contentContainerStyle={styles.content}>
          <Text variant="headlineMedium" style={styles.header}>
            Us
          </Text>
          <Text style={styles.subheader}>
            Your private relationship space, settings, and account controls.
          </Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryPill}>
              <Text style={styles.summaryLabel}>{profile?.coupleId ? 'Connected' : 'Solo'}</Text>
            </View>
            <View style={styles.summaryPill}>
              <Text style={styles.summaryLabel}>Invites {incomingInvites.length + (outgoingInvite ? 1 : 0)}</Text>
            </View>
            <View style={styles.summaryPill}>
              <Text style={styles.summaryLabel}>{biometricEnabled ? 'Lock on' : 'Lock off'}</Text>
            </View>
            <View style={styles.summaryPill}>
              <Text style={styles.summaryLabel}>{user?.emailVerified ? 'Verified' : 'Pending'}</Text>
            </View>
          </View>
          <Surface style={styles.hero} elevation={0}>
            <Avatar.Text size={60} label={initials} color="#FFF3EA" style={styles.avatar} />
            <View style={styles.heroTextWrap}>
              <Text variant="titleMedium" style={styles.heroTitle}>
                Your account
              </Text>
              <Text style={styles.heroText}>{user?.email ?? 'Signed in'}</Text>
              <Text style={styles.heroMeta}>
                {user?.emailVerified ? 'Verified email' : 'Verification pending'}
              </Text>
            </View>
          </Surface>
          <Card style={styles.card}>
            <Card.Content style={styles.cardContent}>
              <Text variant="titleMedium" style={styles.cardTitle}>
                Relationship connection
              </Text>
              <Paragraph style={styles.cardBody}>{relationshipDescription}</Paragraph>
              {!!relationshipError ? <Text style={styles.errorText}>{relationshipError}</Text> : null}
              {!profile?.coupleId && !outgoingInvite ? (
                <>
                  <Divider style={styles.divider} />
                  <TextInput
                    mode="outlined"
                    label="Partner email"
                    value={inviteEmail}
                    onChangeText={setInviteEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    disabled={inviteLoading || relationshipSyncing}
                    error={inviteEmailError}
                    style={styles.input}
                    outlineStyle={styles.inputOutline}
                    outlineColor="#E7C9BF"
                    activeOutlineColor="#D79395"
                  />
                  <Button
                    mode="contained"
                    onPress={() => void handleSendInvite()}
                    loading={inviteLoading}
                    disabled={inviteLoading || relationshipSyncing || inviteEmailError}
                    style={styles.actionButton}
                    buttonColor="#B25B63"
                    textColor="#FFF8F3"
                  >
                    Send partner invite
                  </Button>
                </>
              ) : null}
              {!!outgoingInvite && !profile?.coupleId ? (
                <>
                  <Divider style={styles.divider} />
                  <Text style={styles.preferenceBody}>Pending invite for {outgoingInvite.toEmail}</Text>
                  <Button
                    mode="outlined"
                    onPress={() => void handleCancelInvite()}
                    loading={inviteLoading}
                    disabled={inviteLoading}
                    style={styles.actionButton}
                  >
                    Cancel invite
                  </Button>
                </>
              ) : null}
              {incomingInvites.length > 0 && !profile?.coupleId ? (
                <>
                  <Divider style={styles.divider} />
                  <Text variant="titleSmall" style={styles.preferenceTitle}>
                    Incoming partner invite
                  </Text>
                  {incomingInvites.map(invite => (
                    <View key={invite.id} style={styles.inviteCard}>
                      <Text style={styles.preferenceBody}>From {invite.fromEmail}</Text>
                      <View style={styles.inviteActionsRow}>
                        <Button
                          mode="contained"
                          onPress={() => void handleAcceptInvite(invite.id)}
                          loading={respondingInviteId === invite.id}
                          disabled={!!respondingInviteId}
                          style={styles.primarySmallButton}
                          buttonColor="#B25B63"
                          textColor="#FFF8F3"
                        >
                          Accept
                        </Button>
                        <Button
                          mode="text"
                          onPress={() => void handleDeclineInvite(invite.id)}
                          disabled={!!respondingInviteId}
                        >
                          Decline
                        </Button>
                      </View>
                    </View>
                  ))}
                </>
              ) : null}
            </Card.Content>
          </Card>
          <Card style={styles.archiveCard}>
            <Card.Content style={styles.cardContent}>
              <Text variant="titleMedium" style={styles.cardTitle}>
                Account & Privacy
              </Text>
              <Paragraph style={styles.cardBody}>
                Manage sign-in, privacy preferences, and access to your shared Love Space.
              </Paragraph>
              <Divider style={styles.divider} />
              <View style={styles.preferenceRow}>
                <View style={styles.preferenceTextWrap}>
                  <Text variant="titleSmall" style={styles.preferenceTitle}>
                    Biometric unlock
                  </Text>
                  <Text style={styles.preferenceBody}>{biometricDescription}</Text>
                </View>
                <Switch
                  value={biometricEnabled}
                  onValueChange={value => void handleBiometricToggle(value)}
                  disabled={!hydrated || biometricLoading}
                />
              </View>
              <Divider style={styles.divider} />
              <Button
                mode="outlined"
                icon="logout"
                onPress={() => setDialogVisible(true)}
                disabled={loading}
                style={styles.signOutButton}
              >
                Sign Out
              </Button>
            </Card.Content>
          </Card>
        </ScrollView>
      </SafeAreaView>
      <Portal>
        <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)} style={styles.dialog}>
          <Dialog.Title>Sign out?</Dialog.Title>
          <Dialog.Content>
            <Paragraph>
              You will return to the secure welcome flow and need to sign in again to access your Love Space.
            </Paragraph>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialogVisible(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onPress={handleSignOut} loading={loading} disabled={loading}>
              Sign Out
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <Snackbar
        visible={!!snackbar}
        onDismiss={() => setSnackbar('')}
        duration={4000}
        style={styles.snackbar}
      >
        {snackbar}
      </Snackbar>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFF3EA',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingTop: 10,
    paddingHorizontal: 18,
    paddingBottom: 32,
    gap: 12,
  },
  header: {
    color: '#3F2831',
    fontWeight: '700',
  },
  subheader: {
    color: '#3F2831',
    lineHeight: 21,
    opacity: 0.76,
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  summaryPill: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    backgroundColor: '#FFF8F4',
    borderWidth: 1,
    borderColor: '#F2D3C7',
  },
  summaryLabel: {
    color: '#7C5964',
    fontSize: 11,
    fontWeight: '700',
  },
  hero: {
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F6D3C7',
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    backgroundColor: '#B25B63',
  },
  heroTextWrap: {
    marginLeft: 14,
    flex: 1,
  },
  heroTitle: {
    color: '#3F2831',
    fontWeight: '700',
  },
  heroText: {
    marginTop: 4,
    color: '#3F2831',
    opacity: 0.82,
  },
  heroMeta: {
    marginTop: 4,
    color: '#B25B63',
    fontWeight: '600',
  },
  card: {
    borderRadius: 24,
    backgroundColor: '#F8E2D8',
  },
  archiveCard: {
    borderRadius: 24,
    backgroundColor: '#FFF7F2',
  },
  cardContent: {
    gap: 10,
  },
  cardTitle: {
    color: '#3F2831',
    fontWeight: '700',
  },
  cardBody: {
    color: '#7C5964',
    lineHeight: 20,
  },
  errorText: {
    color: '#B25B63',
    fontWeight: '600',
  },
  divider: {
    marginVertical: 14,
  },
  input: {
    backgroundColor: '#FFF9F5',
  },
  inputOutline: {
    borderRadius: 18,
    borderWidth: 1,
  },
  actionButton: {
    marginTop: 12,
    borderRadius: 14,
  },
  inviteCard: {
    marginTop: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#FFF8F3',
    borderWidth: 1,
    borderColor: '#F0DED4',
  },
  inviteActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  primarySmallButton: {
    borderRadius: 12,
  },
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  preferenceTextWrap: {
    flex: 1,
  },
  preferenceTitle: {
    color: '#3F2831',
    fontWeight: '700',
  },
  preferenceBody: {
    marginTop: 6,
    color: '#7C5964',
    lineHeight: 20,
  },
  signOutButton: {
    borderRadius: 14,
  },
  dialog: {
    backgroundColor: '#FFF7F2',
  },
  snackbar: {
    margin: 16,
    borderRadius: 12,
  },
});
