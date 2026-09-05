import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAuth } from '@react-native-firebase/auth';
import {
  Button,
  Card,
  Dialog,
  HelperText,
  Portal,
  SegmentedButtons,
  Snackbar,
  Surface,
  Text,
  TextInput,
} from 'react-native-paper';
import {
  deleteInsightEntry,
  saveInsightEntry,
  shareInsightEntry,
  updateInsightEntry,
} from '../lib/relationshipSync';
import { MainTabParamList } from '../navigation/MainNavigator';
import {
  useInsightsStore,
  type InsightEntry,
  type InsightVisibility,
} from '../store/useInsightsStore';
import { useLoveActionStore } from '../store/useLoveActionStore';
import { useRelationshipStore } from '../store/useRelationshipStore';

function formatInsightDate(createdAt: number) {
  return new Date(createdAt).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getScaleHint(value: number, labels: string[]) {
  return labels[Math.max(0, Math.min(labels.length - 1, value - 1))];
}

function getVisibilityLabel(visibility: InsightVisibility) {
  switch (visibility) {
    case 'private':
      return 'Private to you';
    case 'decideLater':
      return 'Decide later';
    default:
      return 'Shared with partner';
  }
}

function getVisibilityBadgeLabel(visibility: InsightVisibility) {
  switch (visibility) {
    case 'private':
      return 'Private';
    case 'decideLater':
      return 'Later';
    default:
      return 'Shared';
  }
}

function getInsightPreview(entry: InsightEntry) {
  return entry.reflection || entry.appreciation || entry.need || entry.nextStep || 'Saved insight';
}

function formatLoveActionMetricDate(timestamp: number | null) {
  if (!timestamp) {
    return 'No date yet';
  }

  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

const MOOD_HINTS = ['Heavy', 'Tender', 'Steady', 'Open', 'Lit up'];
const CONNECTION_HINTS = ['Distant', 'Off', 'Okay', 'Close', 'Deeply connected'];
const TENSION_HINTS = ['Calm', 'Gentle', 'Present', 'Strained', 'High tension'];

type ArchiveFilter = 'private' | 'decideLater' | 'shared';

type EntryContext = {
  entry: InsightEntry;
  source: 'private' | 'shared';
  linkedPrivateEntryId?: string | null;
};

type ScoreWindow = '7d' | '30d';

function RatingField({
  label,
  value,
  onChange,
  hints,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  hints: string[];
}) {
  return (
    <View style={styles.ratingBlock}>
      <View style={styles.ratingHeaderRow}>
        <Text variant="titleMedium" style={styles.cardTitle}>
          {label}
        </Text>
        <Text style={styles.ratingHint}>{getScaleHint(value, hints)}</Text>
      </View>
      <View style={styles.ratingScale}>
        {Array.from({ length: 5 }, (_, index) => {
          const optionValue = index + 1;
          const selected = optionValue === value;

          return (
            <Pressable
              key={optionValue}
              onPress={() => onChange(optionValue)}
              style={({ pressed }) => [
                styles.ratingOption,
                selected && styles.ratingOptionActive,
                pressed && styles.ratingOptionPressed,
              ]}
            >
              <Text style={[styles.ratingOptionLabel, selected && styles.ratingOptionLabelActive]}>
                {optionValue}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function InsightCard({
  entry,
  showAuthor,
  shareEnabled,
  sharing,
  managing,
  isEditing,
  canManage,
  onShare,
  onEdit,
  onDelete,
}: {
  entry: InsightEntry;
  showAuthor?: boolean;
  shareEnabled?: boolean;
  sharing?: boolean;
  managing?: boolean;
  isEditing?: boolean;
  canManage?: boolean;
  onShare?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <Card style={[styles.entryCard, isEditing && styles.entryCardActive]}>
      <Card.Content style={styles.entryCardContent}>
        <View style={styles.entryHeaderRow}>
          <View style={styles.entryHeaderCopy}>
            <Text variant="titleSmall" style={styles.entryDate}>
              {formatInsightDate(entry.createdAt)}
            </Text>
            <Text style={styles.entryMeta}>{getVisibilityLabel(entry.visibility)}</Text>
          </View>
          <View style={styles.visibilityPill}>
            <Text style={styles.visibilityPillText}>{getVisibilityBadgeLabel(entry.visibility)}</Text>
          </View>
        </View>
        {showAuthor ? <Text style={styles.entryAuthor}>From {entry.createdByEmail}</Text> : null}
        <View style={styles.metricsRow}>
          <View style={styles.metricPill}>
            <Text style={styles.metricLabel}>Mood {entry.mood}/5</Text>
          </View>
          <View style={styles.metricPill}>
            <Text style={styles.metricLabel}>Connection {entry.connection}/5</Text>
          </View>
          <View style={styles.metricPill}>
            <Text style={styles.metricLabel}>Tension {entry.tension}/5</Text>
          </View>
        </View>
        <Text style={styles.entryPreview}>{getInsightPreview(entry)}</Text>
        {entry.appreciation ? <Text style={styles.entryDetail}>Appreciation: {entry.appreciation}</Text> : null}
        {entry.need ? <Text style={styles.entryDetail}>Need: {entry.need}</Text> : null}
        {entry.nextStep ? <Text style={styles.entryDetail}>Next step: {entry.nextStep}</Text> : null}
        {shareEnabled && onShare && !isEditing ? (
          <Button
            mode="outlined"
            onPress={onShare}
            loading={sharing}
            disabled={sharing || managing}
            style={styles.shareButton}
          >
            Share with partner
          </Button>
        ) : null}
        {canManage && (onEdit || onDelete) ? (
          <View style={styles.entryActionRow}>
            {isEditing ? (
              <View style={styles.editingBadge}>
                <Text style={styles.editingBadgeText}>Editing above</Text>
              </View>
            ) : null}
            <View style={styles.entryActionButtons}>
              {onEdit && !isEditing ? (
                <Button mode="contained-tonal" onPress={onEdit} disabled={sharing || managing}>
                  Edit
                </Button>
              ) : null}
              {onDelete ? (
                <Button mode="text" onPress={onDelete} disabled={sharing || managing}>
                  Delete
                </Button>
              ) : null}
            </View>
          </View>
        ) : null}
      </Card.Content>
    </Card>
  );
}

export default function InsightsScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const user = getAuth().currentUser;
  const relationshipSyncing = useRelationshipStore(state => state.syncing);
  const relationshipError = useRelationshipStore(state => state.error);
  const profile = useRelationshipStore(state => state.profile);
  const hydrated = useInsightsStore(state => state.hydrated);
  const syncingPrivate = useInsightsStore(state => state.syncingPrivate);
  const syncingShared = useInsightsStore(state => state.syncingShared);
  const privateEntries = useInsightsStore(state => state.privateEntries);
  const sharedEntries = useInsightsStore(state => state.sharedEntries);
  const loveActions = useLoveActionStore(state => state.actions);
  const [mood, setMood] = useState(3);
  const [connection, setConnection] = useState(3);
  const [tension, setTension] = useState(2);
  const [appreciation, setAppreciation] = useState('');
  const [need, setNeed] = useState('');
  const [reflection, setReflection] = useState('');
  const [nextStep, setNextStep] = useState('');
  const [visibility, setVisibility] = useState<InsightVisibility>(profile?.coupleId ? 'decideLater' : 'private');
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilter>('private');
  const [scoreWindow, setScoreWindow] = useState<ScoreWindow>('7d');
  const [editingContext, setEditingContext] = useState<EntryContext | null>(null);
  const [deleteContext, setDeleteContext] = useState<EntryContext | null>(null);
  const [saving, setSaving] = useState(false);
  const [sharingEntryId, setSharingEntryId] = useState<string | null>(null);
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState('');

  const writtenCount = useMemo(
    () => [appreciation, need, reflection, nextStep].filter(value => value.trim().length > 0).length,
    [appreciation, need, reflection, nextStep],
  );
  const privateOnlyEntries = useMemo(
    () => privateEntries.filter(entry => entry.visibility === 'private'),
    [privateEntries],
  );
  const laterEntries = useMemo(
    () => privateEntries.filter(entry => entry.visibility === 'decideLater'),
    [privateEntries],
  );
  const linkedPrivateEntriesBySharedId = useMemo(
    () =>
      new Map(
        privateEntries
          .filter(entry => !!entry.sharedInsightId)
          .map(entry => [entry.sharedInsightId as string, entry.id]),
      ),
    [privateEntries],
  );
  const archiveEntries = useMemo(() => {
    switch (archiveFilter) {
      case 'private':
        return privateOnlyEntries;
      case 'decideLater':
        return laterEntries;
      default:
        return sharedEntries;
    }
  }, [archiveFilter, laterEntries, privateOnlyEntries, sharedEntries]);
  const scoreWindowStart = useMemo(() => {
    const now = Date.now();
    return now - (scoreWindow === '7d' ? 7 : 30) * 24 * 60 * 60 * 1000;
  }, [scoreWindow]);
  const connectionScoreActions = useMemo(
    () =>
      loveActions.filter(action => {
        if (
          action.status !== 'scheduled'
          && action.status !== 'due'
          && action.status !== 'performed'
          && action.status !== 'confirmed'
          && action.status !== 'appreciated'
        ) {
          return false;
        }

        const scoreTimestamp = action.lastCompletedAt ?? action.nextDueAt ?? action.updatedAt;
        return scoreTimestamp >= scoreWindowStart;
      }),
    [loveActions, scoreWindowStart],
  );
  const completedLoveActions = useMemo(
    () =>
      connectionScoreActions.filter(
        action => action.status === 'performed' || action.status === 'confirmed' || action.status === 'appreciated',
      ),
    [connectionScoreActions],
  );
  const appreciatedLoveActions = useMemo(
    () => connectionScoreActions.filter(action => action.status === 'appreciated'),
    [connectionScoreActions],
  );
  const connectionScore = useMemo(() => {
    if (connectionScoreActions.length === 0) {
      return 0;
    }

    const completedRatio = completedLoveActions.length / connectionScoreActions.length;
    const appreciatedRatio = appreciatedLoveActions.length / connectionScoreActions.length;

    return Math.round(Math.min(100, completedRatio * 70 + appreciatedRatio * 30) * 100) / 100;
  }, [appreciatedLoveActions.length, completedLoveActions.length, connectionScoreActions.length]);
  const recentRelationshipFollowThrough = useMemo(
    () =>
      completedLoveActions
        .slice()
        .sort((left, right) => (right.lastCompletedAt ?? right.updatedAt) - (left.lastCompletedAt ?? left.updatedAt))
        .slice(0, 5),
    [completedLoveActions],
  );
  const loadingCopy = !hydrated || relationshipSyncing || syncingPrivate || syncingShared;
  const canSubmit = hydrated && writtenCount > 0 && !saving;

  const resetForm = () => {
    setMood(3);
    setConnection(3);
    setTension(2);
    setAppreciation('');
    setNeed('');
    setReflection('');
    setNextStep('');
    setVisibility(profile?.coupleId ? 'decideLater' : 'private');
  };

  const loadEntryIntoForm = (entry: InsightEntry, nextVisibility = entry.visibility) => {
    setMood(entry.mood);
    setConnection(entry.connection);
    setTension(entry.tension);
    setAppreciation(entry.appreciation);
    setNeed(entry.need);
    setReflection(entry.reflection);
    setNextStep(entry.nextStep);
    setVisibility(nextVisibility);
  };

  const cancelEditing = () => {
    setEditingContext(null);
    resetForm();
  };

  const handleStartEditing = (context: EntryContext) => {
    setEditingContext(context);
    loadEntryIntoForm(context.entry, context.source === 'shared' ? 'shared' : context.entry.visibility);
    setSnackbar(context.source === 'shared' ? 'Editing shared insight.' : 'Editing saved reflection.');
  };

  const handleSave = async () => {
    if (!user) {
      setSnackbar('Sign in again to save this insight.');
      return;
    }

    if (visibility === 'shared' && !profile?.coupleId) {
      setSnackbar('Connect with your partner in Us before sharing insights.');
      return;
    }

    setSaving(true);

    try {
      const input = {
        mood,
        connection,
        tension,
        appreciation,
        need,
        reflection,
        nextStep,
      };

      if (editingContext) {
        await updateInsightEntry(user, editingContext.entry, input, {
          source: editingContext.source,
          linkedPrivateEntryId: editingContext.linkedPrivateEntryId ?? null,
        });
        cancelEditing();
        setSnackbar(
          editingContext.source === 'shared'
            ? 'Shared insight updated.'
            : editingContext.entry.visibility === 'decideLater'
              ? 'Later reflection updated.'
              : 'Private reflection updated.',
        );
      } else {
        await saveInsightEntry(user, input, visibility);
        resetForm();
        setSnackbar(
          visibility === 'shared'
            ? 'Insight shared to your relationship space.'
            : visibility === 'decideLater'
              ? 'Insight saved so you can decide later.'
              : 'Insight saved privately.',
        );
      }
    } catch (error: any) {
      setSnackbar(error.message ?? 'Unable to save this insight right now.');
    } finally {
      setSaving(false);
    }
  };

  const handleSharePrivateEntry = async (entry: InsightEntry) => {
    if (!user) {
      setSnackbar('Sign in again to share this insight.');
      return;
    }

    setSharingEntryId(entry.id);

    try {
      await shareInsightEntry(user, entry);
      if (editingContext?.entry.id === entry.id && editingContext.source === 'private') {
        cancelEditing();
      }
      setSnackbar('That insight is now shared with your partner.');
      setArchiveFilter('shared');
    } catch (error: any) {
      setSnackbar(error.message ?? 'Unable to share that insight right now.');
    } finally {
      setSharingEntryId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!user || !deleteContext) {
      return;
    }

    setDeletingEntryId(deleteContext.entry.id);

    try {
      await deleteInsightEntry(user, deleteContext.entry, {
        source: deleteContext.source,
        linkedPrivateEntryId: deleteContext.linkedPrivateEntryId ?? null,
      });
      if (editingContext?.entry.id === deleteContext.entry.id && editingContext.source === deleteContext.source) {
        cancelEditing();
      }
      setSnackbar(
        deleteContext.source === 'shared' && deleteContext.linkedPrivateEntryId
          ? 'Shared insight deleted. Your private copy moved back to Later.'
          : deleteContext.source === 'shared'
            ? 'Shared insight deleted.'
            : 'Saved reflection deleted.',
      );
      if (deleteContext.source === 'shared' && deleteContext.linkedPrivateEntryId) {
        setArchiveFilter('decideLater');
      }
      setDeleteContext(null);
    } catch (error: any) {
      setSnackbar(error.message ?? 'Unable to delete that insight right now.');
    } finally {
      setDeletingEntryId(null);
    }
  };

  const archiveDescription =
    archiveFilter === 'shared'
      ? 'Entries you or your partner have intentionally brought into the shared relationship space.'
      : archiveFilter === 'decideLater'
        ? 'Reflections you saved for yourself until you decide whether to share them.'
        : 'Reflections that stay private to your account.';

  const visibilityButtons = editingContext
    ? [
        {
          value: 'private',
          label: 'Private',
          disabled: visibility !== 'private',
        },
        {
          value: 'decideLater',
          label: 'Later',
          disabled: visibility !== 'decideLater',
        },
        {
          value: 'shared',
          label: 'Share',
          disabled: visibility !== 'shared',
        },
      ]
    : [
        { value: 'private', label: 'Private' },
        { value: 'decideLater', label: 'Later' },
        { value: 'shared', label: 'Share', disabled: !profile?.coupleId },
      ];

  return (
    <>
      <SafeAreaView style={styles.screen} edges={['top']}>
        <ScrollView
          contentInsetAdjustmentBehavior="never"
          style={styles.scrollView}
          contentContainerStyle={styles.content}
        >
        <Text variant="headlineMedium" style={styles.header}>
          Insights
        </Text>
        <Text style={styles.subheader}>
          Check in with yourself, name the pulse between you, and choose whether this reflection stays private or becomes shared.
        </Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryPill}>
            <Text style={styles.summaryLabel}>Private {privateOnlyEntries.length}</Text>
          </View>
          <View style={styles.summaryPill}>
            <Text style={styles.summaryLabel}>Later {laterEntries.length}</Text>
          </View>
          <View style={styles.summaryPill}>
            <Text style={styles.summaryLabel}>Shared {sharedEntries.length}</Text>
          </View>
          <View style={styles.summaryPill}>
            <Text style={styles.summaryLabel}>Score {Math.round(connectionScore)}</Text>
          </View>
          <View style={styles.summaryPill}>
            <Text style={styles.summaryLabel}>{profile?.coupleId ? 'Connected' : 'Solo'}</Text>
          </View>
        </View>
        {loadingCopy ? <Text style={styles.syncText}>Syncing your reflection space...</Text> : null}
        {!!relationshipError ? <Text style={styles.errorText}>{relationshipError}</Text> : null}
        {!profile?.coupleId ? (
          <Card style={styles.connectionCard}>
            <Card.Content style={styles.connectionCardContent}>
              <Text variant="titleMedium" style={styles.cardTitle}>
                Shared insights unlock after you connect
              </Text>
              <Text style={styles.connectionBody}>
                You can save private reflections now. Connect in Us when you’re ready to share relationship pulse check-ins with your partner.
              </Text>
              <Button mode="contained" onPress={() => navigation.navigate('Us')} style={styles.primaryButton}>
                Go to Us
              </Button>
            </Card.Content>
          </Card>
        ) : null}
        <Card style={styles.archiveCard}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <Text variant="titleMedium" style={styles.cardTitle}>
                Connection Score
              </Text>
              <Text style={styles.sectionMeta}>
                A starting score based on shared Love Action follow-through, confirmation, and appreciation.
              </Text>
            </View>
            <Surface style={styles.segmentedWrap} elevation={0}>
              <SegmentedButtons
                value={scoreWindow}
                onValueChange={nextValue => setScoreWindow(nextValue as ScoreWindow)}
                buttons={[
                  { value: '7d', label: 'Last 7 days' },
                  { value: '30d', label: 'Last 30 days' },
                ]}
                style={styles.archiveFilterSelector}
                theme={{ roundness: 999 }}
              />
            </Surface>
            <View style={styles.metricsRow}>
              <View style={styles.metricPill}>
                <Text style={styles.metricLabel}>Score {Math.round(connectionScore)}/100</Text>
              </View>
              <View style={styles.metricPill}>
                <Text style={styles.metricLabel}>Completed {completedLoveActions.length}</Text>
              </View>
              <View style={styles.metricPill}>
                <Text style={styles.metricLabel}>Appreciated {appreciatedLoveActions.length}</Text>
              </View>
            </View>
            <Text style={styles.archiveMeta}>
              {connectionScoreActions.length === 0
                ? `No shared Love Actions are feeding this ${scoreWindow === '7d' ? '7-day' : '30-day'} score yet. Once shared actions are scheduled and completed, Insights will start reflecting them here.`
                : `${connectionScoreActions.length} shared Love Actions are currently contributing to this ${scoreWindow === '7d' ? '7-day' : '30-day'} score.`}
            </Text>
            <View style={styles.entryList}>
              {recentRelationshipFollowThrough.length === 0 ? (
                <Text style={styles.emptyCopy}>No completed Love Actions yet.</Text>
              ) : (
                recentRelationshipFollowThrough.map(action => (
                  <Card key={action.id} style={styles.entryCard}>
                    <Card.Content style={styles.entryCardContent}>
                      <View style={styles.entryHeaderRow}>
                        <View style={styles.entryHeaderCopy}>
                          <Text variant="titleSmall" style={styles.entryDate}>
                            {formatLoveActionMetricDate(action.lastCompletedAt ?? action.updatedAt)}
                          </Text>
                          <Text style={styles.entryMeta}>{action.title}</Text>
                        </View>
                        <View style={styles.visibilityPill}>
                          <Text style={styles.visibilityPillText}>{action.status}</Text>
                        </View>
                      </View>
                      <View style={styles.metricsRow}>
                        <View style={styles.metricPill}>
                          <Text style={styles.metricLabel}>Due {formatLoveActionMetricDate(action.nextDueAt)}</Text>
                        </View>
                        <View style={styles.metricPill}>
                          <Text style={styles.metricLabel}>Confirmed {action.confirmationReaction ?? '—'}</Text>
                        </View>
                        <View style={styles.metricPill}>
                          <Text style={styles.metricLabel}>Appreciated {action.appreciationReaction ?? '—'}</Text>
                        </View>
                      </View>
                      {!!action.confirmationNote ? (
                        <Text style={styles.entryDetail}>Confirmation note: {action.confirmationNote}</Text>
                      ) : null}
                      {!!action.appreciationNote ? (
                        <Text style={styles.entryDetail}>Appreciation note: {action.appreciationNote}</Text>
                      ) : null}
                    </Card.Content>
                  </Card>
                ))
              )}
            </View>
          </Card.Content>
        </Card>
        <Surface style={styles.hero} elevation={0}>
          <Text variant="titleMedium" style={styles.heroTitle}>
            Daily check-in + relationship pulse
          </Text>
          <Text style={styles.heroBody}>
            Capture how you feel, how connected you feel, where tension is sitting, what you appreciated, what you need, and what move helps next.
          </Text>
        </Surface>
        <Card style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <View style={styles.sectionHeader}>
              <Text variant="titleMedium" style={styles.cardTitle}>
                {editingContext ? 'Edit this reflection' : 'Save this reflection as'}
              </Text>
              <Text style={styles.sectionMeta}>
                {editingContext
                  ? editingContext.source === 'shared'
                    ? 'You are editing a shared insight that your partner can see'
                    : 'You are editing a saved reflection in your personal archive'
                  : 'Choose the privacy level first'}
              </Text>
            </View>
            {editingContext ? (
              <Surface style={styles.editBanner} elevation={0}>
                <Text style={styles.editBannerTitle}>
                  {editingContext.source === 'shared' ? 'Shared insight' : 'Saved reflection'}
                </Text>
                <Text style={styles.editBannerBody}>
                  Visibility stays locked while editing. Use Share with partner from the archive when you want to move a private or later reflection into shared.
                </Text>
              </Surface>
            ) : null}
            <Surface style={styles.segmentedWrap} elevation={0}>
              <SegmentedButtons
                value={visibility}
                onValueChange={nextValue => {
                  if (!editingContext) {
                    setVisibility(nextValue as InsightVisibility);
                  }
                }}
                buttons={visibilityButtons}
                style={styles.visibilitySelector}
                theme={{ roundness: 999 }}
              />
            </Surface>
            <HelperText type="info" visible>
              {visibility === 'shared'
                ? 'This entry will sync into the shared relationship space.'
                : visibility === 'decideLater'
                  ? 'This saves to your private archive until you decide whether to share it.'
                  : 'This stays synced only to your account.'}
            </HelperText>
            <View style={styles.sectionHeader}>
              <Text variant="titleMedium" style={styles.cardTitle}>
                Pulse check
              </Text>
              <Text style={styles.sectionMeta}>Use the scale to name the temperature of today</Text>
            </View>
            <View style={styles.ratingStack}>
              <RatingField label="How do you feel right now?" value={mood} onChange={setMood} hints={MOOD_HINTS} />
              <RatingField
                label="How connected do you feel to us?"
                value={connection}
                onChange={setConnection}
                hints={CONNECTION_HINTS}
              />
              <RatingField label="How much tension is present?" value={tension} onChange={setTension} hints={TENSION_HINTS} />
            </View>
            <View style={styles.sectionHeader}>
              <Text variant="titleMedium" style={styles.cardTitle}>
                Words for today
              </Text>
              <Text style={styles.sectionMeta}>Write as little or as much as you need</Text>
            </View>
            <TextInput
              mode="outlined"
              label="What felt good today?"
              value={appreciation}
              onChangeText={setAppreciation}
              multiline
              numberOfLines={3}
              style={styles.input}
              contentStyle={styles.inputContent}
              outlineStyle={styles.inputOutline}
              outlineColor="#E7C9BF"
              activeOutlineColor="#D79395"
              placeholder="I felt close to you when..."
            />
            <TextInput
              mode="outlined"
              label="What do you need more of?"
              value={need}
              onChangeText={setNeed}
              multiline
              numberOfLines={3}
              style={styles.input}
              contentStyle={styles.inputContent}
              outlineStyle={styles.inputOutline}
              outlineColor="#E7C9BF"
              activeOutlineColor="#D79395"
              placeholder="I need more reassurance, softness, or clarity around..."
            />
            <TextInput
              mode="outlined"
              label="What truth or reflection is surfacing?"
              value={reflection}
              onChangeText={setReflection}
              multiline
              numberOfLines={4}
              style={styles.input}
              contentStyle={styles.inputContent}
              outlineStyle={styles.inputOutline}
              outlineColor="#E7C9BF"
              activeOutlineColor="#D79395"
              placeholder="Today I realized..."
            />
            <TextInput
              mode="outlined"
              label="What is one next step for us?"
              value={nextStep}
              onChangeText={setNextStep}
              multiline
              numberOfLines={3}
              style={styles.input}
              contentStyle={styles.inputContent}
              outlineStyle={styles.inputOutline}
              outlineColor="#E7C9BF"
              activeOutlineColor="#D79395"
              placeholder="Tonight let's..."
            />
            <HelperText type={writtenCount === 0 ? 'error' : 'info'} visible>
              {writtenCount === 0
                ? 'Add at least one written response before saving.'
                : 'The strongest entries usually include one appreciation and one honest need.'}
            </HelperText>
            <View style={styles.actionsRow}>
              <Button
                mode="contained"
                onPress={() => void handleSave()}
                loading={saving}
                disabled={!canSubmit}
                style={[styles.primaryButton, !canSubmit && styles.primaryButtonDisabled]}
                buttonColor={canSubmit ? '#B25B63' : '#D7C3BC'}
                textColor={canSubmit ? '#FFF8F3' : '#8D7279'}
              >
                {editingContext ? 'Save changes' : 'Save insight'}
              </Button>
              {editingContext ? (
                <Button mode="outlined" onPress={cancelEditing} disabled={saving}>
                  Cancel edit
                </Button>
              ) : (
                <Button mode="outlined" onPress={resetForm} disabled={saving}>
                  Clear form
                </Button>
              )}
            </View>
          </Card.Content>
        </Card>
        <Card style={styles.archiveCard}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <Text variant="titleMedium" style={styles.cardTitle}>
                Saved reflections
              </Text>
              <Text style={styles.sectionMeta}>Filter your archive by privacy state</Text>
            </View>
            <Surface style={styles.segmentedWrap} elevation={0}>
              <SegmentedButtons
                value={archiveFilter}
                onValueChange={nextValue => setArchiveFilter(nextValue as ArchiveFilter)}
                buttons={[
                  { value: 'private', label: 'Private' },
                  { value: 'decideLater', label: 'Later' },
                  { value: 'shared', label: 'Shared' },
                ]}
                style={styles.archiveFilterSelector}
                theme={{ roundness: 999 }}
              />
            </Surface>
            <Text style={styles.archiveMeta}>{archiveDescription}</Text>
            <View style={styles.entryList}>
              {archiveEntries.length === 0 ? (
                <Text style={styles.emptyCopy}>
                  {archiveFilter === 'shared'
                    ? profile?.coupleId
                      ? 'Nothing shared yet. Save one as Share or share a saved reflection later.'
                      : 'Connect in Us first to unlock shared insights.'
                    : archiveFilter === 'decideLater'
                      ? 'No later reflections yet. Save one with the Later option above.'
                      : 'No private reflections yet. Save your first reflection above.'}
                </Text>
              ) : (
                archiveEntries.map(entry => {
                  const linkedPrivateEntryId = entry.visibility === 'shared'
                    ? linkedPrivateEntriesBySharedId.get(entry.id) ?? null
                    : null;
                  const isOwnEntry = entry.createdByUserId === user?.uid;
                  const source = archiveFilter === 'shared' ? 'shared' : 'private';
                  const isEditingEntry =
                    editingContext?.entry.id === entry.id && editingContext.source === source;
                  return (
                    <InsightCard
                      key={entry.id}
                      entry={entry}
                      showAuthor={archiveFilter === 'shared' && !isOwnEntry}
                      shareEnabled={
                        source === 'private' && !!profile?.coupleId && entry.visibility !== 'shared'
                      }
                      sharing={sharingEntryId === entry.id}
                      managing={deletingEntryId === entry.id || saving}
                      isEditing={isEditingEntry}
                      canManage={isOwnEntry}
                      onShare={
                        source === 'private' ? () => void handleSharePrivateEntry(entry) : undefined
                      }
                      onEdit={
                        isOwnEntry
                          ? () =>
                              handleStartEditing({
                                entry,
                                source,
                                linkedPrivateEntryId,
                              })
                          : undefined
                      }
                      onDelete={
                        isOwnEntry
                          ? () =>
                              setDeleteContext({
                                entry,
                                source,
                                linkedPrivateEntryId,
                              })
                          : undefined
                      }
                    />
                  );
                })
              )}
            </View>
          </Card.Content>
        </Card>
        </ScrollView>
      </SafeAreaView>
      <Portal>
        <Dialog
          visible={!!deleteContext}
          onDismiss={() => {
            if (!deletingEntryId) {
              setDeleteContext(null);
            }
          }}
          style={styles.dialog}
        >
          <Dialog.Title>
            {deleteContext?.source === 'shared' ? 'Delete shared insight?' : 'Delete saved reflection?'}
          </Dialog.Title>
          <Dialog.Content>
            <Text style={styles.dialogBody}>
              {deleteContext?.source === 'shared'
                ? deleteContext.linkedPrivateEntryId
                  ? 'This removes the shared version for both partners and moves your private copy back into Later.'
                  : 'This removes the shared version from your relationship space.'
                : 'This permanently removes this saved reflection from your private archive.'}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteContext(null)} disabled={!!deletingEntryId}>
              Cancel
            </Button>
            <Button onPress={() => void handleConfirmDelete()} loading={!!deletingEntryId} disabled={!!deletingEntryId}>
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
    gap: 12,
    paddingBottom: 32,
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
  hero: {
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 6,
    backgroundColor: '#F6D3C7',
  },
  heroTitle: {
    color: '#3F2831',
    fontWeight: '700',
  },
  heroBody: {
    color: '#5B4148',
    lineHeight: 19,
  },
  card: {
    borderRadius: 26,
    backgroundColor: '#F8E2D8',
  },
  cardContent: {
    gap: 12,
  },
  cardTitle: {
    color: '#3F2831',
    fontWeight: '700',
  },
  sectionHeader: {
    gap: 2,
  },
  sectionMeta: {
    color: '#8F6B74',
    fontSize: 13,
    lineHeight: 18,
  },
  editBanner: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#FFF3EA',
    borderWidth: 1,
    borderColor: '#F0D0C0',
    gap: 4,
  },
  editBannerTitle: {
    color: '#3F2831',
    fontWeight: '700',
  },
  editBannerBody: {
    color: '#7C5964',
    lineHeight: 20,
  },
  segmentedWrap: {
    borderRadius: 999,
    padding: 4,
    backgroundColor: '#FBEAE3',
  },
  visibilitySelector: {
    marginTop: 0,
  },
  ratingStack: {
    gap: 10,
  },
  ratingBlock: {
    gap: 6,
  },
  ratingHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  ratingHint: {
    color: '#B25B63',
    fontWeight: '700',
    fontSize: 13,
  },
  ratingScale: {
    flexDirection: 'row',
    gap: 6,
  },
  ratingOption: {
    flex: 1,
    minHeight: 40,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EAD4CB',
    backgroundColor: '#FFFCFA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingOptionActive: {
    backgroundColor: '#F0BEB0',
    borderColor: '#CC7C82',
  },
  ratingOptionPressed: {
    opacity: 0.88,
  },
  ratingOptionLabel: {
    color: '#7C5964',
    fontWeight: '700',
    fontSize: 15,
  },
  ratingOptionLabelActive: {
    color: '#3F2831',
  },
  input: {
    minHeight: 72,
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
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  primaryButton: {
    borderRadius: 14,
  },
  primaryButtonDisabled: {
    borderWidth: 1,
    borderColor: '#D2BCB5',
  },
  archiveCard: {
    borderRadius: 24,
    backgroundColor: '#FFF7F2',
  },
  archiveFilterSelector: {
    marginTop: 0,
  },
  archiveMeta: {
    marginTop: 8,
    color: '#7C5964',
    lineHeight: 20,
  },
  entryList: {
    gap: 10,
    marginTop: 14,
  },
  entryCard: {
    borderRadius: 20,
    backgroundColor: '#FFF8F3',
    borderWidth: 1,
    borderColor: '#F0DED4',
  },
  entryCardActive: {
    backgroundColor: '#FFF1EA',
    borderColor: '#E4A9A2',
  },
  entryCardContent: {
    paddingVertical: 9,
  },
  entryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  entryHeaderCopy: {
    flex: 1,
  },
  entryDate: {
    color: '#3F2831',
    fontWeight: '700',
  },
  entryMeta: {
    marginTop: 2,
    color: '#B25B63',
    fontWeight: '600',
  },
  visibilityPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#F4D3C7',
  },
  visibilityPillText: {
    color: '#3F2831',
    fontSize: 12,
    fontWeight: '700',
  },
  entryAuthor: {
    marginTop: 10,
    color: '#7C5964',
    fontWeight: '600',
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  metricPill: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    backgroundColor: '#FFF3EA',
  },
  metricLabel: {
    color: '#3F2831',
    fontSize: 12,
    fontWeight: '700',
  },
  entryPreview: {
    marginTop: 10,
    color: '#3F2831',
    lineHeight: 20,
    fontWeight: '600',
  },
  entryDetail: {
    marginTop: 6,
    color: '#7C5964',
    lineHeight: 19,
  },
  shareButton: {
    marginTop: 12,
    alignSelf: 'flex-start',
    borderRadius: 14,
  },
  entryActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  editingBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#F7E1D7',
    borderWidth: 1,
    borderColor: '#E8B8AC',
  },
  editingBadgeText: {
    color: '#8F6B74',
    fontSize: 12,
    fontWeight: '700',
  },
  entryActionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginLeft: 'auto',
  },
  emptyCopy: {
    color: '#7C5964',
    lineHeight: 21,
  },
  dialog: {
    backgroundColor: '#FFF7F2',
  },
  dialogBody: {
    color: '#5B4148',
    lineHeight: 21,
  },
  snackbar: {
    marginHorizontal: 16,
    borderRadius: 12,
  },
});
