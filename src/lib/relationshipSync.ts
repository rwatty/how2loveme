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
  updateDoc,
  where,
} from '@react-native-firebase/firestore';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import { useCalendarStore, type CalendarEvent } from '../store/useCalendarStore';
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
  type PartnerInvite,
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

function mapProfile(userId: string, data: any, fallbackEmail: string): RelationshipProfile {
  const email = data?.email ?? fallbackEmail;

  return {
    userId,
    email,
    normalizedEmail: data?.normalizedEmail ?? normalizeEmail(email),
    partnerId: data?.partnerId ?? null,
    partnerEmail: data?.partnerEmail ?? null,
    coupleId: data?.coupleId ?? null,
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

  let activeCoupleId: string | null = null;
  let unsubscribeMessages = () => {};
  let unsubscribeCalendar = () => {};
  let unsubscribeLoveActions = () => {};
  let unsubscribeSharedInsights = () => {};

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
      state.setSyncing(false);
      state.setError('');

      if (activeCoupleId === nextProfile.coupleId) {
        if (!nextProfile.coupleId) {
          useLoveActionStore.getState().setSyncing(false);
          useMirrorMessageStore.getState().setSyncing(false);
          useCalendarStore.getState().setSyncing(false);
          useInsightsStore.getState().setSyncingShared(false);
        }
        return;
      }

      stopMessageSync();
      stopCalendarSync();
      stopLoveActionSync();
      stopSharedInsightsSync();

      if (!nextProfile.coupleId) {
        activeCoupleId = null;
        useLoveActionStore.getState().setSyncing(false);
        useMirrorMessageStore.getState().setSyncing(false);
        useCalendarStore.getState().setSyncing(false);
        useInsightsStore.getState().setSyncingShared(false);
        return;
      }

      activeCoupleId = nextProfile.coupleId;
      useLoveActionStore.getState().setSyncing(true);
      useMirrorMessageStore.getState().setSyncing(true);
      useCalendarStore.getState().setSyncing(true);
      useInsightsStore.getState().setSyncingShared(true);

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
    },
    error => {
      useRelationshipStore.getState().setError(
        error.message ?? 'Unable to sync your relationship profile right now.',
      );
      useRelationshipStore.getState().setSyncing(false);
      useLoveProfileStore.getState().setSyncing(false);
      useLoveActionStore.getState().setSyncing(false);
      useMirrorMessageStore.getState().setSyncing(false);
      useCalendarStore.getState().setSyncing(false);
      useInsightsStore.getState().setSyncingPrivate(false);
      useInsightsStore.getState().setSyncingShared(false);
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
    activeCoupleId = null;
    useRelationshipStore.getState().setSyncing(false);
    useLoveProfileStore.getState().setSyncing(false);
    useLoveActionStore.getState().setSyncing(false);
    useMirrorMessageStore.getState().setSyncing(false);
    useCalendarStore.getState().setSyncing(false);
    useInsightsStore.getState().setSyncingPrivate(false);
    useInsightsStore.getState().setSyncingShared(false);
  };
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
  requireUserEmail(user);

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
  requireUserEmail(user);

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

export async function sendMirrorMessage(user: User, message: { text: string; strokes: MirrorStroke[] }) {
  const firestore = getFirestore();
  const email = requireUserEmail(user);
  const profile = useRelationshipStore.getState().profile;

  if (!profile?.coupleId) {
    throw new Error('Connect with your partner before sending mirror notes.');
  }

  await addDoc(collection(firestore, 'couples', profile.coupleId, 'mirrorMessages'), {
    text: message.text,
    strokes: serializeMirrorStrokes(message.strokes),
    senderId: user.uid,
    senderEmail: email,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteMirrorMessage(user: User, message: MirrorMessage) {
  const firestore = getFirestore();
  const profile = useRelationshipStore.getState().profile;

  if (!profile?.coupleId) {
    throw new Error('Connect with your partner before managing mirror notes.');
  }

  if (message.senderId !== user.uid) {
    throw new Error('Only the sender can delete this mirror note.');
  }

  await deleteDoc(doc(firestore, 'couples', profile.coupleId, 'mirrorMessages', message.id));
}

export async function createCalendarEvent(
  user: User,
  event: { title: string; note: string; startsAt: Date; endsAt?: Date | null; allDay: boolean },
) {
  const firestore = getFirestore();
  const email = requireUserEmail(user);
  const profile = useRelationshipStore.getState().profile;

  if (!profile?.coupleId) {
    throw new Error('Connect with your partner before adding calendar moments.');
  }

  const title = event.title.trim();

  if (!title) {
    throw new Error('Add an event title first.');
  }

  await addDoc(collection(firestore, 'couples', profile.coupleId, 'calendarEvents'), {
    title,
    note: event.note.trim(),
    startsAt: event.startsAt,
    endsAt: event.endsAt ?? null,
    allDay: event.allDay,
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
  event: { title: string; note: string; startsAt: Date; endsAt?: Date | null; allDay: boolean },
) {
  const firestore = getFirestore();
  const profile = useRelationshipStore.getState().profile;

  if (!profile?.coupleId) {
    throw new Error('Connect with your partner before updating calendar moments.');
  }

  const title = event.title.trim();

  if (!title) {
    throw new Error('Add an event title first.');
  }

  await updateDoc(doc(firestore, 'couples', profile.coupleId, 'calendarEvents', eventId), {
    title,
    note: event.note.trim(),
    startsAt: event.startsAt,
    endsAt: event.endsAt ?? null,
    allDay: event.allDay,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteCalendarEvent(user: User, eventId: string) {
  const firestore = getFirestore();
  const profile = useRelationshipStore.getState().profile;

  if (!profile?.coupleId) {
    throw new Error('Connect with your partner before managing calendar moments.');
  }

  await deleteDoc(doc(firestore, 'couples', profile.coupleId, 'calendarEvents', eventId));
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
