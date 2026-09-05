import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAuth } from '@react-native-firebase/auth';
import {
  Button,
  Card,
  Dialog,
  HelperText,
  Paragraph,
  Portal,
  Snackbar,
  Surface,
  Text,
  TextInput,
} from 'react-native-paper';
import MirrorCanvas from '../MirrorCanvas';
import {
  createLoveAction,
  createLovePreference,
  deleteLoveAction,
  deleteLovePreference,
  respondToLoveActionProposal,
  sendMirrorMessage,
  transitionLoveActionStatus,
  updateLoveAction,
  updateLovePreference,
} from '../lib/relationshipSync';
import { MainTabParamList } from '../navigation/MainNavigator';
import { type LoveAction, useLoveActionStore } from '../store/useLoveActionStore';
import {
  type LoveArea,
  type LovePreference,
  type LovePreferenceFrequency,
  type LovePreferenceImportance,
  type LovePreferenceTiming,
  type LovePreferenceVisibility,
  useLoveProfileStore,
} from '../store/useLoveProfileStore';
import { type MirrorStroke, useMirrorMessageStore } from '../store/useMirrorMessageStore';
import { useRelationshipStore } from '../store/useRelationshipStore';

const MAX_MESSAGE_LENGTH = 120;
const DEFAULT_MESSAGE = 'How 2 love me tonight...';
const LOVE_AREAS: LoveArea[] = [
  'emotional',
  'physicalIntimate',
  'communication',
  'financial',
  'spiritual',
  'mental',
  'social',
  'partnership',
];
const LOVE_AREA_LABELS: Record<LoveArea, string> = {
  emotional: 'Emotional',
  physicalIntimate: 'Physical / Intimate',
  communication: 'Communication',
  financial: 'Financial',
  spiritual: 'Spiritual',
  mental: 'Mental',
  social: 'Social',
  partnership: 'Partnership',
};
const IMPORTANCE_OPTIONS: Array<{ value: LovePreferenceImportance; label: string }> = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'essential', label: 'Essential' },
];
const FREQUENCY_OPTIONS: Array<{ value: LovePreferenceFrequency; label: string }> = [
  { value: 'daily', label: 'Daily' },
  { value: 'severalTimesWeekly', label: 'Several / week' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'occasionally', label: 'Occasionally' },
  { value: 'surpriseMe', label: 'Surprise me' },
];
const TIMING_OPTIONS: Array<{ value: LovePreferenceTiming; label: string }> = [
  { value: 'morning', label: 'Morning' },
  { value: 'evening', label: 'Evening' },
  { value: 'weekend', label: 'Weekend' },
  { value: 'anytime', label: 'Anytime' },
  { value: 'custom', label: 'Custom' },
];
const VISIBILITY_OPTIONS: Array<{ value: LovePreferenceVisibility; label: string }> = [
  { value: 'private', label: 'Private' },
  { value: 'shared', label: 'Shared' },
  { value: 'surprise', label: 'Surprise' },
];
const DATE_INPUT_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_INPUT_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const LOVE_LIBRARY_ITEMS: Array<{
  id: string;
  area: LoveArea;
  title: string;
  description: string;
  importance: LovePreferenceImportance;
  frequency: LovePreferenceFrequency;
  timing: LovePreferenceTiming;
  visibility: LovePreferenceVisibility;
}> = [
  {
    id: 'lib-emotional-1',
    area: 'emotional',
    title: 'Warm reunion hug',
    description: 'Give me a long hug and a soft check-in when we reconnect after work.',
    importance: 'high',
    frequency: 'severalTimesWeekly',
    timing: 'evening',
    visibility: 'shared',
  },
  {
    id: 'lib-emotional-2',
    area: 'emotional',
    title: 'Gentle reassurance',
    description: 'Tell me directly that we are okay when stress starts to build.',
    importance: 'essential',
    frequency: 'weekly',
    timing: 'anytime',
    visibility: 'shared',
  },
  {
    id: 'lib-physical-1',
    area: 'physicalIntimate',
    title: 'Slow touch',
    description: 'Initiate affectionate touch without rushing toward an outcome.',
    importance: 'high',
    frequency: 'weekly',
    timing: 'evening',
    visibility: 'surprise',
  },
  {
    id: 'lib-communication-1',
    area: 'communication',
    title: 'Clear check-in',
    description: 'Ask what I need tonight instead of making me guess your energy.',
    importance: 'high',
    frequency: 'daily',
    timing: 'anytime',
    visibility: 'shared',
  },
  {
    id: 'lib-financial-1',
    area: 'financial',
    title: 'Money rhythm',
    description: 'Set a calm weekly money check-in so finances feel shared, not avoided.',
    importance: 'medium',
    frequency: 'weekly',
    timing: 'weekend',
    visibility: 'shared',
  },
  {
    id: 'lib-spiritual-1',
    area: 'spiritual',
    title: 'Shared grounding',
    description: 'Pause together for prayer, gratitude, or quiet reflection once a week.',
    importance: 'medium',
    frequency: 'weekly',
    timing: 'weekend',
    visibility: 'shared',
  },
  {
    id: 'lib-mental-1',
    area: 'mental',
    title: 'Protect my focus',
    description: 'Help me create uninterrupted space when my mind feels overloaded.',
    importance: 'medium',
    frequency: 'occasionally',
    timing: 'custom',
    visibility: 'private',
  },
  {
    id: 'lib-social-1',
    area: 'social',
    title: 'Intentional outing',
    description: 'Plan a simple social moment that helps us feel alive together.',
    importance: 'medium',
    frequency: 'monthly',
    timing: 'weekend',
    visibility: 'shared',
  },
  {
    id: 'lib-partnership-1',
    area: 'partnership',
    title: 'Shared load',
    description: 'Take initiative on one practical task so I feel supported, not alone.',
    importance: 'high',
    frequency: 'weekly',
    timing: 'anytime',
    visibility: 'shared',
  },
];

type DeleteTarget =
  | { kind: 'preference'; id: string; label: string }
  | { kind: 'action'; id: string; label: string }
  | null;

type ChoiceOption = {
  value: string;
  label: string;
};

function getActionStatusLabel(action: LoveAction) {
  switch (action.status) {
    case 'proposed':
      return 'Waiting for partner response';
    case 'scheduled':
      return 'Accepted and scheduled';
    case 'due':
      return 'Due now';
    case 'performed':
      return 'Marked done';
    case 'confirmed':
      return 'Confirmed';
    case 'appreciated':
      return 'Appreciated';
    case 'needsAttention':
      return 'Needs a softer rework';
    case 'cancelled':
      return 'Cancelled';
    default:
      return 'In progress';
  }
}

function getActionMeta(action: LoveAction, currentUserId?: string) {
  if (action.responsibleUserId === currentUserId) {
    return `You → ${action.recipientUserEmail}`;
  }

  return `${action.responsibleUserEmail} → You`;
}

function getVisibilityCopy(visibility: LovePreferenceVisibility) {
  switch (visibility) {
    case 'private':
      return 'Private preferences stay on your account until you decide to turn them into a shared proposal.';
    case 'shared':
      return 'Shared preferences are easy to turn into partner-visible Love Actions.';
    case 'surprise':
      return 'Surprise preferences are shared with more mystery in mind when turned into a Love Action.';
    default:
      return '';
  }
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function formatDateInputValue(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function buildDueTimestamp(dateInput: string, allDay: boolean, timeInput: string) {
  if (!DATE_INPUT_REGEX.test(dateInput)) {
    throw new Error('Use a due date in YYYY-MM-DD format.');
  }

  const [year, month, day] = dateInput.split('-').map(Number);

  if (!allDay && !TIME_INPUT_REGEX.test(timeInput)) {
    throw new Error('Use a due time in HH:MM format.');
  }

  const hours = allDay ? 12 : Number(timeInput.slice(0, 2));
  const minutes = allDay ? 0 : Number(timeInput.slice(3, 5));
  const dueAt = new Date(year, (month || 1) - 1, day || 1, hours, minutes, 0, 0);

  if (Number.isNaN(dueAt.getTime())) {
    throw new Error('That due date is invalid.');
  }

  return dueAt.getTime();
}

function formatDueSummary(nextDueAt: number | null) {
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

function ChoiceGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: ChoiceOption[];
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.choiceGroup}>
      <Text style={styles.choiceLabel}>{label}</Text>
      <View style={styles.choiceRow}>
        {options.map(option => {
          const selected = value === option.value;

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
    </View>
  );
}

export default function LoveScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const user = getAuth().currentUser;
  const profile = useRelationshipStore(state => state.profile);
  const relationshipSyncing = useRelationshipStore(state => state.syncing);
  const relationshipError = useRelationshipStore(state => state.error);
  const hydrated = useMirrorMessageStore(state => state.hydrated);
  const messages = useMirrorMessageStore(state => state.messages);
  const preferencesHydrated = useLoveProfileStore(state => state.hydrated);
  const preferencesSyncing = useLoveProfileStore(state => state.syncing);
  const preferences = useLoveProfileStore(state => state.preferences);
  const actionsHydrated = useLoveActionStore(state => state.hydrated);
  const actionsSyncing = useLoveActionStore(state => state.syncing);
  const actions = useLoveActionStore(state => state.actions);
  const [messageText, setMessageText] = useState(DEFAULT_MESSAGE);
  const [strokes, setStrokes] = useState<MirrorStroke[]>([]);
  const [sending, setSending] = useState(false);
  const [mirrorGestureActive, setMirrorGestureActive] = useState(false);
  const [snackbar, setSnackbar] = useState('');
  const [selectedArea, setSelectedArea] = useState<LoveArea>('emotional');
  const [preferenceText, setPreferenceText] = useState('');
  const [preferenceImportance, setPreferenceImportance] = useState<LovePreferenceImportance>('medium');
  const [preferenceFrequency, setPreferenceFrequency] = useState<LovePreferenceFrequency>('weekly');
  const [preferenceTiming, setPreferenceTiming] = useState<LovePreferenceTiming>('anytime');
  const [preferenceVisibility, setPreferenceVisibility] = useState<LovePreferenceVisibility>('private');
  const [preferenceCustomTiming, setPreferenceCustomTiming] = useState('');
  const [actionTitle, setActionTitle] = useState('');
  const [actionResponsibleUserId, setActionResponsibleUserId] = useState<string | null>(user?.uid ?? null);
  const [actionDueDate, setActionDueDate] = useState(() => formatDateInputValue(new Date()));
  const [actionDueAllDay, setActionDueAllDay] = useState(false);
  const [actionDueTime, setActionDueTime] = useState('19:00');
  const [linkedPreferenceId, setLinkedPreferenceId] = useState<string | null>(null);
  const [editingPreferenceId, setEditingPreferenceId] = useState<string | null>(null);
  const [editingActionId, setEditingActionId] = useState<string | null>(null);
  const [savingPreference, setSavingPreference] = useState(false);
  const [savingAction, setSavingAction] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [deleting, setDeleting] = useState(false);
  const [respondingActionId, setRespondingActionId] = useState<string | null>(null);
  const [transitioningActionId, setTransitioningActionId] = useState<string | null>(null);
  const trimmedMessage = messageText.trim();
  const trimmedPreference = preferenceText.trim();
  const trimmedActionTitle = actionTitle.trim();
  const canSend =
    !!user &&
    hydrated &&
    !!profile?.coupleId &&
    !relationshipSyncing &&
    !sending &&
    (trimmedMessage.length > 0 || strokes.length > 0);
  const profileFoundationSyncing = !preferencesHydrated || !actionsHydrated || preferencesSyncing || actionsSyncing;

  const ownMessageCount = useMemo(
    () => messages.filter(message => message.senderId === user?.uid).length,
    [messages, user?.uid],
  );
  const filteredLibraryItems = useMemo(
    () => LOVE_LIBRARY_ITEMS.filter(item => item.area === selectedArea),
    [selectedArea],
  );
  const ownPreferences = useMemo(
    () => preferences.filter(preference => preference.createdByUserId === user?.uid),
    [preferences, user?.uid],
  );
  const proposedByMeCount = useMemo(
    () => actions.filter(action => action.proposedByUserId === user?.uid).length,
    [actions, user?.uid],
  );
  const pendingMyResponseCount = useMemo(
    () => actions.filter(action => action.recipientUserId === user?.uid && action.status === 'proposed').length,
    [actions, user?.uid],
  );

  const handleSend = async () => {
    if (!user) {
      setSnackbar('Sign in again to send a mirror note.');
      return;
    }

    if (!profile?.coupleId) {
      setSnackbar('Connect with your partner in Us before sending mirror notes.');
      return;
    }

    if (!trimmedMessage && strokes.length === 0) {
      setSnackbar('Leave a message or draw on the mirror first.');
      return;
    }

    setSending(true);

    try {
      await sendMirrorMessage(user, {
        text: trimmedMessage,
        strokes,
      });
      setMessageText(DEFAULT_MESSAGE);
      setStrokes([]);
      setSnackbar('Your mirror note is now syncing to Home.');
      navigation.navigate('Home');
    } catch (error: any) {
      setSnackbar(error.message ?? 'Unable to send your mirror note right now.');
    } finally {
      setSending(false);
    }
  };

  const handleResetMirror = () => {
    setMessageText('');
    setStrokes([]);
  };

  const resetPreferenceForm = () => {
    setEditingPreferenceId(null);
    setPreferenceText('');
    setPreferenceImportance('medium');
    setPreferenceFrequency('weekly');
    setPreferenceTiming('anytime');
    setPreferenceVisibility('private');
    setPreferenceCustomTiming('');
    setLinkedPreferenceId(null);
  };

  const resetActionForm = () => {
    setEditingActionId(null);
    setActionTitle('');
    setActionResponsibleUserId(user?.uid ?? null);
    setActionDueDate(formatDateInputValue(new Date()));
    setActionDueAllDay(false);
    setActionDueTime('19:00');
    setLinkedPreferenceId(null);
  };

  const handleSavePreference = async () => {
    if (!user) {
      setSnackbar('Sign in again to save a love preference.');
      return;
    }

    if (!trimmedPreference) {
      setSnackbar('Add one clear way you like to be loved first.');
      return;
    }

    if (preferenceTiming === 'custom' && !preferenceCustomTiming.trim()) {
      setSnackbar('Add your custom timing so your partner knows when this matters most.');
      return;
    }

    setSavingPreference(true);

    try {
      const input = {
        area: selectedArea,
        actionText: trimmedPreference,
        actionSource: 'custom' as const,
        importance: preferenceImportance,
        frequency: preferenceFrequency,
        timing: preferenceTiming,
        customTiming: preferenceTiming === 'custom' ? preferenceCustomTiming.trim() : null,
        visibility: preferenceVisibility,
        notes: '',
      };

      if (editingPreferenceId) {
        await updateLovePreference(user, editingPreferenceId, input);
        setSnackbar('Love preference updated.');
      } else {
        const result = await createLovePreference(user, input);
        setLinkedPreferenceId(result.preferenceId);
        setSnackbar('Love preference saved.');
      }

      setPreferenceText('');
      setEditingPreferenceId(null);
    } catch (error: any) {
      setSnackbar(error.message ?? 'Unable to save this love preference right now.');
    } finally {
      setSavingPreference(false);
    }
  };

  const handleSaveAction = async () => {
    if (!user) {
      setSnackbar('Sign in again to create a Love Action.');
      return;
    }

    if (!profile?.coupleId) {
      setSnackbar('Connect with your partner in Us before proposing shared Love Actions.');
      return;
    }

    if (!trimmedActionTitle) {
      setSnackbar('Add a short Love Action title first.');
      return;
    }

    if (preferenceTiming === 'custom' && !preferenceCustomTiming.trim()) {
      setSnackbar('Add your custom timing before turning this into a shared Love Action.');
      return;
    }

    setSavingAction(true);

    try {
      const nextDueAt = buildDueTimestamp(actionDueDate, actionDueAllDay, actionDueTime);
      const responsibleUserId = actionResponsibleUserId ?? user.uid;
      const input = {
        title: trimmedActionTitle,
        area: selectedArea,
        preferenceId: linkedPreferenceId,
        importance: preferenceImportance,
        frequency: preferenceFrequency,
        timing: preferenceTiming,
        customTiming: preferenceTiming === 'custom' ? preferenceCustomTiming.trim() : null,
        visibility: preferenceVisibility === 'private' ? ('shared' as const) : preferenceVisibility,
        status: 'proposed' as const,
        nextDueAt,
        responsibleUserId,
        notes: '',
      };

      if (editingActionId) {
        await updateLoveAction(user, editingActionId, input);
        setSnackbar('Love Action proposal updated.');
      } else {
        await createLoveAction(user, input);
        setSnackbar('Love Action proposed.');
      }

      resetActionForm();
    } catch (error: any) {
      setSnackbar(error.message ?? 'Unable to save this Love Action right now.');
    } finally {
      setSavingAction(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !deleteTarget) {
      return;
    }

    setDeleting(true);

    try {
      if (deleteTarget.kind === 'preference') {
        await deleteLovePreference(user, deleteTarget.id);
        if (editingPreferenceId === deleteTarget.id) {
          resetPreferenceForm();
        }
        if (linkedPreferenceId === deleteTarget.id) {
          setLinkedPreferenceId(null);
        }
        setSnackbar('Love preference deleted.');
      } else {
        await deleteLoveAction(user, deleteTarget.id);
        if (editingActionId === deleteTarget.id) {
          resetActionForm();
        }
        setSnackbar('Love Action deleted.');
      }

      setDeleteTarget(null);
    } catch (error: any) {
      setSnackbar(error.message ?? 'Unable to delete this item right now.');
    } finally {
      setDeleting(false);
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

  const handleLifecycleTransition = async (
    actionId: string,
    targetStatus: 'due' | 'performed' | 'confirmed' | 'appreciated',
    successMessage: string,
  ) => {
    if (!user) {
      setSnackbar('Sign in again to move this Love Action forward.');
      return;
    }

    setTransitioningActionId(actionId);

    try {
      await transitionLoveActionStatus(user, actionId, targetStatus);
      setSnackbar(successMessage);
    } catch (error: any) {
      setSnackbar(error.message ?? 'Unable to update this Love Action right now.');
    } finally {
      setTransitioningActionId(null);
    }
  };

  const loadPreferenceIntoForm = (preference: LovePreference) => {
    setEditingPreferenceId(preference.id);
    setSelectedArea(preference.area);
    setPreferenceText(preference.actionText);
    setPreferenceImportance(preference.importance);
    setPreferenceFrequency(preference.frequency);
    setPreferenceTiming(preference.timing);
    setPreferenceVisibility(preference.visibility);
    setPreferenceCustomTiming(preference.customTiming ?? '');
    setLinkedPreferenceId(preference.id);
    setSnackbar('Loaded love preference for editing.');
  };

  const usePreferenceForAction = (preference: LovePreference) => {
    setSelectedArea(preference.area);
    setLinkedPreferenceId(preference.id);
    setActionTitle(preference.actionText);
    setPreferenceImportance(preference.importance);
    setPreferenceFrequency(preference.frequency);
    setPreferenceTiming(preference.timing);
    setPreferenceVisibility(preference.visibility);
    setPreferenceCustomTiming(preference.customTiming ?? '');
    setEditingActionId(null);
    setSnackbar('Loaded love preference into the Love Action form.');
  };

  const loadActionIntoForm = (action: LoveAction) => {
    setEditingActionId(action.id);
    setSelectedArea(action.area);
    setActionTitle(action.title);
    setActionResponsibleUserId(action.responsibleUserId);
    setLinkedPreferenceId(action.preferenceId);
    setPreferenceImportance(action.importance);
    setPreferenceFrequency(action.frequency);
    setPreferenceTiming(action.timing);
    setPreferenceVisibility(action.visibility);
    setPreferenceCustomTiming(action.customTiming ?? '');
    if (action.nextDueAt) {
      const dueDate = new Date(action.nextDueAt);
      setActionDueDate(formatDateInputValue(dueDate));
      setActionDueAllDay(false);
      setActionDueTime(`${pad(dueDate.getHours())}:${pad(dueDate.getMinutes())}`);
    } else {
      setActionDueDate(formatDateInputValue(new Date()));
      setActionDueAllDay(false);
      setActionDueTime('19:00');
    }
    setSnackbar('Loaded Love Action for editing.');
  };

  const loadLibraryItemIntoPreference = (item: (typeof LOVE_LIBRARY_ITEMS)[number]) => {
    setSelectedArea(item.area);
    setPreferenceText(item.description);
    setActionTitle(item.title);
    setPreferenceImportance(item.importance);
    setPreferenceFrequency(item.frequency);
    setPreferenceTiming(item.timing);
    setPreferenceVisibility(item.visibility);
    setPreferenceCustomTiming(item.timing === 'custom' ? 'When my mind feels overloaded' : '');
    setEditingPreferenceId(null);
    setEditingActionId(null);
    setSnackbar('Loaded Love Library idea into your forms.');
  };

  return (
    <>
      <SafeAreaView style={styles.screen} edges={['top']}>
        <ScrollView
          contentInsetAdjustmentBehavior="never"
          keyboardShouldPersistTaps="handled"
          scrollEnabled={!mirrorGestureActive}
          style={styles.scrollView}
          contentContainerStyle={styles.content}
        >
          <Text variant="headlineMedium" style={styles.header}>
            Love
          </Text>
          <Text style={styles.subheader}>
            Shape the ways you want to be loved, turn them into shared proposals, and still leave something warm on the mirror.
          </Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryPill}>
              <Text style={styles.summaryLabel}>Shared {messages.length}</Text>
            </View>
            <View style={styles.summaryPill}>
              <Text style={styles.summaryLabel}>Preferences {ownPreferences.length}</Text>
            </View>
            <View style={styles.summaryPill}>
              <Text style={styles.summaryLabel}>Proposals {proposedByMeCount}</Text>
            </View>
            <View style={styles.summaryPill}>
              <Text style={styles.summaryLabel}>Awaiting you {pendingMyResponseCount}</Text>
            </View>
            <View style={styles.summaryPill}>
              <Text style={styles.summaryLabel}>{profile?.coupleId ? 'Connected' : 'Solo'}</Text>
            </View>
          </View>
          {!hydrated ? <Text style={styles.syncText}>Warming the mirror...</Text> : null}
          {!!relationshipError ? <Text style={styles.errorText}>{relationshipError}</Text> : null}
          {!profile?.coupleId && !relationshipSyncing ? (
            <Card style={styles.connectionCard}>
              <Card.Content style={styles.connectionCardContent}>
                <Text variant="titleMedium" style={styles.cardTitle}>
                  Connect your partner first
                </Text>
                <Text style={styles.connectionBody}>
                  Send a partner invite by email from Us. Once you’re linked, your Love Actions can move from personal clarity into shared agreement.
                </Text>
                <Button mode="contained" onPress={() => navigation.navigate('Us')} style={styles.primaryButton}>
                  Go to Us
                </Button>
              </Card.Content>
            </Card>
          ) : null}
          <Card style={styles.foundationCard}>
            <Card.Content style={styles.cardContent}>
              <Text variant="titleMedium" style={styles.cardTitle}>
                Your Love Profile
              </Text>
              <Text style={styles.foundationBody}>
                Name a concrete behavior that helps you feel loved, then tune how often, when, and how visible it should feel.
              </Text>
              <View style={styles.summaryRow}>
                <View style={styles.summaryPill}>
                  <Text style={styles.summaryLabel}>{LOVE_AREA_LABELS[selectedArea]}</Text>
                </View>
                <View style={styles.summaryPill}>
                  <Text style={styles.summaryLabel}>Linked action {linkedPreferenceId ? 'Ready' : 'None'}</Text>
                </View>
              </View>
              {profileFoundationSyncing ? <Text style={styles.syncText}>Syncing your Love profile foundation...</Text> : null}
              <ChoiceGroup
                label="Love area"
                value={selectedArea}
                options={LOVE_AREAS.map(area => ({ value: area, label: LOVE_AREA_LABELS[area] }))}
                onChange={value => setSelectedArea(value as LoveArea)}
              />
              <TextInput
                mode="outlined"
                label="One thing that helps you feel loved"
                value={preferenceText}
                onChangeText={setPreferenceText}
                multiline
                numberOfLines={3}
                style={styles.input}
                contentStyle={styles.inputContent}
                outlineStyle={styles.inputOutline}
                outlineColor="#E7C9BF"
                activeOutlineColor="#D79395"
                placeholder="Give me a long hug when we reconnect after work."
              />
              <ChoiceGroup
                label="Importance"
                value={preferenceImportance}
                options={IMPORTANCE_OPTIONS}
                onChange={value => setPreferenceImportance(value as LovePreferenceImportance)}
              />
              <ChoiceGroup
                label="Desired frequency"
                value={preferenceFrequency}
                options={FREQUENCY_OPTIONS}
                onChange={value => setPreferenceFrequency(value as LovePreferenceFrequency)}
              />
              <ChoiceGroup
                label="Timing"
                value={preferenceTiming}
                options={TIMING_OPTIONS}
                onChange={value => setPreferenceTiming(value as LovePreferenceTiming)}
              />
              {preferenceTiming === 'custom' ? (
                <TextInput
                  mode="outlined"
                  label="Custom timing"
                  value={preferenceCustomTiming}
                  onChangeText={setPreferenceCustomTiming}
                  style={styles.shortInput}
                  outlineStyle={styles.inputOutline}
                  outlineColor="#E7C9BF"
                  activeOutlineColor="#D79395"
                  placeholder="After hard workdays"
                />
              ) : null}
              <ChoiceGroup
                label="Visibility"
                value={preferenceVisibility}
                options={VISIBILITY_OPTIONS}
                onChange={value => setPreferenceVisibility(value as LovePreferenceVisibility)}
              />
              <HelperText type="info" visible>
                {getVisibilityCopy(preferenceVisibility)}
              </HelperText>
              <View style={styles.actionsRow}>
                <Button
                  mode="contained"
                  onPress={() => void handleSavePreference()}
                  loading={savingPreference}
                  disabled={savingPreference}
                  style={styles.primaryButton}
                  buttonColor="#B25B63"
                  textColor="#FFF8F3"
                >
                  {editingPreferenceId ? 'Update preference' : 'Save preference'}
                </Button>
                <Button mode="text" onPress={resetPreferenceForm} disabled={savingPreference}>
                  Clear form
                </Button>
              </View>
              <View style={styles.stack}>
                {ownPreferences.length === 0 ? (
                  <Text style={styles.foundationMeta}>No saved love preferences yet.</Text>
                ) : (
                  ownPreferences.map(preference => (
                    <Surface key={preference.id} style={styles.listCard} elevation={0}>
                      <Text style={styles.listTitle}>{preference.actionText}</Text>
                      <Text style={styles.listMeta}>
                        {LOVE_AREA_LABELS[preference.area]} · {preference.importance} · {preference.frequency}
                      </Text>
                      <Text style={styles.listMeta}>
                        {preference.timing === 'custom' ? preference.customTiming ?? 'Custom timing' : preference.timing} · {preference.visibility}
                      </Text>
                      <View style={styles.actionsRow}>
                        <Button mode="text" onPress={() => loadPreferenceIntoForm(preference)}>
                          Edit
                        </Button>
                        <Button mode="text" onPress={() => usePreferenceForAction(preference)}>
                          Use for action
                        </Button>
                        <Button mode="text" onPress={() => setDeleteTarget({ kind: 'preference', id: preference.id, label: preference.actionText })}>
                          Delete
                        </Button>
                      </View>
                    </Surface>
                  ))
                )}
              </View>
            </Card.Content>
          </Card>
          <Card style={styles.libraryCard}>
            <Card.Content style={styles.cardContent}>
              <Text variant="titleMedium" style={styles.cardTitle}>
                Love Library starter picks
              </Text>
              <Text style={styles.foundationBody}>
                Use curated ideas as prompts, then personalize them into your Love Profile or a shared proposal.
              </Text>
              <View style={styles.stack}>
                {filteredLibraryItems.map(item => (
                  <Surface key={item.id} style={styles.listCard} elevation={0}>
                    <Text style={styles.listTitle}>{item.title}</Text>
                    <Text style={styles.listMeta}>{item.description}</Text>
                    <Text style={styles.listMeta}>
                      {item.importance} · {item.frequency} · {item.timing} · {item.visibility}
                    </Text>
                    <View style={styles.actionsRow}>
                      <Button mode="text" onPress={() => loadLibraryItemIntoPreference(item)}>
                        Use this idea
                      </Button>
                    </View>
                  </Surface>
                ))}
              </View>
            </Card.Content>
          </Card>
          <Card style={styles.foundationCard}>
            <Card.Content style={styles.cardContent}>
              <Text variant="titleMedium" style={styles.cardTitle}>
                Shared Love Actions
              </Text>
              <Text style={styles.foundationBody}>
                Turn a preference into a shared proposal. Your partner can accept it, send it back for rework, or move it through the relationship loop once it is active.
              </Text>
              <TextInput
                mode="outlined"
                label="Shared Love Action title"
                value={actionTitle}
                onChangeText={setActionTitle}
                multiline
                numberOfLines={2}
                style={styles.input}
                contentStyle={styles.inputContent}
                outlineStyle={styles.inputOutline}
                outlineColor="#E7C9BF"
                activeOutlineColor="#D79395"
                placeholder="Plan a long hug after work this Friday."
              />
              <ChoiceGroup
                label="Who carries this?"
                value={actionResponsibleUserId ?? user?.uid ?? 'me'}
                options={[
                  { value: user?.uid ?? 'me', label: 'I do' },
                  { value: profile?.partnerId ?? 'partner', label: 'Partner does' },
                ]}
                onChange={value => setActionResponsibleUserId(value)}
              />
              <HelperText type="info" visible>
                {actionResponsibleUserId === profile?.partnerId
                  ? `${profile?.partnerEmail ?? 'Your partner'} will be the responsible partner for this action.`
                  : 'You will be the responsible partner for this action.'}
              </HelperText>
              <TextInput
                mode="outlined"
                label="Due date"
                value={actionDueDate}
                onChangeText={setActionDueDate}
                style={styles.shortInput}
                outlineStyle={styles.inputOutline}
                outlineColor="#E7C9BF"
                activeOutlineColor="#D79395"
                placeholder="2026-09-04"
              />
              <ChoiceGroup
                label="Due timing"
                value={actionDueAllDay ? 'allDay' : 'specific'}
                options={[
                  { value: 'specific', label: 'Specific time' },
                  { value: 'allDay', label: 'All day' },
                ]}
                onChange={value => setActionDueAllDay(value === 'allDay')}
              />
              {!actionDueAllDay ? (
                <TextInput
                  mode="outlined"
                  label="Due time"
                  value={actionDueTime}
                  onChangeText={setActionDueTime}
                  style={styles.shortInput}
                  outlineStyle={styles.inputOutline}
                  outlineColor="#E7C9BF"
                  activeOutlineColor="#D79395"
                  placeholder="19:00"
                />
              ) : null}
              <HelperText type="info" visible>
                Linked preference: {linkedPreferenceId ? 'ready to attach' : 'none selected yet'}. Private preferences become shared when turned into a shared Love Action.
              </HelperText>
              <HelperText type="info" visible>
                Due schedule: {actionDueAllDay ? `${actionDueDate} · all day` : `${actionDueDate} · ${actionDueTime}`}.
              </HelperText>
              <View style={styles.actionsRow}>
                <Button
                  mode="contained"
                  onPress={() => void handleSaveAction()}
                  loading={savingAction}
                  disabled={savingAction || !profile?.coupleId}
                  style={styles.primaryButton}
                  buttonColor="#B25B63"
                  textColor="#FFF8F3"
                >
                  {editingActionId ? 'Update proposal' : 'Propose action'}
                </Button>
                <Button mode="text" onPress={resetActionForm} disabled={savingAction}>
                  Clear form
                </Button>
              </View>
              <View style={styles.stack}>
                {actions.length === 0 ? (
                  <Text style={styles.foundationMeta}>No shared Love Actions yet.</Text>
                ) : (
                  actions.map(action => {
                    const proposedByMe = action.proposedByUserId === user?.uid;
                    const awaitingMyResponse = action.recipientUserId === user?.uid && action.status === 'proposed';
                    const iAmResponsible = action.responsibleUserId === user?.uid;
                    const iAmRecipient = action.recipientUserId === user?.uid;
                    const busy = respondingActionId === action.id || transitioningActionId === action.id;

                    return (
                      <Surface key={action.id} style={styles.listCard} elevation={0}>
                        <Text style={styles.listTitle}>{action.title}</Text>
                        <Text style={styles.listMeta}>{getActionMeta(action, user?.uid)}</Text>
                        <Text style={styles.listMeta}>
                          {LOVE_AREA_LABELS[action.area]} · {action.importance} · {action.frequency}
                        </Text>
                        <Text style={styles.listMeta}>
                          {action.timing === 'custom' ? action.customTiming ?? 'Custom timing' : action.timing} · {action.visibility}
                        </Text>
                        <Text style={styles.listMeta}>{getActionStatusLabel(action)}</Text>
                        <Text style={styles.listMeta}>Due {formatDueSummary(action.nextDueAt)}</Text>
                        {!!action.respondedByEmail ? (
                          <Text style={styles.listMeta}>Latest response from {action.respondedByEmail}</Text>
                        ) : null}
                        {!!action.confirmationReaction || !!action.confirmationNote ? (
                          <Text style={styles.listMeta}>
                            Confirmation: {action.confirmationReaction ?? 'note only'}{action.confirmationNote ? ` · ${action.confirmationNote}` : ''}
                          </Text>
                        ) : null}
                        {!!action.appreciationReaction || !!action.appreciationNote ? (
                          <Text style={styles.listMeta}>
                            Appreciation: {action.appreciationReaction ?? 'note only'}{action.appreciationNote ? ` · ${action.appreciationNote}` : ''}
                          </Text>
                        ) : null}
                        <View style={styles.actionsRow}>
                          {proposedByMe ? (
                            <>
                              <Button mode="text" onPress={() => loadActionIntoForm(action)}>
                                Edit
                              </Button>
                              <Button mode="text" onPress={() => setDeleteTarget({ kind: 'action', id: action.id, label: action.title })}>
                                Delete
                              </Button>
                            </>
                          ) : null}
                          {awaitingMyResponse ? (
                            <>
                              <Button
                                mode="contained"
                                onPress={() => void handleRespondToProposal(action.id, 'accept')}
                                loading={respondingActionId === action.id}
                                disabled={busy}
                                style={styles.primarySmallButton}
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
                            </>
                          ) : null}
                          {iAmResponsible && action.status === 'scheduled' ? (
                            <Button
                              mode="outlined"
                              onPress={() => void handleLifecycleTransition(action.id, 'due', 'Love Action moved into due.')}
                              disabled={busy}
                            >
                              Mark due
                            </Button>
                          ) : null}
                          {iAmResponsible && action.status === 'due' ? (
                            <Button
                              mode="contained"
                              onPress={() => void handleLifecycleTransition(action.id, 'performed', 'Love Action marked done.')}
                              loading={transitioningActionId === action.id}
                              disabled={busy}
                              style={styles.primarySmallButton}
                              buttonColor="#B25B63"
                              textColor="#FFF8F3"
                            >
                              Mark done
                            </Button>
                          ) : null}
                          {iAmRecipient && action.status === 'performed' ? (
                            <>
                              <Button
                                mode="outlined"
                                onPress={() => void handleLifecycleTransition(action.id, 'confirmed', 'Love Action confirmed.')}
                                disabled={busy}
                              >
                                Confirm
                              </Button>
                              <Button
                                mode="contained"
                                onPress={() => void handleLifecycleTransition(action.id, 'appreciated', 'Love Action appreciated.')}
                                loading={transitioningActionId === action.id}
                                disabled={busy}
                                style={styles.primarySmallButton}
                                buttonColor="#B25B63"
                                textColor="#FFF8F3"
                              >
                                Appreciate
                              </Button>
                            </>
                          ) : null}
                          {iAmRecipient && action.status === 'confirmed' ? (
                            <Button
                              mode="contained"
                              onPress={() => void handleLifecycleTransition(action.id, 'appreciated', 'Love Action appreciated.')}
                              loading={transitioningActionId === action.id}
                              disabled={busy}
                              style={styles.primarySmallButton}
                              buttonColor="#B25B63"
                              textColor="#FFF8F3"
                            >
                              Appreciate
                            </Button>
                          ) : null}
                        </View>
                      </Surface>
                    );
                  })
                )}
              </View>
            </Card.Content>
          </Card>
          <Surface style={styles.hero} elevation={0}>
            <Text variant="titleMedium" style={styles.heroTitle}>
              Compose a Mirror Message
            </Text>
            <Text style={styles.heroBody}>
              Drag a finger through the steam. Your typed words stay readable, and your touch turns the note into a ritual.
            </Text>
            <MirrorCanvas
              editable
              messageText={trimmedMessage}
              strokes={strokes}
              onChangeStrokes={setStrokes}
              onGestureActiveChange={setMirrorGestureActive}
              prompt={profile?.coupleId ? 'Write with your finger on the mirror.' : 'Connect your partner to send this note.'}
            />
          </Surface>
          <Card style={styles.card}>
            <Card.Content style={styles.cardContent}>
              <Text variant="titleMedium" style={styles.cardTitle}>
                Note details
              </Text>
              <TextInput
                mode="outlined"
                label="Short message"
                value={messageText}
                onChangeText={text => setMessageText(text.slice(0, MAX_MESSAGE_LENGTH))}
                multiline
                numberOfLines={3}
                style={styles.input}
                contentStyle={styles.inputContent}
                outlineStyle={styles.inputOutline}
                outlineColor="#E7C9BF"
                activeOutlineColor="#D79395"
                placeholder="Come closer tonight."
              />
              <HelperText type="info" visible>
                {strokes.length > 0
                  ? 'Trace a heart, initials, or a soft flourish with your finger on the fog.'
                  : 'Type the note, then use your finger to add a personal wipe, heart, or handwritten accent.'}
              </HelperText>
              <Text style={styles.characterCount}>{trimmedMessage.length}/{MAX_MESSAGE_LENGTH}</Text>
              <View style={styles.actionsRow}>
                <Button
                  mode="contained"
                  onPress={() => void handleSend()}
                  disabled={!canSend}
                  loading={sending}
                  style={[styles.primaryButton, !canSend && styles.primaryButtonDisabled]}
                  buttonColor={canSend ? '#B25B63' : '#D7C3BC'}
                  textColor={canSend ? '#FFF8F3' : '#8D7279'}
                >
                  Send to shared Home
                </Button>
                <Button mode="outlined" onPress={handleResetMirror} disabled={sending}>
                  Clear mirror
                </Button>
              </View>
            </Card.Content>
          </Card>
          <Card style={styles.archiveCard}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.cardTitle}>
                Shared energy
              </Text>
              <Text style={styles.archiveMeta}>
                {profile?.coupleId
                  ? `${messages.length} mirror notes synced with ${profile.partnerEmail ?? 'your partner'}.`
                  : 'No live thread yet. Connect with your partner in Us to start syncing notes.'}
              </Text>
              <Button mode="text" onPress={() => navigation.navigate('Home')} style={styles.archiveButton}>
                Open Home archive
              </Button>
            </Card.Content>
          </Card>
        </ScrollView>
      </SafeAreaView>
      <Portal>
        <Dialog visible={!!deleteTarget} onDismiss={() => !deleting && setDeleteTarget(null)} style={styles.dialog}>
          <Dialog.Title>Delete this item?</Dialog.Title>
          <Dialog.Content>
            <Paragraph>
              {deleteTarget?.label ?? 'This item'} will be removed from your Love Space. This cannot be undone.
            </Paragraph>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button onPress={() => void handleDelete()} loading={deleting} disabled={deleting}>
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
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
  syncText: {
    color: '#B25B63',
    fontWeight: '600',
  },
  errorText: {
    color: '#B25B63',
    fontWeight: '600',
  },
  connectionCard: {
    borderRadius: 24,
    backgroundColor: '#F8E2D8',
  },
  connectionCardContent: {
    paddingVertical: 10,
  },
  connectionBody: {
    marginTop: 6,
    color: '#3F2831',
    lineHeight: 20,
    opacity: 0.78,
  },
  foundationCard: {
    borderRadius: 24,
    backgroundColor: '#FFF7F2',
  },
  libraryCard: {
    borderRadius: 24,
    backgroundColor: '#F8E2D8',
  },
  foundationBody: {
    color: '#5B4148',
    lineHeight: 20,
  },
  foundationMeta: {
    color: '#7C5964',
    lineHeight: 20,
  },
  stack: {
    gap: 10,
  },
  choiceGroup: {
    gap: 8,
  },
  choiceLabel: {
    color: '#3F2831',
    fontWeight: '700',
  },
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choiceButton: {
    borderRadius: 999,
  },
  listCard: {
    borderRadius: 18,
    padding: 12,
    gap: 6,
    backgroundColor: '#FFF9F5',
    borderWidth: 1,
    borderColor: '#F2D3C7',
  },
  listTitle: {
    color: '#3F2831',
    fontWeight: '700',
  },
  listMeta: {
    color: '#7C5964',
    lineHeight: 18,
  },
  hero: {
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    backgroundColor: '#F6D3C7',
  },
  heroTitle: {
    color: '#3F2831',
    fontWeight: '700',
  },
  heroBody: {
    color: '#5B4148',
    lineHeight: 20,
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
  input: {
    minHeight: 80,
    backgroundColor: '#FFF9F5',
  },
  shortInput: {
    backgroundColor: '#FFF9F5',
  },
  inputContent: {
    paddingTop: 9,
    paddingBottom: 9,
    textAlignVertical: 'top',
  },
  inputOutline: {
    borderRadius: 18,
    borderWidth: 1,
  },
  characterCount: {
    textAlign: 'right',
    color: '#B25B63',
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  primaryButton: {
    borderRadius: 14,
  },
  primarySmallButton: {
    borderRadius: 12,
  },
  primaryButtonDisabled: {
    borderWidth: 1,
    borderColor: '#D2BCB5',
  },
  archiveMeta: {
    marginTop: 8,
    color: '#7C5964',
    lineHeight: 20,
  },
  archiveButton: {
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  dialog: {
    borderRadius: 18,
  },
  snackbar: {
    margin: 16,
    borderRadius: 12,
  },
});
