import type { User } from '@react-native-firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from '@react-native-firebase/firestore';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import {
  LOVE_NOTE_TAGS,
  LOVE_NOTE_TYPES,
  type LoveNoteTag,
  type LoveNoteType,
} from '../lib/loveNotes';
import {
  type MetricsWindow,
  type PulseLabel,
  type PulseTrend,
  type RelationshipMetricSnapshot,
} from '../lib/relationshipMetrics';
import { useCalendarStore, type CalendarEvent, type CalendarFoodInterestFor } from '../store/useCalendarStore';
import {
  useInsightsStore,
  type InsightEntry,
  type InsightVisibility,
} from '../store/useInsightsStore';
import {
  useLoveActionStore,
  type LoveAction,
  type LoveActionStatus,
} from '../store/useLoveActionStore';
import {
  useLoveProfileStore,
  type LoveArea,
  type LovePreference,
  type LovePreferenceFrequency,
  type LovePreferenceImportance,
  type LovePreferenceSource,
  type LovePreferenceTiming,
  type LovePreferenceVisibility,
} from '../store/useLoveProfileStore';
import {
  useMirrorMessageStore,
  type MirrorMessage,
  type MirrorPoint,
  type MirrorStroke,
} from '../store/useMirrorMessageStore';
import {
  useRelationshipStore,
  type NotificationPrivacyPreference,
  type PartnerInvite,
  type PartnerRevealProfile,
  type RelationshipProfile,
} from '../store/useRelationshipStore';

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function requireUserEmail(user: User) {
  const email = user.email?.trim();

  if (!email) {
    throw new Error('Your account needs an email address before it can connect with a partner.');
  }

  return email;
}

function toMillis(value: any) {
  if (value && typeof value.toMillis === 'function') {
    return value.toMillis();
  }

  return Date.now();
}

function mapMirrorPoint(value: any): MirrorPoint | null {
  const x = Number(value?.x);
  const y = Number(value?.y);

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  return { x, y };
}

function mapMirrorStroke(value: any): MirrorStroke {
  const points = Array.isArray(value) ? value : value?.points;

  if (!Array.isArray(points)) {
    return [];
  }

  return points.map(mapMirrorPoint).filter((point): point is MirrorPoint => !!point);
}

function mapMirrorStrokes(value: any): MirrorStroke[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(mapMirrorStroke).filter(stroke => stroke.length > 0);
}

function serializeMirrorStrokes(strokes: MirrorStroke[]) {
  return strokes
    .filter(stroke => stroke.length > 0)
    .map(stroke => ({
      points: stroke.map(point => ({
        x: Math.round(point.x * 10) / 10,
        y: Math.round(point.y * 10) / 10,
      })),
    }));
}

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
const LOVE_PREFERENCE_IMPORTANCE: LovePreferenceImportance[] = ['low', 'medium', 'high', 'essential'];
const LOVE_PREFERENCE_FREQUENCY: LovePreferenceFrequency[] = [
  'daily',
  'severalTimesWeekly',
  'weekly',
  'monthly',
  'occasionally',
  'surpriseMe',
];
const LOVE_PREFERENCE_TIMING: LovePreferenceTiming[] = ['morning', 'evening', 'weekend', 'anytime', 'custom'];
const LOVE_PREFERENCE_VISIBILITY: LovePreferenceVisibility[] = ['private', 'shared', 'surprise'];
const LOVE_PREFERENCE_SOURCES: LovePreferenceSource[] = ['library', 'custom'];
const LOVE_ACTION_STATUSES: LoveActionStatus[] = [
  'proposed',
  'scheduled',
  'due',
  'performed',
  'confirmed',
  'appreciated',
  'needsAttention',
  'cancelled',
];
const NOTIFICATION_PRIVACY_PREFERENCES: NotificationPrivacyPreference[] = ['detailed', 'discreet', 'off'];
const METRICS_WINDOWS: MetricsWindow[] = ['7d', '30d', '90d'];
const PULSE_LABELS: PulseLabel[] = ['strained', 'fragile', 'steady', 'warming', 'deepening'];
const PULSE_TRENDS: PulseTrend[] = ['rising', 'steady', 'dipping'];

function isOneOf<T extends string>(value: any, validValues: T[]): value is T {
  return typeof value === 'string' && validValues.includes(value as T);
}

function mapLoveArea(value: any): LoveArea {
  return isOneOf(value, LOVE_AREAS) ? value : 'emotional';
}

function mapLovePreferenceImportance(value: any): LovePreferenceImportance {
  return isOneOf(value, LOVE_PREFERENCE_IMPORTANCE) ? value : 'medium';
}

function mapLovePreferenceFrequency(value: any): LovePreferenceFrequency {
  return isOneOf(value, LOVE_PREFERENCE_FREQUENCY) ? value : 'weekly';
}

function mapLovePreferenceTiming(value: any): LovePreferenceTiming {
  return isOneOf(value, LOVE_PREFERENCE_TIMING) ? value : 'anytime';
}

function mapLovePreferenceVisibility(value: any): LovePreferenceVisibility {
  return isOneOf(value, LOVE_PREFERENCE_VISIBILITY) ? value : 'private';
}

function mapLovePreferenceSource(value: any): LovePreferenceSource {
  return isOneOf(value, LOVE_PREFERENCE_SOURCES) ? value : 'custom';
}

function mapLoveActionStatus(value: any): LoveActionStatus {
  return isOneOf(value, LOVE_ACTION_STATUSES) ? value : 'proposed';
}

function mapNotificationPrivacyPreference(value: any): NotificationPrivacyPreference {
  return isOneOf(value, NOTIFICATION_PRIVACY_PREFERENCES) ? value : 'discreet';
}

function mapMetricsWindow(value: any): MetricsWindow {
  return isOneOf(value, METRICS_WINDOWS) ? value : '30d';
}

function mapPulseLabel(value: any): PulseLabel {
  return isOneOf(value, PULSE_LABELS) ? value : 'steady';
}

function mapPulseTrend(value: any): PulseTrend {
  return isOneOf(value, PULSE_TRENDS) ? value : 'steady';
}

function mapProfile(userId: string, data: any, fallbackEmail: string): RelationshipProfile {
  const email = data?.email ?? fallbackEmail;
  const displayName = typeof data?.displayName === 'string' ? data.displayName.trim() : '';

  return {
    userId,
    email,
    normalizedEmail: data?.normalizedEmail ?? normalizeEmail(email),
    partnerId: data?.partnerId ?? null,
    partnerEmail: data?.partnerEmail ?? null,
    coupleId: data?.coupleId ?? null,
    displayName,
    notificationPrivacy: mapNotificationPrivacyPreference(data?.notificationPrivacy),
    quickTipsEnabled: data?.quickTipsEnabled !== false,
    adultConfirmed: !!data?.adultConfirmedAt,
    privacyAccepted: !!data?.privacyAcceptedAt,
    safetyAccepted: !!data?.safetyAcceptedAt,
    onboardingCompleted: !!data?.onboardingCompletedAt,
    onboardingCompletedAt: data?.onboardingCompletedAt ? toMillis(data.onboardingCompletedAt) : null,
    revealSeenCoupleId: typeof data?.revealSeenCoupleId === 'string' ? data.revealSeenCoupleId : null,
  };
}

function mapPartnerReveal(document: any): PartnerRevealProfile {
  const data = document.data();

  return {
    userId: document.id,
    email: data?.email ?? '',
    displayName: data?.displayName ?? '',
    preferenceCount: Number.isFinite(Number(data?.preferenceCount)) ? Number(data.preferenceCount) : 0,
    highlightAreas: Array.isArray(data?.highlightAreas)
      ? data.highlightAreas.filter((value: unknown): value is string => typeof value === 'string')
      : [],
    highlightActions: Array.isArray(data?.highlightActions)
      ? data.highlightActions.filter((value: unknown): value is string => typeof value === 'string')
      : [],
    updatedAt: data?.updatedAt ? toMillis(data.updatedAt) : null,
  };
}

function mapInvite(document: any): PartnerInvite {
  const data = document.data();

  return {
    id: document.id,
    fromUserId: data?.fromUserId ?? '',
    fromEmail: data?.fromEmail ?? '',
    toEmail: data?.toEmail ?? '',
    status: data?.status ?? 'pending',
    createdAt: toMillis(data?.createdAt),
  };
}

function mapLoveNoteType(value: any): LoveNoteType {
  return LOVE_NOTE_TYPES.includes(value) ? value : 'warm';
}

function mapLoveNoteTags(value: any): LoveNoteTag[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((tag): tag is LoveNoteTag => LOVE_NOTE_TAGS.includes(tag));
}

function mapMessage(document: any): MirrorMessage {
  const data = document.data();

  return {
    id: document.id,
    text: data?.text ?? '',
    strokes: mapMirrorStrokes(data?.strokes),
    createdAt: toMillis(data?.createdAt),
    revealProgress: 0,
    senderId: data?.senderId ?? '',
    senderEmail: data?.senderEmail ?? '',
    noteType: mapLoveNoteType(data?.noteType),
    tags: mapLoveNoteTags(data?.tags),
    promptId: typeof data?.promptId === 'string' ? data.promptId : null,
  };
}

function mapCalendarEvent(document: any): CalendarEvent {
  const data = document.data();

  return {
    id: document.id,
    title: data?.title ?? '',
    note: data?.note ?? '',
    startsAt: toMillis(data?.startsAt),
    endsAt: data?.endsAt ? toMillis(data?.endsAt) : null,
    allDay: Boolean(data?.allDay),
    foodQuery: typeof data?.foodQuery === 'string' ? data.foodQuery : '',
    foodInterestFor:
      data?.foodInterestFor === 'partner' || data?.foodInterestFor === 'both'
        ? data.foodInterestFor
        : 'me',
    restaurantPlaceId: typeof data?.restaurantPlaceId === 'string' ? data.restaurantPlaceId : null,
    restaurantName: typeof data?.restaurantName === 'string' ? data.restaurantName : '',
    restaurantAddress: typeof data?.restaurantAddress === 'string' ? data.restaurantAddress : '',
    restaurantLatitude: typeof data?.restaurantLatitude === 'number' ? data.restaurantLatitude : null,
    restaurantLongitude: typeof data?.restaurantLongitude === 'number' ? data.restaurantLongitude : null,
    status: data?.status === 'cancelled' ? 'cancelled' : 'active',
    createdAt: toMillis(data?.createdAt),
    updatedAt: toMillis(data?.updatedAt),
    createdByUserId: data?.createdByUserId ?? '',
    createdByEmail: data?.createdByEmail ?? '',
  };
}

function mapLovePreference(document: any): LovePreference {
  const data = document.data();

  return {
    id: document.id,
    area: mapLoveArea(data?.area),
    actionText: data?.actionText ?? '',
    actionSource: mapLovePreferenceSource(data?.actionSource),
    importance: mapLovePreferenceImportance(data?.importance),
    frequency: mapLovePreferenceFrequency(data?.frequency),
    timing: mapLovePreferenceTiming(data?.timing),
    customTiming: typeof data?.customTiming === 'string' ? data.customTiming : null,
    visibility: mapLovePreferenceVisibility(data?.visibility),
    notes: data?.notes ?? '',
    createdAt: toMillis(data?.createdAt),
    updatedAt: toMillis(data?.updatedAt),
    createdByUserId: data?.createdByUserId ?? '',
    createdByEmail: data?.createdByEmail ?? '',
  };
}

function mapLoveAction(document: any): LoveAction {
  const data = document.data();

  return {
    id: document.id,
    title: data?.title ?? '',
    area: mapLoveArea(data?.area),
    preferenceId: typeof data?.preferenceId === 'string' ? data.preferenceId : null,
    notes: data?.notes ?? '',
    importance: mapLovePreferenceImportance(data?.importance),
    frequency: mapLovePreferenceFrequency(data?.frequency),
    timing: mapLovePreferenceTiming(data?.timing),
    customTiming: typeof data?.customTiming === 'string' ? data.customTiming : null,
    visibility: mapLovePreferenceVisibility(data?.visibility),
    status: mapLoveActionStatus(data?.status),
    nextDueAt: data?.nextDueAt ? toMillis(data?.nextDueAt) : null,
    lastCompletedAt: data?.lastCompletedAt ? toMillis(data?.lastCompletedAt) : null,
    respondedAt: data?.respondedAt ? toMillis(data?.respondedAt) : null,
    respondedByUserId: typeof data?.respondedByUserId === 'string' ? data.respondedByUserId : null,
    respondedByEmail: typeof data?.respondedByEmail === 'string' ? data.respondedByEmail : null,
    confirmationReaction: typeof data?.confirmationReaction === 'string' ? data.confirmationReaction : null,
    confirmationNote: typeof data?.confirmationNote === 'string' ? data.confirmationNote : '',
    appreciationReaction: typeof data?.appreciationReaction === 'string' ? data.appreciationReaction : null,
    appreciationNote: typeof data?.appreciationNote === 'string' ? data.appreciationNote : '',
    proposedByUserId: data?.proposedByUserId ?? '',
    proposedByEmail: data?.proposedByEmail ?? '',
    responsibleUserId: data?.responsibleUserId ?? '',
    responsibleUserEmail: data?.responsibleUserEmail ?? '',
    recipientUserId: data?.recipientUserId ?? '',
    recipientUserEmail: data?.recipientUserEmail ?? '',
    createdAt: toMillis(data?.createdAt),
    updatedAt: toMillis(data?.updatedAt),
  };
}

function getSoloLoveActionStatus(input: LoveActionInput) {
  const requestedStatus = mapLoveActionStatus(input.status);

  if (requestedStatus !== 'proposed') {
    return requestedStatus;
  }

  return input.nextDueAt && input.nextDueAt <= Date.now() ? 'due' : 'scheduled';
}

function buildSoloLoveActionDoc(user: User, email: string, input: LoveActionInput) {
  const title = input.title.trim();

  if (!title) {
    throw new Error('Add a short Love Action title first.');
  }

  const timing = mapLovePreferenceTiming(input.timing);

  return {
    title,
    area: mapLoveArea(input.area),
    preferenceId: input.preferenceId ?? null,
    notes: input.notes?.trim() ?? '',
    importance: mapLovePreferenceImportance(input.importance),
    frequency: mapLovePreferenceFrequency(input.frequency),
    timing,
    customTiming: timing === 'custom' ? input.customTiming?.trim() || null : null,
    visibility: mapLovePreferenceVisibility(input.visibility),
    status: getSoloLoveActionStatus(input),
    nextDueAt: typeof input.nextDueAt === 'number' && Number.isFinite(input.nextDueAt) ? new Date(input.nextDueAt) : null,
    lastCompletedAt:
      typeof input.lastCompletedAt === 'number' && Number.isFinite(input.lastCompletedAt)
        ? new Date(input.lastCompletedAt)
        : null,
    respondedAt: null,
    respondedByUserId: null,
    respondedByEmail: null,
    confirmationReaction: null,
    confirmationNote: '',
    appreciationReaction: null,
    appreciationNote: '',
    proposedByUserId: user.uid,
    proposedByEmail: email,
    responsibleUserId: user.uid,
    responsibleUserEmail: email,
    recipientUserId: user.uid,
    recipientUserEmail: email,
  };
}

function assertSoloLoveActionTransition(action: LoveAction, targetStatus: LoveActionLifecycleTarget) {
  if (targetStatus === 'due' && action.status !== 'scheduled') {
    throw new Error('Only scheduled personal Love Actions can move into due.');
  }

  if (targetStatus === 'performed' && action.status !== 'due') {
    throw new Error('Only due personal Love Actions can be marked done.');
  }

  if (targetStatus === 'confirmed' && action.status !== 'performed') {
    throw new Error('Only completed personal Love Actions can be confirmed.');
  }

  if (targetStatus === 'appreciated' && action.status !== 'performed' && action.status !== 'confirmed') {
    throw new Error('Only completed personal Love Actions can be appreciated.');
  }
}

function mapInsightEntry(document: any): InsightEntry {
  const data = document.data();
  const visibility = data?.visibility;

  return {
    id: document.id,
    mood: typeof data?.mood === 'number' ? data.mood : 3,
    connection: typeof data?.connection === 'number' ? data.connection : 3,
    tension: typeof data?.tension === 'number' ? data.tension : 3,
    appreciation: data?.appreciation ?? '',
    need: data?.need ?? '',
    reflection: data?.reflection ?? '',
    nextStep: data?.nextStep ?? '',
    visibility:
      visibility === 'shared' || visibility === 'decideLater' || visibility === 'private'
        ? visibility
        : 'private',
    sharedInsightId: data?.sharedInsightId ?? null,
    createdAt: toMillis(data?.createdAt),
    updatedAt: toMillis(data?.updatedAt),
    createdByUserId: data?.createdByUserId ?? '',
    createdByEmail: data?.createdByEmail ?? '',
  };
}

function mapMetricSnapshot(document: any): RelationshipMetricSnapshot {
  const data = document.data();

  return {
    id: document.id,
    window: mapMetricsWindow(data?.window),
    capturedDay: typeof data?.capturedDay === 'string' ? data.capturedDay : document.id,
    capturedDate: toMillis(data?.capturedDate),
    updatedAt: toMillis(data?.updatedAt),
    score: Number.isFinite(Number(data?.score)) ? Number(data.score) : 0,
    pulseLabel: mapPulseLabel(data?.pulseLabel),
    pulseTrend: mapPulseTrend(data?.pulseTrend),
    averageMood: Number.isFinite(Number(data?.averageMood)) ? Number(data.averageMood) : 0,
    averageConnection: Number.isFinite(Number(data?.averageConnection)) ? Number(data.averageConnection) : 0,
    averageTension: Number.isFinite(Number(data?.averageTension)) ? Number(data.averageTension) : 0,
    checkInStreakDays: Number.isFinite(Number(data?.checkInStreakDays)) ? Number(data.checkInStreakDays) : 0,
    sharedInsightCount: Number.isFinite(Number(data?.sharedInsightCount)) ? Number(data.sharedInsightCount) : 0,
    loveNoteCount: Number.isFinite(Number(data?.loveNoteCount)) ? Number(data.loveNoteCount) : 0,
    completedActionCount: Number.isFinite(Number(data?.completedActionCount)) ? Number(data.completedActionCount) : 0,
    appreciatedActionCount: Number.isFinite(Number(data?.appreciatedActionCount)) ? Number(data.appreciatedActionCount) : 0,
    actionReliability: Number.isFinite(Number(data?.actionReliability)) ? Number(data.actionReliability) : 0,
    appreciationScore: Number.isFinite(Number(data?.appreciationScore)) ? Number(data.appreciationScore) : 0,
    reflectionScore: Number.isFinite(Number(data?.reflectionScore)) ? Number(data.reflectionScore) : 0,
    noteCareScore: Number.isFinite(Number(data?.noteCareScore)) ? Number(data.noteCareScore) : 0,
    emotionalPresenceScore: Number.isFinite(Number(data?.emotionalPresenceScore)) ? Number(data.emotionalPresenceScore) : 0,
    dominantArea: data?.dominantArea ? mapLoveArea(data.dominantArea) : null,
    weakestArea: data?.weakestArea ? mapLoveArea(data.weakestArea) : null,
    recommendationTitles: Array.isArray(data?.recommendationTitles)
      ? data.recommendationTitles.filter((value: unknown): value is string => typeof value === 'string')
      : [],
  };
}

export type LovePreferenceInput = {
  area: LoveArea;
  actionText: string;
  actionSource?: LovePreferenceSource;
  importance?: LovePreferenceImportance;
  frequency?: LovePreferenceFrequency;
  timing?: LovePreferenceTiming;
  customTiming?: string | null;
  visibility?: LovePreferenceVisibility;
  notes?: string;
};

export type OnboardingInput = {
  displayName: string;
  notificationPrivacy: NotificationPrivacyPreference;
  starterPreferences: LovePreferenceInput[];
};

export type LoveActionInput = {
  title: string;
  area: LoveArea;
  preferenceId?: string | null;
  notes?: string;
  importance?: LovePreferenceImportance;
  frequency?: LovePreferenceFrequency;
  timing?: LovePreferenceTiming;
  customTiming?: string | null;
  visibility?: LovePreferenceVisibility;
  status?: LoveActionStatus;
  nextDueAt?: number | null;
  lastCompletedAt?: number | null;
  responsibleUserId?: string;
};

export type LoveActionProposalResponse = 'accept' | 'decline';
export type LoveActionLifecycleTarget = 'due' | 'performed' | 'confirmed' | 'appreciated';
export type LoveActionConfirmationReaction = 'yep' | 'lovedIt' | 'letsTryAgain';
export type LoveActionAppreciationReaction = 'thankYou' | 'madeMyDay' | 'morePlease';
export type PushDevicePlatform = 'ios' | 'android';
export type CalendarEventInput = {
  title: string;
  note: string;
  startsAt: Date;
  endsAt?: Date | null;
  allDay: boolean;
  foodQuery?: string;
  foodInterestFor?: CalendarFoodInterestFor;
  restaurantPlaceId?: string | null;
  restaurantName?: string;
  restaurantAddress?: string;
  restaurantLatitude?: number | null;
  restaurantLongitude?: number | null;
};
export type NearbyRestaurant = {
  placeId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  googleMapsUri: string | null;
};

async function callRelationshipFunction<
  TRequest extends object,
  TResponse extends { success: boolean } = { success: boolean },
>(name: string, data: TRequest) {
  const callable = httpsCallable<TRequest, TResponse>(getFunctions(), name);
  const result = await callable(data);
  return result.data;
}

export function resetRelationshipState() {
  useRelationshipStore.getState().reset();
  useLoveProfileStore.getState().clearPreferences();
  useLoveActionStore.getState().clearActions();
  useMirrorMessageStore.getState().clearMessages();
  useCalendarStore.getState().clearEvents();
  useInsightsStore.getState().clearEntries();
}

export function startRelationshipSync(user: User) {
  const firestore = getFirestore();
  const email = requireUserEmail(user);
  const normalizedEmail = normalizeEmail(email);
  const relationshipStore = useRelationshipStore.getState();
  const loveProfileStore = useLoveProfileStore.getState();
  const loveActionStore = useLoveActionStore.getState();
  const mirrorStore = useMirrorMessageStore.getState();
  const calendarStore = useCalendarStore.getState();
  const insightsStore = useInsightsStore.getState();
  relationshipStore.setSyncing(true);
  relationshipStore.setError('');
  loveProfileStore.setSyncing(true);
  loveActionStore.setSyncing(true);
  mirrorStore.setSyncing(true);
  calendarStore.setSyncing(true);
  insightsStore.setSyncingPrivate(true);
  insightsStore.setSyncingShared(true);
  insightsStore.setSyncingSnapshots(true);

  const userRef = doc(firestore, 'users', user.uid);
  const lovePreferencesQuery = query(
    collection(firestore, 'users', user.uid, 'lovePreferences'),
    orderBy('updatedAt', 'desc'),
    limit(200),
  );
  const privateInsightsQuery = query(
    collection(firestore, 'users', user.uid, 'insights'),
    orderBy('createdAt', 'desc'),
    limit(100),
  );
  const incomingInvitesQuery = query(
    collection(firestore, 'partnerInvites'),
    where('normalizedToEmail', '==', normalizedEmail),
    where('status', '==', 'pending'),
  );
  const outgoingInviteQuery = query(
    collection(firestore, 'partnerInvites'),
    where('fromUserId', '==', user.uid),
    where('status', '==', 'pending'),
    limit(1),
  );

  let activeSpaceKey: string | null = null;
  let unsubscribeMessages = () => {};
  let unsubscribeCalendar = () => {};
  let unsubscribeLoveActions = () => {};
  let unsubscribeSharedInsights = () => {};
  let unsubscribeMetricSnapshots = () => {};
  let unsubscribePartnerReveal = () => {};

  const stopMessageSync = () => {
    unsubscribeMessages();
    unsubscribeMessages = () => {};
    useMirrorMessageStore.getState().clearMessages();
  };

  const stopCalendarSync = () => {
    unsubscribeCalendar();
    unsubscribeCalendar = () => {};
    useCalendarStore.getState().clearEvents();
  };

  const stopLoveActionSync = () => {
    unsubscribeLoveActions();
    unsubscribeLoveActions = () => {};
    useLoveActionStore.getState().clearActions();
  };

  const stopSharedInsightsSync = () => {
    unsubscribeSharedInsights();
    unsubscribeSharedInsights = () => {};
    useInsightsStore.getState().replaceSharedEntries([]);
    useInsightsStore.getState().setSyncingShared(false);
  };

  const stopMetricSnapshotsSync = () => {
    unsubscribeMetricSnapshots();
    unsubscribeMetricSnapshots = () => {};
    useInsightsStore.getState().replaceMetricSnapshots([]);
    useInsightsStore.getState().setSyncingSnapshots(false);
  };

  const stopPartnerRevealSync = () => {
    unsubscribePartnerReveal();
    unsubscribePartnerReveal = () => {};
    useRelationshipStore.getState().setPartnerReveal(null);
  };

  const unsubscribeLovePreferences = onSnapshot(
    lovePreferencesQuery,
    snapshot => {
      useLoveProfileStore.getState().replacePreferences(snapshot.docs.map(mapLovePreference));
      useLoveProfileStore.getState().setSyncing(false);
    },
    error => {
      useRelationshipStore.getState().setError(
        error.message ?? 'Unable to sync your love preferences right now.',
      );
      useLoveProfileStore.getState().setSyncing(false);
    },
  );

  const unsubscribePrivateInsights = onSnapshot(
    privateInsightsQuery,
    snapshot => {
      useInsightsStore.getState().replacePrivateEntries(snapshot.docs.map(mapInsightEntry));
      useInsightsStore.getState().setSyncingPrivate(false);
    },
    error => {
      useRelationshipStore.getState().setError(
        error.message ?? 'Unable to sync your private insights right now.',
      );
      useInsightsStore.getState().setSyncingPrivate(false);
    },
  );

  const unsubscribeUser = onSnapshot(
    userRef,
    snapshot => {
      const nextProfile = mapProfile(user.uid, snapshot.data(), email);
      const state = useRelationshipStore.getState();
      state.setProfile(nextProfile);
      state.setHydrated(true);
      state.setSyncing(false);
      state.setError('');

      const nextSpaceKey = nextProfile.coupleId ? `couple:${nextProfile.coupleId}` : `solo:${user.uid}`;

      if (activeSpaceKey === nextSpaceKey) {
        if (!nextProfile.coupleId) {
          useInsightsStore.getState().setSyncingShared(false);
          useInsightsStore.getState().setSyncingSnapshots(false);
          state.setPartnerReveal(null);
        }
        return;
      }

      stopMessageSync();
      stopCalendarSync();
      stopLoveActionSync();
      stopSharedInsightsSync();
      stopMetricSnapshotsSync();
      stopPartnerRevealSync();

      activeSpaceKey = nextSpaceKey;
      useLoveActionStore.getState().setSyncing(true);
      useMirrorMessageStore.getState().setSyncing(true);
      useCalendarStore.getState().setSyncing(true);

      if (!nextProfile.coupleId) {
        useInsightsStore.getState().setSyncingShared(false);
        useInsightsStore.getState().setSyncingSnapshots(false);
        state.setPartnerReveal(null);

        const personalMessagesQuery = query(
          collection(firestore, 'users', user.uid, 'mirrorMessages'),
          orderBy('createdAt', 'desc'),
          limit(50),
        );
        const personalCalendarEventsQuery = query(
          collection(firestore, 'users', user.uid, 'calendarEvents'),
          orderBy('startsAt', 'asc'),
          limit(250),
        );
        const personalLoveActionsQuery = query(
          collection(firestore, 'users', user.uid, 'loveActions'),
          orderBy('updatedAt', 'desc'),
          limit(250),
        );

        unsubscribeMessages = onSnapshot(
          personalMessagesQuery,
          messageSnapshot => {
            useMirrorMessageStore.getState().replaceMessages(messageSnapshot.docs.map(mapMessage));
            useMirrorMessageStore.getState().setSyncing(false);
          },
          error => {
            useRelationshipStore.getState().setError(
              error.message ?? 'Unable to sync your personal Love Notes right now.',
            );
            useMirrorMessageStore.getState().setSyncing(false);
          },
        );

        unsubscribeCalendar = onSnapshot(
          personalCalendarEventsQuery,
          eventSnapshot => {
            useCalendarStore.getState().replaceEvents(eventSnapshot.docs.map(mapCalendarEvent));
            useCalendarStore.getState().setSyncing(false);
          },
          error => {
            useRelationshipStore.getState().setError(
              error.message ?? 'Unable to sync your personal calendar right now.',
            );
            useCalendarStore.getState().setSyncing(false);
          },
        );

        unsubscribeLoveActions = onSnapshot(
          personalLoveActionsQuery,
          actionSnapshot => {
            useLoveActionStore.getState().replaceActions(actionSnapshot.docs.map(mapLoveAction));
            useLoveActionStore.getState().setSyncing(false);
          },
          error => {
            useRelationshipStore.getState().setError(
              error.message ?? 'Unable to sync your personal Love Actions right now.',
            );
            useLoveActionStore.getState().setSyncing(false);
          },
        );

        return;
      }

      useInsightsStore.getState().setSyncingShared(true);
      useInsightsStore.getState().setSyncingSnapshots(true);

      const messagesQuery = query(
        collection(firestore, 'couples', nextProfile.coupleId, 'mirrorMessages'),
        orderBy('createdAt', 'desc'),
        limit(50),
      );
      const calendarEventsQuery = query(
        collection(firestore, 'couples', nextProfile.coupleId, 'calendarEvents'),
        orderBy('startsAt', 'asc'),
        limit(250),
      );
      const loveActionsQuery = query(
        collection(firestore, 'couples', nextProfile.coupleId, 'loveActions'),
        orderBy('updatedAt', 'desc'),
        limit(250),
      );
      const sharedInsightsQuery = query(
        collection(firestore, 'couples', nextProfile.coupleId, 'insights'),
        orderBy('createdAt', 'desc'),
        limit(100),
      );
      const metricSnapshotsQuery = query(
        collection(firestore, 'couples', nextProfile.coupleId, 'metricSnapshots'),
        orderBy('capturedDate', 'asc'),
        limit(360),
      );
      const partnerRevealCollection = collection(firestore, 'couples', nextProfile.coupleId, 'preferenceReveals');

      unsubscribeMessages = onSnapshot(
        messagesQuery,
        messageSnapshot => {
          useMirrorMessageStore.getState().replaceMessages(messageSnapshot.docs.map(mapMessage));
          useMirrorMessageStore.getState().setSyncing(false);
        },
        error => {
          useRelationshipStore.getState().setError(
            error.message ?? 'Unable to sync your shared mirror notes right now.',
          );
          useMirrorMessageStore.getState().setSyncing(false);
        },
      );

      unsubscribeCalendar = onSnapshot(
        calendarEventsQuery,
        eventSnapshot => {
          useCalendarStore.getState().replaceEvents(eventSnapshot.docs.map(mapCalendarEvent));
          useCalendarStore.getState().setSyncing(false);
        },
        error => {
          useRelationshipStore.getState().setError(
            error.message ?? 'Unable to sync your shared calendar right now.',
          );
          useCalendarStore.getState().setSyncing(false);
        },
      );

      unsubscribeLoveActions = onSnapshot(
        loveActionsQuery,
        actionSnapshot => {
          useLoveActionStore.getState().replaceActions(actionSnapshot.docs.map(mapLoveAction));
          useLoveActionStore.getState().setSyncing(false);
        },
        error => {
          useRelationshipStore.getState().setError(
            error.message ?? 'Unable to sync your shared love actions right now.',
          );
          useLoveActionStore.getState().setSyncing(false);
        },
      );

      unsubscribeSharedInsights = onSnapshot(
        sharedInsightsQuery,
        insightSnapshot => {
          useInsightsStore.getState().replaceSharedEntries(insightSnapshot.docs.map(mapInsightEntry));
          useInsightsStore.getState().setSyncingShared(false);
        },
        error => {
          useRelationshipStore.getState().setError(
            error.message ?? 'Unable to sync your shared insights right now.',
          );
          useInsightsStore.getState().setSyncingShared(false);
        },
      );

      unsubscribeMetricSnapshots = onSnapshot(
        metricSnapshotsQuery,
        metricSnapshot => {
          useInsightsStore.getState().replaceMetricSnapshots(metricSnapshot.docs.map(mapMetricSnapshot));
          useInsightsStore.getState().setSyncingSnapshots(false);
        },
        error => {
          useRelationshipStore.getState().setError(
            error.message ?? 'Unable to sync your relationship metrics right now.',
          );
          useInsightsStore.getState().setSyncingSnapshots(false);
        },
      );

      unsubscribePartnerReveal = onSnapshot(
        partnerRevealCollection,
        revealSnapshot => {
          const partnerReveal = revealSnapshot.docs
            .filter(documentSnapshot => documentSnapshot.id !== user.uid)
            .map(mapPartnerReveal)[0] ?? null;
          useRelationshipStore.getState().setPartnerReveal(partnerReveal);
        },
        error => {
          useRelationshipStore.getState().setError(
            error.message ?? 'Unable to load your partner reveal right now.',
          );
          useRelationshipStore.getState().setPartnerReveal(null);
        },
      );
    },
    error => {
      useRelationshipStore.getState().setError(
        error.message ?? 'Unable to sync your relationship profile right now.',
      );
      useRelationshipStore.getState().setHydrated(true);
      useRelationshipStore.getState().setSyncing(false);
      useLoveProfileStore.getState().setSyncing(false);
      useLoveActionStore.getState().setSyncing(false);
      useMirrorMessageStore.getState().setSyncing(false);
      useCalendarStore.getState().setSyncing(false);
      useInsightsStore.getState().setSyncingPrivate(false);
      useInsightsStore.getState().setSyncingShared(false);
      useInsightsStore.getState().setSyncingSnapshots(false);
    },
  );

  const unsubscribeIncoming = onSnapshot(
    incomingInvitesQuery,
    snapshot => {
      const invites = snapshot.docs.map(mapInvite).sort((a, b) => b.createdAt - a.createdAt);
      useRelationshipStore.getState().setIncomingInvites(invites);
    },
    error => {
      useRelationshipStore.getState().setError(
        error.message ?? 'Unable to load incoming partner invites right now.',
      );
    },
  );

  const unsubscribeOutgoing = onSnapshot(
    outgoingInviteQuery,
    snapshot => {
      const invite = snapshot.docs[0] ? mapInvite(snapshot.docs[0]) : null;
      useRelationshipStore.getState().setOutgoingInvite(invite);
    },
    error => {
      useRelationshipStore.getState().setError(
        error.message ?? 'Unable to load your partner invite status right now.',
      );
    },
  );

  return () => {
    unsubscribeUser();
    unsubscribeLovePreferences();
    unsubscribePrivateInsights();
    unsubscribeIncoming();
    unsubscribeOutgoing();
    stopMessageSync();
    stopCalendarSync();
    stopLoveActionSync();
    stopSharedInsightsSync();
    stopMetricSnapshotsSync();
    stopPartnerRevealSync();
    activeSpaceKey = null;
    useRelationshipStore.getState().setSyncing(false);
    useLoveProfileStore.getState().setSyncing(false);
    useLoveActionStore.getState().setSyncing(false);
    useMirrorMessageStore.getState().setSyncing(false);
    useCalendarStore.getState().setSyncing(false);
    useInsightsStore.getState().setSyncingPrivate(false);
    useInsightsStore.getState().setSyncingShared(false);
    useInsightsStore.getState().setSyncingSnapshots(false);
  };
}

export async function completeOnboarding(user: User, input: OnboardingInput) {
  requireUserEmail(user);

  return callRelationshipFunction<
    {
      displayName: string;
      notificationPrivacy: NotificationPrivacyPreference;
      starterPreferences: LovePreferenceInput[];
    },
    { success: boolean; preferenceCount: number }
  >('completeOnboarding', {
    displayName: input.displayName,
    notificationPrivacy: input.notificationPrivacy,
    starterPreferences: input.starterPreferences.map(preference => ({
      area: preference.area,
      actionText: preference.actionText,
      actionSource: preference.actionSource ?? 'library',
      importance: preference.importance ?? 'medium',
      frequency: preference.frequency ?? 'weekly',
      timing: preference.timing ?? 'anytime',
      customTiming: preference.customTiming ?? null,
      visibility: preference.visibility ?? 'shared',
      notes: preference.notes ?? '',
    })),
  });
}

export async function markPartnerRevealSeen(user: User, coupleId: string) {
  requireUserEmail(user);

  await setDoc(
    doc(getFirestore(), 'users', user.uid),
    {
      email: requireUserEmail(user),
      normalizedEmail: normalizeEmail(requireUserEmail(user)),
      revealSeenCoupleId: coupleId,
      updatedAt: serverTimestamp(),
      lastSeenAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function updateQuickTipsPreference(user: User, enabled: boolean) {
  const email = requireUserEmail(user);

  await setDoc(
    doc(getFirestore(), 'users', user.uid),
    {
      email,
      normalizedEmail: normalizeEmail(email),
      quickTipsEnabled: enabled,
      updatedAt: serverTimestamp(),
      lastSeenAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function createLovePreference(user: User, input: LovePreferenceInput) {
  requireUserEmail(user);

  return callRelationshipFunction<LovePreferenceInput, { success: boolean; preferenceId: string }>(
    'createLovePreference',
    {
      area: input.area,
      actionText: input.actionText,
      actionSource: input.actionSource ?? 'custom',
      importance: input.importance ?? 'medium',
      frequency: input.frequency ?? 'weekly',
      timing: input.timing ?? 'anytime',
      customTiming: input.customTiming ?? null,
      visibility: input.visibility ?? 'private',
      notes: input.notes ?? '',
    },
  );
}

export async function updateLovePreference(user: User, preferenceId: string, input: LovePreferenceInput) {
  requireUserEmail(user);

  return callRelationshipFunction<LovePreferenceInput & { preferenceId: string }, { success: boolean; preferenceId: string }>(
    'updateLovePreference',
    {
      preferenceId,
      area: input.area,
      actionText: input.actionText,
      actionSource: input.actionSource ?? 'custom',
      importance: input.importance ?? 'medium',
      frequency: input.frequency ?? 'weekly',
      timing: input.timing ?? 'anytime',
      customTiming: input.customTiming ?? null,
      visibility: input.visibility ?? 'private',
      notes: input.notes ?? '',
    },
  );
}

export async function deleteLovePreference(user: User, preferenceId: string) {
  requireUserEmail(user);

  return callRelationshipFunction<{ preferenceId: string }, { success: boolean; preferenceId: string }>('deleteLovePreference', {
    preferenceId,
  });
}

export async function createLoveAction(user: User, input: LoveActionInput) {
  const email = requireUserEmail(user);
  const firestore = getFirestore();
  const profile = useRelationshipStore.getState().profile;

  if (!profile?.coupleId) {
    const actionDoc = buildSoloLoveActionDoc(user, email, input);
    const actionRef = await addDoc(collection(firestore, 'users', user.uid, 'loveActions'), {
      ...actionDoc,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return { success: true, actionId: actionRef.id };
  }

  return callRelationshipFunction<LoveActionInput, { success: boolean; actionId: string }>('createLoveAction', {
    title: input.title,
    area: input.area,
    preferenceId: input.preferenceId ?? null,
    notes: input.notes ?? '',
    importance: input.importance ?? 'medium',
    frequency: input.frequency ?? 'weekly',
    timing: input.timing ?? 'anytime',
    customTiming: input.customTiming ?? null,
    visibility: input.visibility ?? 'shared',
    status: input.status ?? 'proposed',
    nextDueAt: input.nextDueAt ?? null,
    lastCompletedAt: input.lastCompletedAt ?? null,
    responsibleUserId: input.responsibleUserId ?? user.uid,
  });
}

export async function updateLoveAction(user: User, actionId: string, input: LoveActionInput) {
  requireUserEmail(user);
  const firestore = getFirestore();
  const profile = useRelationshipStore.getState().profile;

  if (!profile?.coupleId) {
    const existingAction = useLoveActionStore.getState().actions.find(action => action.id === actionId);
    const title = input.title.trim();

    if (!title) {
      throw new Error('Add a short Love Action title first.');
    }

    const timing = mapLovePreferenceTiming(input.timing);

    await updateDoc(doc(firestore, 'users', user.uid, 'loveActions', actionId), {
      title,
      area: mapLoveArea(input.area),
      preferenceId: input.preferenceId ?? null,
      notes: input.notes?.trim() ?? '',
      importance: mapLovePreferenceImportance(input.importance),
      frequency: mapLovePreferenceFrequency(input.frequency),
      timing,
      customTiming: timing === 'custom' ? input.customTiming?.trim() || null : null,
      visibility: mapLovePreferenceVisibility(input.visibility),
      nextDueAt: typeof input.nextDueAt === 'number' && Number.isFinite(input.nextDueAt) ? new Date(input.nextDueAt) : null,
      lastCompletedAt:
        typeof input.lastCompletedAt === 'number' && Number.isFinite(input.lastCompletedAt)
          ? new Date(input.lastCompletedAt)
          : existingAction?.lastCompletedAt
            ? new Date(existingAction.lastCompletedAt)
            : null,
      updatedAt: serverTimestamp(),
    });

    return { success: true, actionId };
  }

  return callRelationshipFunction<LoveActionInput & { actionId: string }, { success: boolean; actionId: string }>(
    'updateLoveAction',
    {
      actionId,
      title: input.title,
      area: input.area,
      preferenceId: input.preferenceId ?? null,
      notes: input.notes ?? '',
      importance: input.importance ?? 'medium',
      frequency: input.frequency ?? 'weekly',
      timing: input.timing ?? 'anytime',
      customTiming: input.customTiming ?? null,
      visibility: input.visibility ?? 'shared',
      status: input.status ?? 'proposed',
      nextDueAt: input.nextDueAt ?? null,
      lastCompletedAt: input.lastCompletedAt ?? null,
      responsibleUserId: input.responsibleUserId ?? user.uid,
    },
  );
}

export async function deleteLoveAction(user: User, actionId: string) {
  requireUserEmail(user);
  const firestore = getFirestore();
  const profile = useRelationshipStore.getState().profile;

  if (!profile?.coupleId) {
    await deleteDoc(doc(firestore, 'users', user.uid, 'loveActions', actionId));
    return { success: true, actionId };
  }

  return callRelationshipFunction<{ actionId: string }, { success: boolean; actionId: string }>('deleteLoveAction', {
    actionId,
  });
}

export async function respondToLoveActionProposal(
  user: User,
  actionId: string,
  response: LoveActionProposalResponse,
) {
  requireUserEmail(user);

  return callRelationshipFunction<
    { actionId: string; response: LoveActionProposalResponse },
    { success: boolean; actionId: string; status: LoveActionStatus }
  >('respondToLoveActionProposal', {
    actionId,
    response,
  });
}

export async function transitionLoveActionStatus(
  user: User,
  actionId: string,
  targetStatus: LoveActionLifecycleTarget,
  options?: {
    confirmationReaction?: LoveActionConfirmationReaction;
    confirmationNote?: string;
    appreciationReaction?: LoveActionAppreciationReaction;
    appreciationNote?: string;
  },
) {
  const email = requireUserEmail(user);
  const profile = useRelationshipStore.getState().profile;

  if (!profile?.coupleId) {
    const firestore = getFirestore();
    const action = useLoveActionStore.getState().actions.find(item => item.id === actionId);

    if (!action) {
      throw new Error('That Love Action is no longer available.');
    }

    assertSoloLoveActionTransition(action, targetStatus);

    const payload: Record<string, any> = {
      status: targetStatus,
      updatedAt: serverTimestamp(),
    };

    if (targetStatus === 'performed') {
      payload.lastCompletedAt = serverTimestamp();
    }

    if (targetStatus === 'confirmed') {
      payload.respondedAt = serverTimestamp();
      payload.respondedByUserId = user.uid;
      payload.respondedByEmail = email;
      payload.confirmationReaction = options?.confirmationReaction ?? action.confirmationReaction ?? 'yep';
      payload.confirmationNote = options?.confirmationNote ?? action.confirmationNote ?? '';
    }

    if (targetStatus === 'appreciated') {
      payload.respondedAt = serverTimestamp();
      payload.respondedByUserId = user.uid;
      payload.respondedByEmail = email;
      payload.confirmationReaction = action.confirmationReaction ?? 'yep';
      payload.confirmationNote = action.confirmationNote ?? '';
      payload.appreciationReaction = options?.appreciationReaction ?? action.appreciationReaction ?? 'thankYou';
      payload.appreciationNote = options?.appreciationNote ?? action.appreciationNote ?? '';
    }

    await updateDoc(doc(firestore, 'users', user.uid, 'loveActions', actionId), payload);
    return { success: true, actionId, status: targetStatus };
  }

  return callRelationshipFunction<
    {
      actionId: string;
      targetStatus: LoveActionLifecycleTarget;
      confirmationReaction?: LoveActionConfirmationReaction;
      confirmationNote?: string;
      appreciationReaction?: LoveActionAppreciationReaction;
      appreciationNote?: string;
    },
    { success: boolean; actionId: string; status: LoveActionStatus }
  >('transitionLoveActionStatus', {
    actionId,
    targetStatus,
    ...options,
  });
}

export async function registerDevicePushToken(
  user: User,
  input: { installationId: string; token: string; platform: PushDevicePlatform },
) {
  requireUserEmail(user);

  return callRelationshipFunction<
    { installationId: string; token: string; platform: PushDevicePlatform },
    { success: boolean; installationId: string }
  >('registerDevicePushToken', input);
}

export async function unregisterDevicePushToken(user: User, input: { installationId: string }) {
  requireUserEmail(user);

  return callRelationshipFunction<
    { installationId: string },
    { success: boolean; installationId: string }
  >('unregisterDevicePushToken', input);
}

export async function sendLoveActionReminder(user: User, actionId: string) {
  requireUserEmail(user);

  return callRelationshipFunction<
    { actionId: string },
    { success: boolean; actionId: string; deliveredCount: number; targetUserId: string }
  >('sendLoveActionReminder', { actionId });
}

export async function sendPartnerInvite(user: User, partnerEmailInput: string) {
  const partnerEmail = partnerEmailInput.trim();
  const normalizedPartnerEmail = normalizeEmail(partnerEmail);
  const normalizedUserEmail = normalizeEmail(requireUserEmail(user));

  if (!partnerEmail) {
    throw new Error('Enter your partner’s email first.');
  }

  if (normalizedPartnerEmail === normalizedUserEmail) {
    throw new Error('Use your partner’s email, not your own.');
  }

  return callRelationshipFunction<
    { partnerEmail: string },
    { success: boolean; deliveryStatus?: 'sent' | 'failed' | 'emulator'; deliveryErrorMessage?: string | null }
  >('sendPartnerInvite', { partnerEmail });
}

export async function acceptPartnerInvite(user: User, inviteId: string) {
  requireUserEmail(user);
  await callRelationshipFunction('acceptPartnerInvite', { inviteId });
}

export async function declinePartnerInvite(inviteId: string) {
  await callRelationshipFunction('declinePartnerInvite', { inviteId });
}

export async function cancelPartnerInvite(inviteId: string) {
  await callRelationshipFunction('cancelPartnerInvite', { inviteId });
}

export async function sendMirrorMessage(
  user: User,
  message: {
    text: string;
    strokes: MirrorStroke[];
    noteType: LoveNoteType;
    tags: LoveNoteTag[];
    promptId?: string | null;
  },
) {
  const firestore = getFirestore();
  const email = requireUserEmail(user);
  const profile = useRelationshipStore.getState().profile;
  const collectionRef = profile?.coupleId
    ? collection(firestore, 'couples', profile.coupleId, 'mirrorMessages')
    : collection(firestore, 'users', user.uid, 'mirrorMessages');

  await addDoc(collectionRef, {
    text: message.text,
    strokes: serializeMirrorStrokes(message.strokes),
    senderId: user.uid,
    senderEmail: email,
    noteType: mapLoveNoteType(message.noteType),
    tags: mapLoveNoteTags(message.tags),
    promptId: typeof message.promptId === 'string' ? message.promptId : null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteMirrorMessage(user: User, message: MirrorMessage) {
  const firestore = getFirestore();
  const profile = useRelationshipStore.getState().profile;

  if (message.senderId !== user.uid) {
    throw new Error('Only the sender can delete this mirror note.');
  }

  const messageRef = profile?.coupleId
    ? doc(firestore, 'couples', profile.coupleId, 'mirrorMessages', message.id)
    : doc(firestore, 'users', user.uid, 'mirrorMessages', message.id);

  await deleteDoc(messageRef);
}

export async function createCalendarEvent(
  user: User,
  event: CalendarEventInput,
) {
  const firestore = getFirestore();
  const email = requireUserEmail(user);
  const profile = useRelationshipStore.getState().profile;
  const title = event.title.trim();

  if (!title) {
    throw new Error('Add an event title first.');
  }

  const collectionRef = profile?.coupleId
    ? collection(firestore, 'couples', profile.coupleId, 'calendarEvents')
    : collection(firestore, 'users', user.uid, 'calendarEvents');

  await addDoc(collectionRef, {
    title,
    note: event.note.trim(),
    startsAt: event.startsAt,
    endsAt: event.endsAt ?? null,
    allDay: event.allDay,
    foodQuery: event.foodQuery?.trim() ?? '',
    foodInterestFor: event.foodInterestFor ?? 'me',
    restaurantPlaceId: event.restaurantPlaceId ?? null,
    restaurantName: event.restaurantName?.trim() ?? '',
    restaurantAddress: event.restaurantAddress?.trim() ?? '',
    restaurantLatitude: typeof event.restaurantLatitude === 'number' ? event.restaurantLatitude : null,
    restaurantLongitude: typeof event.restaurantLongitude === 'number' ? event.restaurantLongitude : null,
    status: 'active',
    createdByUserId: user.uid,
    createdByEmail: email,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateCalendarEvent(
  user: User,
  eventId: string,
  event: CalendarEventInput,
) {
  const firestore = getFirestore();
  const profile = useRelationshipStore.getState().profile;
  const title = event.title.trim();

  if (!title) {
    throw new Error('Add an event title first.');
  }

  const eventRef = profile?.coupleId
    ? doc(firestore, 'couples', profile.coupleId, 'calendarEvents', eventId)
    : doc(firestore, 'users', user.uid, 'calendarEvents', eventId);

  await updateDoc(eventRef, {
    title,
    note: event.note.trim(),
    startsAt: event.startsAt,
    endsAt: event.endsAt ?? null,
    allDay: event.allDay,
    foodQuery: event.foodQuery?.trim() ?? '',
    foodInterestFor: event.foodInterestFor ?? 'me',
    restaurantPlaceId: event.restaurantPlaceId ?? null,
    restaurantName: event.restaurantName?.trim() ?? '',
    restaurantAddress: event.restaurantAddress?.trim() ?? '',
    restaurantLatitude: typeof event.restaurantLatitude === 'number' ? event.restaurantLatitude : null,
    restaurantLongitude: typeof event.restaurantLongitude === 'number' ? event.restaurantLongitude : null,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteCalendarEvent(user: User, eventId: string) {
  const firestore = getFirestore();
  const profile = useRelationshipStore.getState().profile;
  const eventRef = profile?.coupleId
    ? doc(firestore, 'couples', profile.coupleId, 'calendarEvents', eventId)
    : doc(firestore, 'users', user.uid, 'calendarEvents', eventId);

  await deleteDoc(eventRef);
}

export async function searchNearbyRestaurants(input: {
  query: string;
  latitude: number;
  longitude: number;
  radiusMiles: number;
}) {
  return callRelationshipFunction<
    { query: string; latitude: number; longitude: number; radiusMiles: number },
    { success: boolean; places: NearbyRestaurant[] }
  >('searchNearbyRestaurants', input);
}

type InsightInput = {
  mood: number;
  connection: number;
  tension: number;
  appreciation: string;
  need: string;
  reflection: string;
  nextStep: string;
};

function clampInsightRating(value: number) {
  return Math.max(1, Math.min(5, Math.round(value)));
}

function normalizeInsightInput(input: InsightInput) {
  return {
    mood: clampInsightRating(input.mood),
    connection: clampInsightRating(input.connection),
    tension: clampInsightRating(input.tension),
    appreciation: input.appreciation.trim(),
    need: input.need.trim(),
    reflection: input.reflection.trim(),
    nextStep: input.nextStep.trim(),
  };
}

export async function saveInsightEntry(
  user: User,
  input: InsightInput,
  visibility: Exclude<InsightVisibility, 'shared'> | 'shared',
) {
  const firestore = getFirestore();
  const email = requireUserEmail(user);
  const profile = useRelationshipStore.getState().profile;
  const normalized = normalizeInsightInput(input);

  if (!normalized.appreciation && !normalized.need && !normalized.reflection && !normalized.nextStep) {
    throw new Error('Add at least one written reflection before saving this insight.');
  }

  if (visibility === 'shared') {
    if (!profile?.coupleId) {
      throw new Error('Connect with your partner before sharing insights.');
    }

    await addDoc(collection(firestore, 'couples', profile.coupleId, 'insights'), {
      ...normalized,
      visibility: 'shared',
      sharedInsightId: null,
      createdByUserId: user.uid,
      createdByEmail: email,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return;
  }

  await addDoc(collection(firestore, 'users', user.uid, 'insights'), {
    ...normalized,
    visibility,
    sharedInsightId: null,
    createdByUserId: user.uid,
    createdByEmail: email,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function shareInsightEntry(user: User, entry: InsightEntry) {
  const firestore = getFirestore();
  const email = requireUserEmail(user);
  const profile = useRelationshipStore.getState().profile;

  if (!profile?.coupleId) {
    throw new Error('Connect with your partner before sharing insights.');
  }

  if (entry.createdByUserId !== user.uid) {
    throw new Error('Only your own private insights can be shared from here.');
  }

  if (entry.sharedInsightId) {
    throw new Error('This insight has already been shared.');
  }

  const sharedDoc = await addDoc(collection(firestore, 'couples', profile.coupleId, 'insights'), {
    mood: entry.mood,
    connection: entry.connection,
    tension: entry.tension,
    appreciation: entry.appreciation,
    need: entry.need,
    reflection: entry.reflection,
    nextStep: entry.nextStep,
    visibility: 'shared',
    sharedInsightId: null,
    createdByUserId: user.uid,
    createdByEmail: email,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await updateDoc(doc(firestore, 'users', user.uid, 'insights', entry.id), {
    visibility: 'shared',
    sharedInsightId: sharedDoc.id,
    updatedAt: serverTimestamp(),
  });
}

export async function updateInsightEntry(
  user: User,
  entry: InsightEntry,
  input: InsightInput,
  options?: { source?: 'private' | 'shared'; linkedPrivateEntryId?: string | null },
) {
  const firestore = getFirestore();
  const email = requireUserEmail(user);
  const profile = useRelationshipStore.getState().profile;
  const normalized = normalizeInsightInput(input);
  const source = options?.source ?? (entry.visibility === 'shared' ? 'shared' : 'private');

  if (!normalized.appreciation && !normalized.need && !normalized.reflection && !normalized.nextStep) {
    throw new Error('Add at least one written reflection before saving this insight.');
  }

  if (entry.createdByUserId !== user.uid) {
    throw new Error('Only your own insights can be edited here.');
  }

  if (source === 'shared') {
    if (!profile?.coupleId) {
      throw new Error('Connect with your partner before updating shared insights.');
    }

    await updateDoc(doc(firestore, 'couples', profile.coupleId, 'insights', entry.id), {
      ...normalized,
      visibility: 'shared',
      sharedInsightId: null,
      createdByUserId: user.uid,
      createdByEmail: email,
      updatedAt: serverTimestamp(),
    });

    if (options?.linkedPrivateEntryId) {
      await updateDoc(doc(firestore, 'users', user.uid, 'insights', options.linkedPrivateEntryId), {
        ...normalized,
        visibility: 'shared',
        sharedInsightId: entry.id,
        createdByUserId: user.uid,
        createdByEmail: email,
        updatedAt: serverTimestamp(),
      });
    }

    return;
  }

  await updateDoc(doc(firestore, 'users', user.uid, 'insights', entry.id), {
    ...normalized,
    visibility: entry.visibility,
    sharedInsightId: entry.sharedInsightId,
    createdByUserId: user.uid,
    createdByEmail: email,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteInsightEntry(
  user: User,
  entry: InsightEntry,
  options?: { source?: 'private' | 'shared'; linkedPrivateEntryId?: string | null },
) {
  const firestore = getFirestore();
  const profile = useRelationshipStore.getState().profile;
  const source = options?.source ?? (entry.visibility === 'shared' ? 'shared' : 'private');

  if (entry.createdByUserId !== user.uid) {
    throw new Error('Only your own insights can be deleted here.');
  }

  if (source === 'shared') {
    if (!profile?.coupleId) {
      throw new Error('Connect with your partner before managing shared insights.');
    }

    await deleteDoc(doc(firestore, 'couples', profile.coupleId, 'insights', entry.id));

    if (options?.linkedPrivateEntryId) {
      await updateDoc(doc(firestore, 'users', user.uid, 'insights', options.linkedPrivateEntryId), {
        visibility: 'decideLater',
        sharedInsightId: null,
        updatedAt: serverTimestamp(),
      });
    }

    return;
  }

  await deleteDoc(doc(firestore, 'users', user.uid, 'insights', entry.id));
}
