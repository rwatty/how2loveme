import React, { useMemo, useRef, useState } from 'react';
import { type LayoutChangeEvent, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAuth } from '@react-native-firebase/auth';
import { Button, Card, Paragraph, Snackbar, Surface, Text, TextInput } from 'react-native-paper';
import MirrorCanvas from '../MirrorCanvas';
import JumpToSectionFab, { type JumpSection } from '../components/JumpToSectionFab';
import { LOVE_NOTE_PROMPTS, LOVE_NOTE_TAG_LABELS, LOVE_NOTE_TYPE_LABELS } from '../lib/loveNotes';
import { LOVE_AREA_LABELS, LOVE_LIBRARY_GOAL_LABELS, LOVE_LIBRARY_ITEMS } from '../lib/loveLibrary';
import { disableNotifications, enableNotifications } from '../lib/notifications';
import {
  deleteMirrorMessage,
  respondToLoveActionProposal,
  sendLoveActionReminder,
  transitionLoveActionStatus,
  type LoveActionAppreciationReaction,
  type LoveActionConfirmationReaction,
} from '../lib/relationshipSync';
import { MainTabParamList } from '../navigation/MainNavigator';
import { type LoveAction, useLoveActionStore } from '../store/useLoveActionStore';
import { useLoveDraftStore } from '../store/useLoveDraftStore';
import { type MirrorMessage, useMirrorMessageStore } from '../store/useMirrorMessageStore';
import { useNotificationStore } from '../store/useNotificationStore';
import { useRelationshipStore } from '../store/useRelationshipStore';

const CONFIRMATION_REACTIONS: Array<{ value: LoveActionConfirmationReaction; label: string }> = [
  { value: 'yep', label: 'Yep' },
  { value: 'lovedIt', label: 'Loved it' },
  { value: 'letsTryAgain', label: 'Try again' },
];
const APPRECIATION_REACTIONS: Array<{ value: LoveActionAppreciationReaction; label: string }> = [
  { value: 'thankYou', label: 'Thank you' },
  { value: 'madeMyDay', label: 'Made my day' },
  { value: 'morePlease', label: 'More please' },
];
const HOME_JUMP_SECTIONS: JumpSection[] = [
  { key: 'loveNotes', label: 'Love Notes' },
  { key: 'library', label: 'Library Nudges' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'reminders', label: 'Reminders' },
  { key: 'proposals', label: 'Proposals' },
  { key: 'actions', label: 'Active Actions' },
  { key: 'archive', label: 'Love Note Archive' },
];

function getRelativeTime(createdAt: number) {
  const diffMinutes = Math.max(1, Math.round((Date.now() - createdAt) / 60000));

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  return `${Math.round(diffHours / 24)}d ago`;
}

function getRevealLabel(progress: number) {
  if (progress >= 1) {
    return 'Love Note revealed';
  }

  if (progress >= 0.45) {
    return 'Keep clearing the steam';
  }

  return 'Swipe across the mirror to reveal the Love Note';
}

function formatDueLabel(nextDueAt: number | null) {
  if (!nextDueAt) {
    return 'No due time set';
  }

  return new Date(nextDueAt).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getReminderTimeLabel(targetAt: number) {
  const diffHours = Math.round((targetAt - Date.now()) / (60 * 60 * 1000));

  if (diffHours <= 0) {
    return 'Now';
  }

  if (diffHours < 24) {
    return `In ${diffHours}h`;
  }

  return `In ${Math.round(diffHours / 24)}d`;
}

function getActionStatusLabel(action: LoveAction) {
  switch (action.status) {
    case 'proposed':
      return 'Waiting for your response';
    case 'scheduled':
      return 'Accepted and ready to move toward due';
    case 'due':
      return 'Ready to be done now';
    case 'performed':
      return 'Waiting for confirmation';
    case 'confirmed':
      return 'Confirmed and ready for appreciation';
    case 'appreciated':
      return 'Completed and appreciated';
    case 'needsAttention':
      return 'Needs a gentler rework';
    case 'cancelled':
      return 'Cancelled';
    default:
      return 'In progress';
  }
}

function getActionDirection(action: LoveAction, currentUserId?: string) {
  if (action.responsibleUserId === currentUserId) {
    return `You → ${action.recipientUserEmail}`;
  }

  return `${action.responsibleUserEmail} → You`;
}

function ChoiceButtons({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.choiceRow}>
      {options.map(option => {
        const selected = option.value === value;

        return (
          <Button
            key={option.value}
            mode={selected ? 'contained' : 'outlined'}
            compact
            onPress={() => onChange(option.value)}
            style={styles.choiceButton}
            buttonColor={selected ? '#B25B63' : undefined}
            textColor={selected ? '#FFF8F3' : '#5B4148'}
          >
            {option.label}
          </Button>
        );
      })}
    </View>
  );
}

export default function HomeScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const user = getAuth().currentUser;
  const profile = useRelationshipStore(state => state.profile);
  const partnerReveal = useRelationshipStore(state => state.partnerReveal);
  const relationshipSyncing = useRelationshipStore(state => state.syncing);
  const relationshipError = useRelationshipStore(state => state.error);
  const hydrated = useMirrorMessageStore(state => state.hydrated);
  const syncing = useMirrorMessageStore(state => state.syncing);
  const messages = useMirrorMessageStore(state => state.messages);
  const selectedMessageId = useMirrorMessageStore(state => state.selectedMessageId);
  const selectMessage = useMirrorMessageStore(state => state.selectMessage);
  const setRevealProgress = useMirrorMessageStore(state => state.setRevealProgress);
  const loveActionsHydrated = useLoveActionStore(state => state.hydrated);
  const loveActionsSyncing = useLoveActionStore(state => state.syncing);
  const loveActions = useLoveActionStore(state => state.actions);
  const queueLibraryItem = useLoveDraftStore(state => state.queueLibraryItem);
  const queueNotePrompt = useLoveDraftStore(state => state.queueNotePrompt);
  const notificationsEnabled = useNotificationStore(state => state.enabled);
  const notificationPermission = useNotificationStore(state => state.permission);
  const notificationToken = useNotificationStore(state => state.token);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [mirrorGestureActive, setMirrorGestureActive] = useState(false);
  const [screenError, setScreenError] = useState('');
  const [snackbar, setSnackbar] = useState('');
  const [respondingActionId, setRespondingActionId] = useState<string | null>(null);
  const [transitioningActionId, setTransitioningActionId] = useState<string | null>(null);
  const [notificationBusy, setNotificationBusy] = useState(false);
  const [remindingActionId, setRemindingActionId] = useState<string | null>(null);
  const [sectionOffsets, setSectionOffsets] = useState<Record<string, number>>({});
  const [confirmationReactionDrafts, setConfirmationReactionDrafts] = useState<Record<string, LoveActionConfirmationReaction>>({});
  const scrollViewRef = useRef<any>(null);
  const [confirmationNoteDrafts, setConfirmationNoteDrafts] = useState<Record<string, string>>({});
  const [appreciationReactionDrafts, setAppreciationReactionDrafts] = useState<Record<string, LoveActionAppreciationReaction>>({});
  const [appreciationNoteDrafts, setAppreciationNoteDrafts] = useState<Record<string, string>>({});

  const selectedMessage = useMemo(() => {
    if (messages.length === 0) {
      return null;
    }

    return messages.find(message => message.id === selectedMessageId) ?? messages[0];
  }, [messages, selectedMessageId]);

  const ownMessagesCount = useMemo(
    () => messages.filter(message => message.senderId === user?.uid).length,
    [messages, user?.uid],
  );
  const revealedCount = useMemo(
    () => messages.filter(message => message.revealProgress >= 1).length,
    [messages],
  );
  const suggestedLibraryItems = useMemo(() => {
    const highlightedAreas = partnerReveal?.highlightAreas ?? [];
    const matchingAreas = LOVE_LIBRARY_ITEMS.filter(item => highlightedAreas.includes(item.area));
    const fallbackItems = LOVE_LIBRARY_ITEMS.filter(item => item.featured && !highlightedAreas.includes(item.area));
    return [...matchingAreas, ...fallbackItems].slice(0, 4);
  }, [partnerReveal?.highlightAreas]);
  const pendingProposalInbox = useMemo(
    () => loveActions.filter(action => action.recipientUserId === user?.uid && action.status === 'proposed'),
    [loveActions, user?.uid],
  );
  const activeLoveActions = useMemo(
    () =>
      loveActions.filter(
        action =>
          action.status === 'scheduled'
          || action.status === 'due'
          || action.status === 'performed'
          || action.status === 'confirmed'
          || action.status === 'appreciated'
          || action.status === 'needsAttention',
      ),
    [loveActions],
  );
  const reminderFeed = useMemo(() => {
    const now = Date.now();

    return loveActions
      .flatMap(action => {
        const reminders: Array<{
          id: string;
          kind: 'dueSoon' | 'dueNow' | 'appreciatedFollowUp';
          title: string;
          body: string;
          targetAt: number;
        }> = [];

        if (
          action.nextDueAt
          && (action.status === 'scheduled' || action.status === 'due')
          && action.nextDueAt <= now + 48 * 60 * 60 * 1000
        ) {
          reminders.push({
            id: `${action.id}-due`,
            kind: action.nextDueAt <= now ? 'dueNow' : 'dueSoon',
            title: action.title,
            body:
              action.responsibleUserId === user?.uid
                ? 'This Love Action needs your follow-through soon.'
                : 'Your partner has a Love Action coming due soon.',
            targetAt: action.nextDueAt,
          });
        }

        if (
          action.nextDueAt
          && action.status === 'appreciated'
          && action.nextDueAt >= now
          && action.nextDueAt <= now + 14 * 24 * 60 * 60 * 1000
        ) {
          reminders.push({
            id: `${action.id}-appreciated-follow-up`,
            kind: 'appreciatedFollowUp',
            title: action.title,
            body:
              action.appreciationReaction === 'morePlease'
                ? 'This was appreciated and your partner wants more of it soon.'
                : action.appreciationReaction === 'madeMyDay'
                  ? 'This clearly landed well — a good ritual to revisit.'
                  : 'This was appreciated — consider bringing it back with intention.',
            targetAt: action.nextDueAt,
          });
        }

        return reminders;
      })
      .sort((left, right) => left.targetAt - right.targetAt)
      .slice(0, 6);
  }, [loveActions, user?.uid]);
  const dueCount = useMemo(
    () => loveActions.filter(action => action.status === 'due' && action.responsibleUserId === user?.uid).length,
    [loveActions, user?.uid],
  );

  const openLibrarySuggestion = (libraryItemId: string) => {
    queueLibraryItem(libraryItemId);
    navigation.navigate('Love');
  };

  const openLoveNotePrompt = (notePromptId: string) => {
    queueNotePrompt(notePromptId);
    navigation.navigate('Love');
  };

  const handleDeleteMessage = async (message: MirrorMessage) => {
    if (!user) {
      return;
    }

    setDeletingMessageId(message.id);
    setScreenError('');

    try {
      await deleteMirrorMessage(user, message);
    } catch (error: any) {
      setScreenError(error.message ?? 'Unable to delete this Love Note right now.');
    } finally {
      setDeletingMessageId(null);
    }
  };

  const handleRespondToProposal = async (actionId: string, response: 'accept' | 'decline') => {
    if (!user) {
      setSnackbar('Sign in again to respond to this Love Action.');
      return;
    }

    setRespondingActionId(actionId);

    try {
      const result = await respondToLoveActionProposal(user, actionId, response);
      setSnackbar(
        result.status === 'scheduled'
          ? 'Love Action accepted and ready to schedule.'
          : 'Love Action sent back for a gentler rework.',
      );
    } catch (error: any) {
      setSnackbar(error.message ?? 'Unable to respond to this Love Action right now.');
    } finally {
      setRespondingActionId(null);
    }
  };

  const handleNotificationToggle = async (enable: boolean) => {
    if (!user) {
      setSnackbar('Sign in again to manage device notifications.');
      return;
    }

    setNotificationBusy(true);

    try {
      if (enable) {
        await enableNotifications(user);
        setSnackbar('Device reminders enabled.');
      } else {
        await disableNotifications(user);
        setSnackbar('Device reminders turned off.');
      }
    } catch (error: any) {
      setSnackbar(error.message ?? 'Unable to update notification settings right now.');
    } finally {
      setNotificationBusy(false);
    }
  };

  const handleSendPartnerReminder = async (action: LoveAction) => {
    if (!user) {
      setSnackbar('Sign in again to send a partner reminder.');
      return;
    }

    setRemindingActionId(action.id);

    try {
      const result = await sendLoveActionReminder(user, action.id);
      setSnackbar(
        result.deliveredCount > 0
          ? 'Reminder sent to your partner.'
          : 'No registered partner device token was available yet.',
      );
    } catch (error: any) {
      setSnackbar(error.message ?? 'Unable to send that reminder right now.');
    } finally {
      setRemindingActionId(null);
    }
  };

  const handleLifecycleTransition = async (
    action: LoveAction,
    targetStatus: 'due' | 'performed' | 'confirmed' | 'appreciated',
    successMessage: string,
  ) => {
    if (!user) {
      setSnackbar('Sign in again to update this Love Action.');
      return;
    }

    setTransitioningActionId(action.id);

    try {
      await transitionLoveActionStatus(
        user,
        action.id,
        targetStatus,
        targetStatus === 'confirmed'
          ? {
              confirmationReaction: confirmationReactionDrafts[action.id],
              confirmationNote: confirmationNoteDrafts[action.id] ?? '',
            }
          : targetStatus === 'appreciated'
            ? {
                appreciationReaction: appreciationReactionDrafts[action.id],
                appreciationNote: appreciationNoteDrafts[action.id] ?? '',
              }
            : undefined,
      );
      setConfirmationNoteDrafts(current => ({ ...current, [action.id]: '' }));
      setAppreciationNoteDrafts(current => ({ ...current, [action.id]: '' }));
      setSnackbar(successMessage);
    } catch (error: any) {
      setSnackbar(error.message ?? 'Unable to update this Love Action right now.');
    } finally {
      setTransitioningActionId(null);
    }
  };

  const registerSection = (key: string) => ({ nativeEvent: { layout } }: LayoutChangeEvent) => {
    const nextY = layout.y;
    setSectionOffsets(current => (current[key] === nextY ? current : { ...current, [key]: nextY }));
  };

  const visibleJumpSections = HOME_JUMP_SECTIONS.filter(section => sectionOffsets[section.key] !== undefined);

  const handleJumpToSection = (key: string) => {
    const targetY = sectionOffsets[key];

    if (typeof targetY === 'number') {
      scrollViewRef.current?.scrollTo({ y: Math.max(0, targetY - 12), animated: true });
    }
  };

  const summaryRow = (
    <View style={styles.summaryRow}>
      <View style={styles.summaryPill}>
        <Text style={styles.summaryLabel}>Shared {messages.length}</Text>
      </View>
      <View style={styles.summaryPill}>
        <Text style={styles.summaryLabel}>Yours {ownMessagesCount}</Text>
      </View>
      <View style={styles.summaryPill}>
        <Text style={styles.summaryLabel}>Revealed {revealedCount}</Text>
      </View>
      <View style={styles.summaryPill}>
        <Text style={styles.summaryLabel}>Due {dueCount}</Text>
      </View>
      <View style={styles.summaryPill}>
        <Text style={styles.summaryLabel}>Reminders {reminderFeed.length}</Text>
      </View>
      <View style={styles.summaryPill}>
        <Text style={styles.summaryLabel}>Awaiting you {pendingProposalInbox.length}</Text>
      </View>
      <View style={styles.summaryPill}>
        <Text style={styles.summaryLabel}>{profile?.coupleId ? 'Connected' : 'Solo'}</Text>
      </View>
    </View>
  );

  if (!hydrated || relationshipSyncing) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <ScrollView contentInsetAdjustmentBehavior="never" style={styles.scrollView} contentContainerStyle={styles.content}>
          <Text variant="headlineMedium" style={styles.header}>
            Home
          </Text>
          <Text style={styles.subheader}>Warming your Love Notes and syncing your shared space.</Text>
          {summaryRow}
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!profile?.coupleId) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <ScrollView contentInsetAdjustmentBehavior="never" style={styles.scrollView} contentContainerStyle={styles.content}>
          <Text variant="headlineMedium" style={styles.header}>
            Home
          </Text>
          <Text style={styles.subheader}>
            Connect with your partner in Us to unlock shared Love Notes and live sync.
          </Text>
          {summaryRow}
          <Surface style={styles.emptyHero} elevation={0}>
            <Text variant="titleMedium" style={styles.emptyTitle}>
              Your Love Notes are waiting
            </Text>
            <Text style={styles.emptyBody}>
              Send a partner invite by email from Us, then your Love Notes and Love Actions will sync across both accounts.
            </Text>
            <Button mode="contained" onPress={() => navigation.navigate('Us')} style={styles.primaryButton}>
              Connect in Us
            </Button>
          </Surface>
          {!!relationshipError && <Text style={styles.errorText}>{relationshipError}</Text>}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <>
      <SafeAreaView style={styles.screen} edges={['top']}>
        <ScrollView
          ref={scrollViewRef}
          contentInsetAdjustmentBehavior="never"
          keyboardShouldPersistTaps="handled"
          scrollEnabled={!mirrorGestureActive}
          style={styles.scrollView}
          contentContainerStyle={styles.content}
        >
          <Text variant="headlineMedium" style={styles.header}>
            Home
          </Text>
          <Text style={styles.subheader}>
            See what needs love today, answer shared proposals, and keep your Love Notes close by.
          </Text>
          {summaryRow}
          {!!relationshipError && <Text style={styles.errorText}>{relationshipError}</Text>}
          {!!screenError && <Text style={styles.errorText}>{screenError}</Text>}
          {!loveActionsHydrated || loveActionsSyncing ? (
            <Text style={styles.syncText}>Syncing shared Love Actions...</Text>
          ) : null}
          <View onLayout={registerSection('loveNotes')}>
            <Card style={styles.card}>
              <Card.Content style={styles.cardContent}>
                <Text variant="titleMedium" style={styles.cardTitle}>
                  Love Notes
                </Text>
                <Paragraph style={styles.cardBody}>
                  Keep a lightweight stream of warmth alive between you. Use a prompt, reply to the latest note, or open the archive below.
                </Paragraph>
                <View style={styles.summaryRow}>
                  <View style={styles.summaryPill}>
                    <Text style={styles.summaryLabel}>Shared {messages.length}</Text>
                  </View>
                  <View style={styles.summaryPill}>
                    <Text style={styles.summaryLabel}>Revealed {revealedCount}</Text>
                  </View>
                  <View style={styles.summaryPill}>
                    <Text style={styles.summaryLabel}>Prompts {LOVE_NOTE_PROMPTS.length}</Text>
                  </View>
                </View>
                {selectedMessage ? (
                  <Surface style={styles.actionItem} elevation={0}>
                    <Text style={styles.actionTitle}>{selectedMessage.text || 'Finger-drawn Love Note'}</Text>
                    <Text style={styles.actionMeta}>
                      {selectedMessage.senderId === user?.uid ? 'From you' : `From ${selectedMessage.senderEmail}`} · {getRelativeTime(selectedMessage.createdAt)}
                    </Text>
                    <Text style={styles.actionMeta}>
                      {LOVE_NOTE_TYPE_LABELS[selectedMessage.noteType]} · {selectedMessage.tags.map(tag => LOVE_NOTE_TAG_LABELS[tag]).join(' · ') || 'No tags'}
                    </Text>
                    <View style={styles.actionsRow}>
                      <Button mode="contained-tonal" onPress={() => navigation.navigate('Love')}>
                        Reply in Love
                      </Button>
                      <Button mode="text" onPress={() => setRevealProgress(selectedMessage.id, 0)}>
                        Reset reveal
                      </Button>
                    </View>
                  </Surface>
                ) : null}
                <View style={styles.actionList}>
                  {LOVE_NOTE_PROMPTS.slice(0, 3).map(prompt => (
                    <Surface key={prompt.id} style={styles.actionItem} elevation={0}>
                      <Text style={styles.actionTitle}>{prompt.label}</Text>
                      <Text style={styles.actionMeta}>{prompt.prompt}</Text>
                      <Button mode="contained-tonal" onPress={() => openLoveNotePrompt(prompt.id)}>
                        Write in Love
                      </Button>
                    </Surface>
                  ))}
                </View>
              </Card.Content>
            </Card>
          </View>
          <View onLayout={registerSection('library')}>
            <Card style={styles.card}>
              <Card.Content style={styles.cardContent}>
                <Text variant="titleMedium" style={styles.cardTitle}>
                  Love Library nudges
                </Text>
                <Paragraph style={styles.cardBody}>
                  Turn your partner’s current cues into something actionable, whether it is reassurance, play, support, or closeness.
                </Paragraph>
                {suggestedLibraryItems.length === 0 ? (
                  <Text style={styles.archiveHint}>Your curated Love Library picks will appear here as your shared space grows.</Text>
                ) : (
                  <View style={styles.actionList}>
                    {suggestedLibraryItems.map(item => (
                      <Surface key={item.id} style={styles.actionItem} elevation={0}>
                        <Text style={styles.actionTitle}>{item.title}</Text>
                        <Text style={styles.actionMeta}>{item.description}</Text>
                        <Text style={styles.actionMeta}>
                          {LOVE_AREA_LABELS[item.area]} · {LOVE_LIBRARY_GOAL_LABELS[item.goal]}
                        </Text>
                        <Button mode="contained-tonal" onPress={() => openLibrarySuggestion(item.id)}>
                          Load in Love
                        </Button>
                      </Surface>
                    ))}
                  </View>
                )}
              </Card.Content>
            </Card>
          </View>
          <View onLayout={registerSection('notifications')}>
            <Card style={styles.card}>
              <Card.Content style={styles.cardContent}>
                <Text variant="titleMedium" style={styles.cardTitle}>
                  Device notifications
                </Text>
                <Paragraph style={styles.cardBody}>
                  Turn on local reminders for your due Love Actions and optionally register this device for partner push reminders.
                </Paragraph>
                <Text style={styles.actionMeta}>
                  Status: {notificationsEnabled ? 'Enabled' : 'Off'} · Permission: {notificationPermission} · Push token: {notificationToken ? 'Registered' : 'Missing'}
                </Text>
                <View style={styles.actionsRow}>
                  <Button
                    mode="contained"
                    onPress={() => void handleNotificationToggle(true)}
                    disabled={notificationBusy}
                    loading={notificationBusy && !notificationsEnabled}
                    style={styles.primaryButton}
                  >
                    Enable reminders
                  </Button>
                  <Button
                    mode="outlined"
                    onPress={() => void handleNotificationToggle(false)}
                    disabled={notificationBusy || !notificationsEnabled}
                  >
                    Turn off
                  </Button>
                </View>
              </Card.Content>
            </Card>
          </View>
          <View onLayout={registerSection('reminders')}>
            <Card style={styles.card}>
              <Card.Content style={styles.cardContent}>
                <Text variant="titleMedium" style={styles.cardTitle}>
                  Gentle reminders
                </Text>
                <Paragraph style={styles.cardBody}>
                  A live in-app reminder feed based on appreciated rituals and Love Actions coming due soon.
                </Paragraph>
                {reminderFeed.length === 0 ? (
                  <Text style={styles.archiveHint}>No reminders right now.</Text>
                ) : (
                  <View style={styles.actionList}>
                    {reminderFeed.map(reminder => (
                      <Surface key={reminder.id} style={styles.actionItem} elevation={0}>
                        <Text style={styles.actionTitle}>{reminder.title}</Text>
                        <Text style={styles.actionMeta}>{reminder.body}</Text>
                        <Text style={styles.actionMeta}>
                          {getReminderTimeLabel(reminder.targetAt)} · {formatDueLabel(reminder.targetAt)}
                        </Text>
                        <View style={styles.actionsRow}>
                          <Button mode="contained-tonal" onPress={() => navigation.navigate('Calendar')}>
                            Open Calendar
                          </Button>
                          <Button mode="text" onPress={() => navigation.navigate('Love')}>
                            Open Love
                          </Button>
                        </View>
                      </Surface>
                    ))}
                  </View>
                )}
              </Card.Content>
            </Card>
          </View>
          <View onLayout={registerSection('proposals')}>
            <Card style={styles.card}>
              <Card.Content style={styles.cardContent}>
                <Text variant="titleMedium" style={styles.cardTitle}>
                  Proposal inbox
              </Text>
              <Paragraph style={styles.cardBody}>
                Shared Love Actions land here when your partner wants your agreement before they become active.
              </Paragraph>
              {pendingProposalInbox.length === 0 ? (
                <Text style={styles.archiveHint}>Nothing is waiting for your response right now.</Text>
              ) : (
                <View style={styles.actionList}>
                  {pendingProposalInbox.map(action => {
                    const busy = respondingActionId === action.id;

                    return (
                      <Surface key={action.id} style={styles.actionItem} elevation={0}>
                        <Text style={styles.actionTitle}>{action.title}</Text>
                        <Text style={styles.actionMeta}>{getActionDirection(action, user?.uid)}</Text>
                        <Text style={styles.actionMeta}>{getActionStatusLabel(action)}</Text>
                        <Text style={styles.actionMeta}>Due {formatDueLabel(action.nextDueAt)}</Text>
                        <View style={styles.actionsRow}>
                          <Button
                            mode="contained"
                            onPress={() => void handleRespondToProposal(action.id, 'accept')}
                            loading={busy}
                            disabled={busy}
                            style={styles.primaryButton}
                            buttonColor="#B25B63"
                            textColor="#FFF8F3"
                          >
                            Accept
                          </Button>
                          <Button
                            mode="outlined"
                            onPress={() => void handleRespondToProposal(action.id, 'decline')}
                            disabled={busy}
                          >
                            Rework
                          </Button>
                        </View>
                      </Surface>
                    );
                  })}
                </View>
              )}
              </Card.Content>
            </Card>
          </View>
          <View onLayout={registerSection('actions')}>
            <Card style={styles.archiveCard}>
              <Card.Content>
                <View style={styles.archiveHeaderRow}>
                  <View>
                    <Text variant="titleMedium" style={styles.cardTitle}>
                      Active Love Actions
                  </Text>
                  <Text style={styles.archiveMeta}>
                    Move shared actions through due, done, confirmed, and appreciated.
                  </Text>
                </View>
              </View>
              {activeLoveActions.length === 0 ? (
                <Text style={styles.archiveHint}>Head to Love to build the first shared Love Action.</Text>
              ) : (
                <View style={styles.archiveList}>
                  {activeLoveActions.map(action => {
                    const busy = transitioningActionId === action.id;
                    const iAmResponsible = action.responsibleUserId === user?.uid;
                    const iAmRecipient = action.recipientUserId === user?.uid;

                    return (
                      <Card key={action.id} style={styles.archiveItem}>
                        <Card.Content style={styles.archiveItemContent}>
                          <View style={styles.archiveRow}>
                            <View style={styles.archiveTextWrap}>
                              <Text style={styles.archiveItemMeta}>{getActionDirection(action, user?.uid)}</Text>
                              <Text style={styles.archiveItemText} numberOfLines={2}>
                                {action.title}
                              </Text>
                              <Text style={styles.archiveHint}>{getActionStatusLabel(action)}</Text>
                              <Text style={styles.archiveHint}>Due {formatDueLabel(action.nextDueAt)}</Text>
                              {!!action.confirmationReaction || !!action.confirmationNote ? (
                                <Text style={styles.archiveHint}>
                                  Confirmation: {action.confirmationReaction ?? 'note only'}{action.confirmationNote ? ` · ${action.confirmationNote}` : ''}
                                </Text>
                              ) : null}
                              {!!action.appreciationReaction || !!action.appreciationNote ? (
                                <Text style={styles.archiveHint}>
                                  Appreciation: {action.appreciationReaction ?? 'note only'}{action.appreciationNote ? ` · ${action.appreciationNote}` : ''}
                                </Text>
                              ) : null}
                            </View>
                          </View>
                          {iAmRecipient && action.status === 'performed' ? (
                            <View style={styles.feedbackBlock}>
                              <Text style={styles.feedbackLabel}>Confirmation reaction</Text>
                              <ChoiceButtons
                                options={CONFIRMATION_REACTIONS}
                                value={confirmationReactionDrafts[action.id] ?? action.confirmationReaction ?? 'yep'}
                                onChange={value =>
                                  setConfirmationReactionDrafts(current => ({
                                    ...current,
                                    [action.id]: value as LoveActionConfirmationReaction,
                                  }))
                                }
                              />
                              <TextInput
                                mode="outlined"
                                label="Confirmation note"
                                value={confirmationNoteDrafts[action.id] ?? action.confirmationNote}
                                onChangeText={text =>
                                  setConfirmationNoteDrafts(current => ({
                                    ...current,
                                    [action.id]: text,
                                  }))
                                }
                                style={styles.noteInput}
                                outlineColor="#E7C9BF"
                                activeOutlineColor="#D79395"
                                placeholder="That landed well because..."
                              />
                            </View>
                          ) : null}
                          {iAmRecipient && (action.status === 'performed' || action.status === 'confirmed') ? (
                            <View style={styles.feedbackBlock}>
                              <Text style={styles.feedbackLabel}>Appreciation reaction</Text>
                              <ChoiceButtons
                                options={APPRECIATION_REACTIONS}
                                value={appreciationReactionDrafts[action.id] ?? action.appreciationReaction ?? 'thankYou'}
                                onChange={value =>
                                  setAppreciationReactionDrafts(current => ({
                                    ...current,
                                    [action.id]: value as LoveActionAppreciationReaction,
                                  }))
                                }
                              />
                              <TextInput
                                mode="outlined"
                                label="Appreciation note"
                                value={appreciationNoteDrafts[action.id] ?? action.appreciationNote}
                                onChangeText={text =>
                                  setAppreciationNoteDrafts(current => ({
                                    ...current,
                                    [action.id]: text,
                                  }))
                                }
                                style={styles.noteInput}
                                outlineColor="#E7C9BF"
                                activeOutlineColor="#D79395"
                                placeholder="Thank you for showing up like this."
                              />
                            </View>
                          ) : null}
                          <View style={styles.archiveActionsRow}>
                            {iAmRecipient && (action.status === 'scheduled' || action.status === 'due') ? (
                              <Button
                                mode="text"
                                onPress={() => void handleSendPartnerReminder(action)}
                                disabled={remindingActionId === action.id}
                                loading={remindingActionId === action.id}
                              >
                                Remind partner
                              </Button>
                            ) : null}
                            {iAmResponsible && (action.status === 'performed' || action.status === 'confirmed') ? (
                              <Button
                                mode="text"
                                onPress={() => void handleSendPartnerReminder(action)}
                                disabled={remindingActionId === action.id}
                                loading={remindingActionId === action.id}
                              >
                                Nudge partner
                              </Button>
                            ) : null}
                            {iAmResponsible && action.status === 'scheduled' ? (
                              <Button
                                mode="outlined"
                                onPress={() => void handleLifecycleTransition(action, 'due', 'Love Action moved into due.')}
                                disabled={busy}
                              >
                                Mark due
                              </Button>
                            ) : null}
                            {iAmResponsible && action.status === 'due' ? (
                              <Button
                                mode="contained"
                                onPress={() => void handleLifecycleTransition(action, 'performed', 'Love Action marked done.')}
                                loading={busy}
                                disabled={busy}
                              >
                                Mark done
                              </Button>
                            ) : null}
                            {iAmRecipient && action.status === 'performed' ? (
                              <>
                                <Button
                                  mode="outlined"
                                  onPress={() => void handleLifecycleTransition(action, 'confirmed', 'Love Action confirmed.')}
                                  disabled={busy}
                                >
                                  Confirm
                                </Button>
                                <Button
                                  mode="contained"
                                  onPress={() => void handleLifecycleTransition(action, 'appreciated', 'Love Action appreciated.')}
                                  loading={busy}
                                  disabled={busy}
                                >
                                  Appreciate
                                </Button>
                              </>
                            ) : null}
                            {iAmRecipient && action.status === 'confirmed' ? (
                              <Button
                                mode="contained"
                                onPress={() => void handleLifecycleTransition(action, 'appreciated', 'Love Action appreciated.')}
                                loading={busy}
                                disabled={busy}
                              >
                                Appreciate
                              </Button>
                            ) : null}
                            {(action.status === 'appreciated' || action.status === 'needsAttention') && !busy ? (
                              <Text style={styles.archiveHint}>{getActionStatusLabel(action)}</Text>
                            ) : null}
                          </View>
                        </Card.Content>
                      </Card>
                    );
                  })}
                </View>
              )}
              </Card.Content>
            </Card>
          </View>
          {selectedMessage ? (
            <Surface style={styles.hero} elevation={0}>
              <View style={styles.heroCopy}>
                <Text variant="titleMedium" style={styles.heroTitle}>
                  Love Note
                </Text>
                <Text style={styles.heroMeta}>
                  {selectedMessage.senderId === user?.uid ? 'From you' : `From ${selectedMessage.senderEmail}`} ·{' '}
                  {getRelativeTime(selectedMessage.createdAt)}
                </Text>
                <Text style={styles.actionMeta}>
                  {LOVE_NOTE_TYPE_LABELS[selectedMessage.noteType]} · {selectedMessage.tags.map(tag => LOVE_NOTE_TAG_LABELS[tag]).join(' · ') || 'No tags'}
                </Text>
              </View>
              <MirrorCanvas
                messageText={selectedMessage.text}
                strokes={selectedMessage.strokes}
                revealProgress={selectedMessage.revealProgress}
                onRevealProgressChange={progress => setRevealProgress(selectedMessage.id, progress)}
                onGestureActiveChange={setMirrorGestureActive}
                prompt={syncing ? 'Syncing your shared Love Notes...' : getRevealLabel(selectedMessage.revealProgress)}
              />
            </Surface>
          ) : (
            <Surface style={styles.emptyHero} elevation={0}>
              <Text variant="titleMedium" style={styles.emptyTitle}>
                No shared Love Notes yet
              </Text>
              <Text style={styles.emptyBody}>
                Your Love Actions can move ahead without waiting on a Love Note. Head to Love when you want to leave the first shared note too.
              </Text>
              <Button mode="contained" onPress={() => navigation.navigate('Love')} style={styles.primaryButton}>
                Open Love
              </Button>
            </Surface>
          )}
          {selectedMessage ? (
            <Card style={styles.card}>
              <Card.Content style={styles.cardContent}>
                <Text variant="titleMedium" style={styles.cardTitle}>
                  Current Love Note
                </Text>
                <Paragraph style={styles.cardBody}>
                  Reply with a new Love Note, reset the reveal, or remove a note you sent from the shared thread.
                </Paragraph>
                <View style={styles.actionsRow}>
                  <Button mode="contained" onPress={() => navigation.navigate('Love')} style={styles.primaryButton}>
                    Reply in Love
                  </Button>
                  <Button mode="outlined" onPress={() => setRevealProgress(selectedMessage.id, 0)}>
                    Reset reveal
                  </Button>
                </View>
                <Button
                  mode="text"
                  onPress={() => void handleDeleteMessage(selectedMessage)}
                  disabled={selectedMessage.senderId !== user?.uid || deletingMessageId === selectedMessage.id}
                >
                  {selectedMessage.senderId === user?.uid ? 'Delete this Love Note' : 'Only the sender can delete this note'}
                </Button>
              </Card.Content>
            </Card>
          ) : null}
          <View onLayout={registerSection('archive')}>
            <Card style={styles.archiveCard}>
              <Card.Content>
                <View style={styles.archiveHeaderRow}>
                  <View>
                    <Text variant="titleMedium" style={styles.cardTitle}>
                      Love Notes archive
                  </Text>
                  <Text style={styles.archiveMeta}>
                    {messages.length} synced notes with {profile.partnerEmail ?? 'your partner'}
                  </Text>
                </View>
              </View>
              {messages.length === 0 ? (
                <Text style={styles.archiveHint}>Your Love Notes archive will appear here once a note is sent.</Text>
              ) : (
                <View style={styles.archiveList}>
                  {messages.map(message => {
                    const selected = message.id === selectedMessage?.id;
                    const revealed = message.revealProgress >= 1;
                    const ownedByUser = message.senderId === user?.uid;
                    const ownership = ownedByUser ? 'You' : message.senderEmail;

                    return (
                      <Card
                        key={message.id}
                        style={[styles.archiveItem, selected && styles.archiveItemSelected]}
                        onPress={() => selectMessage(message.id)}
                      >
                        <Card.Content style={styles.archiveItemContent}>
                          <View style={styles.archiveRow}>
                            <View style={styles.archiveTextWrap}>
                              <Text style={styles.archiveItemMeta}>
                                {ownership} · {getRelativeTime(message.createdAt)} · {revealed ? 'Revealed' : 'Unrevealed'}
                              </Text>
                              <Text style={styles.archiveItemText} numberOfLines={2}>
                                {message.text || 'Finger-drawn Love Note'}
                              </Text>
                              <Text style={styles.archiveHint}>
                                {LOVE_NOTE_TYPE_LABELS[message.noteType]} · {message.tags.map(tag => LOVE_NOTE_TAG_LABELS[tag]).join(' · ') || 'No tags'}
                              </Text>
                            </View>
                            {selected ? <Text style={styles.selectedPill}>Open</Text> : null}
                          </View>
                          <View style={styles.archiveActionsRow}>
                            {!selected ? (
                              <Button mode="contained-tonal" onPress={() => selectMessage(message.id)}>
                                Open
                              </Button>
                            ) : null}
                            {ownedByUser ? (
                              <Button
                                mode="text"
                                onPress={() => void handleDeleteMessage(message)}
                                disabled={deletingMessageId === message.id}
                                loading={deletingMessageId === message.id}
                              >
                                Delete
                              </Button>
                            ) : (
                              <Text style={styles.archiveHint}>Partner note</Text>
                            )}
                          </View>
                        </Card.Content>
                      </Card>
                    );
                  })}
                </View>
              )}
              </Card.Content>
            </Card>
          </View>
        </ScrollView>
      </SafeAreaView>
      <JumpToSectionFab sections={visibleJumpSections} onSelectSection={handleJumpToSection} />
      <Snackbar
        visible={!!snackbar}
        onDismiss={() => setSnackbar('')}
        duration={3500}
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
    opacity: 0.78,
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
    gap: 10,
    backgroundColor: '#F6D3C7',
  },
  heroCopy: {
    gap: 4,
  },
  heroTitle: {
    color: '#3F2831',
    fontWeight: '700',
  },
  heroMeta: {
    color: '#B25B63',
    fontWeight: '600',
  },
  emptyHero: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: 22,
    backgroundColor: '#F6D3C7',
    gap: 10,
  },
  emptyTitle: {
    color: '#3F2831',
    fontWeight: '700',
  },
  emptyBody: {
    color: '#5B4148',
    lineHeight: 20,
  },
  errorText: {
    color: '#B25B63',
    fontWeight: '600',
  },
  syncText: {
    color: '#B25B63',
    fontWeight: '600',
  },
  card: {
    borderRadius: 24,
    backgroundColor: '#F8E2D8',
  },
  cardContent: {
    gap: 10,
  },
  archiveCard: {
    borderRadius: 24,
    backgroundColor: '#FFF7F2',
  },
  cardTitle: {
    color: '#3F2831',
    fontWeight: '700',
  },
  cardBody: {
    color: '#7C5964',
    lineHeight: 20,
  },
  actionList: {
    gap: 10,
  },
  actionItem: {
    borderRadius: 18,
    padding: 12,
    gap: 6,
    backgroundColor: '#FFF9F5',
    borderWidth: 1,
    borderColor: '#F0DED4',
  },
  actionTitle: {
    color: '#3F2831',
    fontWeight: '700',
  },
  actionMeta: {
    color: '#7C5964',
    lineHeight: 18,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choiceButton: {
    borderRadius: 999,
  },
  feedbackBlock: {
    gap: 8,
    marginTop: 10,
  },
  feedbackLabel: {
    color: '#3F2831',
    fontWeight: '700',
  },
  noteInput: {
    backgroundColor: '#FFF9F5',
  },
  primaryButton: {
    borderRadius: 14,
  },
  archiveHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  archiveMeta: {
    marginTop: 4,
    color: '#8F6B74',
    lineHeight: 19,
  },
  archiveList: {
    marginTop: 14,
    gap: 10,
  },
  archiveItem: {
    borderRadius: 20,
    backgroundColor: '#FFF8F3',
    borderWidth: 1,
    borderColor: '#F0DED4',
  },
  archiveItemSelected: {
    backgroundColor: '#FFF1EA',
    borderColor: '#E4A9A2',
  },
  archiveItemContent: {
    paddingVertical: 9,
  },
  archiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  archiveTextWrap: {
    flex: 1,
    gap: 4,
  },
  archiveItemMeta: {
    color: '#B25B63',
    fontSize: 12,
    fontWeight: '600',
  },
  archiveItemText: {
    color: '#3F2831',
    lineHeight: 20,
    fontWeight: '600',
  },
  selectedPill: {
    color: '#3F2831',
    backgroundColor: '#F4D3C7',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    fontWeight: '700',
  },
  archiveActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  archiveHint: {
    color: '#8F6B74',
    fontSize: 12,
    fontWeight: '700',
  },
  snackbar: {
    margin: 16,
    borderRadius: 12,
  },
});
