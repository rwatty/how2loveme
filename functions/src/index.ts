import { initializeApp, getApps } from 'firebase-admin/app';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { defineSecret, defineString } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/https';
import { Resend } from 'resend';
import {
  buildRelationshipMetricSnapshots,
  type InsightMetricRecord,
  type LoveActionMetricRecord,
  type LoveNoteMetricRecord,
} from './relationshipMetrics';

if (!getApps().length) {
  initializeApp();
}

const RESEND_API_KEY = defineSecret('RESEND_API_KEY');
const GOOGLE_PLACES_API_KEY = defineSecret('GOOGLE_PLACES_API_KEY');
const INVITE_FROM_EMAIL = defineString('INVITE_FROM_EMAIL');
const APP_STORE_LINK = defineString('APP_STORE_LINK', {
  default: 'Open the How 2 Love Me app and visit the Us tab to accept your invite.',
});
const IS_FUNCTIONS_EMULATOR = process.env.FUNCTIONS_EMULATOR === 'true';
const MIN_NEARBY_RESTAURANT_RADIUS_MILES = 1;
const MAX_NEARBY_RESTAURANT_RADIUS_MILES = 30;
const METERS_PER_MILE = 1609.34;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type AuthContext = {
  uid: string;
  email: string;
};

type InviteDeliveryStatus = 'sent' | 'failed' | 'emulator';

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string) {
  return EMAIL_REGEX.test(email);
}

function requireAuth(request: { auth?: { uid?: string; token?: { email?: string; email_verified?: boolean } } | null }): AuthContext {
  const uid = request.auth?.uid;
  const email = request.auth?.token?.email?.trim();
  const emailVerified = request.auth?.token?.email_verified === true;

  if (!uid || !email || !emailVerified) {
    throw new HttpsError(
      'failed-precondition',
      'You must be signed in with a verified email to manage partner invites.',
    );
  }

  return { uid, email };
}

async function ensureRelationshipProfile(uid: string, email: string) {
  const firestore = getFirestore();

  await firestore.collection('users').doc(uid).set(
    {
      email,
      normalizedEmail: normalizeEmail(email),
      updatedAt: FieldValue.serverTimestamp(),
      lastSeenAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

function getInviteEmailHtml(inviterEmail: string) {
  const appLink = APP_STORE_LINK.value();

  return [
    `<p>${inviterEmail} invited you to connect on <strong>How 2 Love Me</strong>.</p>`,
    '<p>Once you sign in with this email address, open the <strong>Us</strong> tab to accept the invite and unlock shared mirror notes.</p>',
    `<p>${appLink}</p>`,
  ].join('');
}

function getInviteEmailText(inviterEmail: string) {
  return `${inviterEmail} invited you to connect on How 2 Love Me. Sign in with this email address, open the Us tab, and accept the invite to unlock shared mirror notes. ${APP_STORE_LINK.value()}`;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'Unknown error';
}

const LOVE_AREAS = [
  'emotional',
  'physicalIntimate',
  'communication',
  'financial',
  'spiritual',
  'mental',
  'social',
  'partnership',
] as const;
const LOVE_IMPORTANCE = ['low', 'medium', 'high', 'essential'] as const;
const LOVE_FREQUENCIES = [
  'daily',
  'severalTimesWeekly',
  'weekly',
  'monthly',
  'occasionally',
  'surpriseMe',
] as const;
const LOVE_TIMINGS = ['morning', 'evening', 'weekend', 'anytime', 'custom'] as const;
const LOVE_VISIBILITIES = ['private', 'shared', 'surprise'] as const;
const LOVE_ACTION_STATUSES = [
  'proposed',
  'scheduled',
  'due',
  'performed',
  'confirmed',
  'appreciated',
  'needsAttention',
  'cancelled',
] as const;
const LOVE_ACTION_PROPOSAL_RESPONSES = ['accept', 'decline'] as const;
const LOVE_ACTION_CONFIRMATION_REACTIONS = ['yep', 'lovedIt', 'letsTryAgain'] as const;
const LOVE_ACTION_APPRECIATION_REACTIONS = ['thankYou', 'madeMyDay', 'morePlease'] as const;
const PUSH_DEVICE_PLATFORMS = ['ios', 'android'] as const;
const LOVE_ACTION_SOURCES = ['library', 'custom'] as const;
const LOVE_NOTE_TYPES = ['warm', 'playful', 'reassuring', 'grateful', 'desire'] as const;
const NOTIFICATION_PRIVACY_PREFERENCES = ['detailed', 'discreet', 'off'] as const;

type LoveArea = (typeof LOVE_AREAS)[number];
type LoveImportance = (typeof LOVE_IMPORTANCE)[number];
type LoveFrequency = (typeof LOVE_FREQUENCIES)[number];
type LoveTiming = (typeof LOVE_TIMINGS)[number];
type LoveVisibility = (typeof LOVE_VISIBILITIES)[number];
type LoveActionStatus = (typeof LOVE_ACTION_STATUSES)[number];
type LoveActionSource = (typeof LOVE_ACTION_SOURCES)[number];
type LoveActionProposalResponse = (typeof LOVE_ACTION_PROPOSAL_RESPONSES)[number];
type LoveActionConfirmationReaction = (typeof LOVE_ACTION_CONFIRMATION_REACTIONS)[number];
type LoveActionAppreciationReaction = (typeof LOVE_ACTION_APPRECIATION_REACTIONS)[number];
type PushDevicePlatform = (typeof PUSH_DEVICE_PLATFORMS)[number];
type LoveActionLifecycleTarget = 'due' | 'performed' | 'confirmed' | 'appreciated';
type NotificationPrivacyPreference = (typeof NOTIFICATION_PRIVACY_PREFERENCES)[number];

type LovePreferencePayload = {
  area: LoveArea;
  actionText: string;
  actionSource: LoveActionSource;
  importance: LoveImportance;
  frequency: LoveFrequency;
  timing: LoveTiming;
  customTiming: string | null;
  visibility: LoveVisibility;
  notes: string;
};

type LoveActionPayload = {
  title: string;
  area: LoveArea;
  preferenceId: string | null;
  notes: string;
  importance: LoveImportance;
  frequency: LoveFrequency;
  timing: LoveTiming;
  customTiming: string | null;
  visibility: LoveVisibility;
  status: LoveActionStatus;
  nextDueAt: Timestamp | null;
  lastCompletedAt: Timestamp | null;
  responsibleUserId: string;
};

type UserRelationshipProfile = {
  email?: string;
  normalizedEmail?: string;
  partnerId?: string | null;
  partnerEmail?: string | null;
  coupleId?: string | null;
  displayName?: string;
  notificationPrivacy?: NotificationPrivacyPreference;
  adultConfirmedAt?: Timestamp | null;
  privacyAcceptedAt?: Timestamp | null;
  safetyAcceptedAt?: Timestamp | null;
  onboardingCompletedAt?: Timestamp | null;
  revealSeenCoupleId?: string | null;
};

type CoupleRecord = {
  memberIds?: string[];
  memberEmails?: string[];
};

type PreferenceRevealRecord = {
  userId: string;
  email: string;
  displayName: string;
  preferenceCount: number;
  highlightAreas: string[];
  highlightActions: string[];
  updatedAt: FieldValue;
};

function isOneOf<T extends string>(value: string, allowed: readonly T[]): value is T {
  return allowed.includes(value as T);
}

function readRequiredString(value: unknown, label: string, maxLength: number) {
  const normalized = String(value ?? '').trim();

  if (!normalized) {
    throw new HttpsError('invalid-argument', `Missing ${label}.`);
  }

  if (normalized.length > maxLength) {
    throw new HttpsError('invalid-argument', `${label} is too long.`);
  }

  return normalized;
}

function readOptionalString(value: unknown, maxLength: number) {
  const normalized = String(value ?? '').trim();

  if (!normalized) {
    return '';
  }

  if (normalized.length > maxLength) {
    throw new HttpsError('invalid-argument', 'Input is too long.');
  }

  return normalized;
}

function readOptionalNullableString(value: unknown, maxLength: number) {
  const normalized = String(value ?? '').trim();

  if (!normalized) {
    return null;
  }

  if (normalized.length > maxLength) {
    throw new HttpsError('invalid-argument', 'Input is too long.');
  }

  return normalized;
}

function readEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T) {
  const normalized = String(value ?? '').trim();
  return isOneOf(normalized, allowed) ? normalized : fallback;
}

function readOptionalEnum<T extends string>(value: unknown, allowed: readonly T[]) {
  const normalized = String(value ?? '').trim();

  if (!normalized) {
    return null;
  }

  if (!isOneOf(normalized, allowed)) {
    throw new HttpsError('invalid-argument', 'That reaction option is invalid.');
  }

  return normalized;
}

function readOptionalTimestamp(value: unknown) {
  if (value == null || value === '') {
    return null;
  }

  const numeric = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(numeric)) {
    throw new HttpsError('invalid-argument', 'Invalid timestamp value.');
  }

  return Timestamp.fromMillis(numeric);
}

function readRequiredFiniteNumber(value: unknown, label: string) {
  const numeric = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(numeric)) {
    throw new HttpsError('invalid-argument', `Invalid ${label}.`);
  }

  return numeric;
}

async function getRelationshipProfile(uid: string) {
  const profileSnapshot = await getFirestore().collection('users').doc(uid).get();
  const profile = profileSnapshot.data() as UserRelationshipProfile | undefined;

  if (!profileSnapshot.exists || !profile) {
    throw new HttpsError('failed-precondition', 'Create your account profile before using this feature.');
  }

  return profile;
}

async function requireConnectedRelationship(uid: string) {
  const firestore = getFirestore();
  const profile = await getRelationshipProfile(uid);

  if (!profile.coupleId || !profile.partnerId || !profile.partnerEmail) {
    throw new HttpsError('failed-precondition', 'Connect with your partner first.');
  }

  const coupleSnapshot = await firestore.collection('couples').doc(profile.coupleId).get();
  const couple = coupleSnapshot.data() as CoupleRecord | undefined;

  if (!coupleSnapshot.exists || !couple || !Array.isArray(couple.memberIds) || !couple.memberIds.includes(uid)) {
    throw new HttpsError('permission-denied', 'That shared Love Space is no longer available.');
  }

  return {
    profile,
    coupleId: profile.coupleId,
    partnerId: profile.partnerId,
    partnerEmail: profile.partnerEmail,
    couple,
  };
}

function normalizeLovePreferencePayload(data: any): LovePreferencePayload {
  const timing = readEnum(data?.timing, LOVE_TIMINGS, 'anytime');

  return {
    area: readEnum(data?.area, LOVE_AREAS, 'emotional'),
    actionText: readRequiredString(data?.actionText, 'love preference', 140),
    actionSource: readEnum(data?.actionSource, LOVE_ACTION_SOURCES, 'custom'),
    importance: readEnum(data?.importance, LOVE_IMPORTANCE, 'medium'),
    frequency: readEnum(data?.frequency, LOVE_FREQUENCIES, 'weekly'),
    timing,
    customTiming: timing === 'custom' ? readOptionalNullableString(data?.customTiming, 60) : null,
    visibility: readEnum(data?.visibility, LOVE_VISIBILITIES, 'private'),
    notes: readOptionalString(data?.notes, 280),
  };
}

function normalizeOnboardingPayload(data: any) {
  const displayName = readRequiredString(data?.displayName, 'display name', 40);
  const notificationPrivacy = readEnum(data?.notificationPrivacy, NOTIFICATION_PRIVACY_PREFERENCES, 'discreet');
  const starterPreferences = Array.isArray(data?.starterPreferences)
    ? data.starterPreferences.map(normalizeLovePreferencePayload)
    : [];

  if (starterPreferences.length < 5) {
    throw new HttpsError('invalid-argument', 'Choose at least five ways you feel loved to complete onboarding.');
  }

  if (starterPreferences.length > 12) {
    throw new HttpsError('invalid-argument', 'Too many starter preferences were submitted at once.');
  }

  return {
    displayName,
    notificationPrivacy,
    starterPreferences,
  } satisfies {
    displayName: string;
    notificationPrivacy: NotificationPrivacyPreference;
    starterPreferences: LovePreferencePayload[];
  };
}

async function syncPreferenceRevealSummary(
  firestore: FirebaseFirestore.Firestore,
  input: { uid: string; email: string; coupleId: string },
) {
  const profileSnapshot = await firestore.collection('users').doc(input.uid).get();
  const profile = profileSnapshot.data() as UserRelationshipProfile | undefined;
  const preferencesSnapshot = await firestore
    .collection('users')
    .doc(input.uid)
    .collection('lovePreferences')
    .orderBy('updatedAt', 'desc')
    .limit(12)
    .get();

  const preferences = preferencesSnapshot.docs
    .map(documentSnapshot => documentSnapshot.data() as Partial<LovePreferencePayload> & { area?: string; actionText?: string })
    .filter(preference => typeof preference.actionText === 'string' && preference.actionText.trim().length > 0);
  const visiblePreferences = preferences.filter(preference => preference.visibility !== 'private');
  const revealSource = visiblePreferences.length > 0 ? visiblePreferences : preferences;
  const highlightActions = revealSource.slice(0, 5).map(preference => String(preference.actionText).trim());
  const highlightAreas = Array.from(
    new Set(
      revealSource
        .map(preference => String(preference.area ?? '').trim())
        .filter(area => isOneOf(area, LOVE_AREAS)),
    ),
  ).slice(0, 3);
  const displayName = profile?.displayName?.trim() || input.email.split('@')[0] || 'Partner';

  const payload: PreferenceRevealRecord = {
    userId: input.uid,
    email: input.email,
    displayName,
    preferenceCount: preferences.length,
    highlightAreas,
    highlightActions,
    updatedAt: FieldValue.serverTimestamp(),
  };

  await firestore
    .collection('couples')
    .doc(input.coupleId)
    .collection('preferenceReveals')
    .doc(input.uid)
    .set(payload, { merge: true });
}

function normalizeLoveActionPayload(data: any, uid: string, partnerId: string): LoveActionPayload {
  const timing = readEnum(data?.timing, LOVE_TIMINGS, 'anytime');
  const responsibleUserId = readEnum(
    data?.responsibleUserId,
    [uid, partnerId] as const,
    uid,
  );

  return {
    title: readRequiredString(data?.title, 'love action title', 140),
    area: readEnum(data?.area, LOVE_AREAS, 'emotional'),
    preferenceId: readOptionalNullableString(data?.preferenceId, 120),
    notes: readOptionalString(data?.notes, 280),
    importance: readEnum(data?.importance, LOVE_IMPORTANCE, 'medium'),
    frequency: readEnum(data?.frequency, LOVE_FREQUENCIES, 'weekly'),
    timing,
    customTiming: timing === 'custom' ? readOptionalNullableString(data?.customTiming, 60) : null,
    visibility: readEnum(data?.visibility, LOVE_VISIBILITIES, 'shared'),
    status: readEnum(data?.status, LOVE_ACTION_STATUSES, 'proposed'),
    nextDueAt: readOptionalTimestamp(data?.nextDueAt),
    lastCompletedAt: readOptionalTimestamp(data?.lastCompletedAt),
    responsibleUserId,
  };
}

function normalizeLoveActionProposalResponse(data: any): LoveActionProposalResponse {
  const response = String(data?.response ?? '').trim();

  if (!isOneOf(response, LOVE_ACTION_PROPOSAL_RESPONSES)) {
    throw new HttpsError('invalid-argument', 'Love Action response must be accept or decline.');
  }

  return response;
}

function normalizeLoveActionLifecycleTarget(data: any): LoveActionLifecycleTarget {
  const targetStatus = String(data?.targetStatus ?? '').trim();

  if (
    targetStatus !== 'due'
    && targetStatus !== 'performed'
    && targetStatus !== 'confirmed'
    && targetStatus !== 'appreciated'
  ) {
    throw new HttpsError('invalid-argument', 'Love Action transition target is invalid.');
  }

  return targetStatus;
}

function normalizeLoveActionFeedback(data: any) {
  return {
    confirmationReaction: readOptionalEnum(data?.confirmationReaction, LOVE_ACTION_CONFIRMATION_REACTIONS),
    confirmationNote: readOptionalString(data?.confirmationNote, 280),
    appreciationReaction: readOptionalEnum(data?.appreciationReaction, LOVE_ACTION_APPRECIATION_REACTIONS),
    appreciationNote: readOptionalString(data?.appreciationNote, 280),
  };
}

function normalizePushDevicePayload(data: any) {
  return {
    installationId: readRequiredString(data?.installationId, 'device installation ID', 160),
    token: readRequiredString(data?.token, 'device token', 4096),
    platform: readEnum(data?.platform, PUSH_DEVICE_PLATFORMS, 'android'),
  } satisfies { installationId: string; token: string; platform: PushDevicePlatform };
}

function getLoveActionReminderDelivery(existing: any, uid: string) {
  if (!existing?.responsibleUserId || !existing?.responsibleUserEmail || !existing?.recipientUserId || !existing?.recipientUserEmail) {
    throw new HttpsError('failed-precondition', 'This Love Action is missing relationship routing details.');
  }

  if (existing.status === 'scheduled' || existing.status === 'due') {
    if (existing.recipientUserId !== uid) {
      throw new HttpsError('permission-denied', 'Only the receiving partner can remind the responsible partner for this Love Action.');
    }

    return {
      targetUserId: existing.responsibleUserId,
      title: 'Love Action reminder',
      body: `${existing.recipientUserEmail} sent you a gentle reminder about “${existing.title ?? 'your Love Action'}”.`,
    };
  }

  if (existing.status === 'performed' || existing.status === 'confirmed') {
    if (existing.responsibleUserId !== uid) {
      throw new HttpsError('permission-denied', 'Only the responsible partner can nudge the recipient after completing this Love Action.');
    }

    return {
      targetUserId: existing.recipientUserId,
      title: 'Love Action follow-up',
      body: `${existing.responsibleUserEmail} asked you to respond to “${existing.title ?? 'this Love Action'}”.`,
    };
  }

  throw new HttpsError('failed-precondition', 'This Love Action cannot send a partner reminder in its current state.');
}

function toMillis(value: unknown) {
  if (value instanceof Timestamp) {
    return value.toMillis();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (value && typeof value === 'object' && 'toMillis' in value && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
    return ((value as { toMillis: () => number }).toMillis)();
  }

  return Date.now();
}

function mapMetricLoveAction(documentSnapshot: FirebaseFirestore.QueryDocumentSnapshot): LoveActionMetricRecord {
  const data = documentSnapshot.data();

  return {
    id: documentSnapshot.id,
    area: isOneOf(String(data.area ?? ''), LOVE_AREAS) ? data.area : 'emotional',
    importance: isOneOf(String(data.importance ?? ''), LOVE_IMPORTANCE) ? data.importance : 'medium',
    status: isOneOf(String(data.status ?? ''), LOVE_ACTION_STATUSES) ? data.status : 'proposed',
    updatedAt: toMillis(data.updatedAt),
    nextDueAt: data.nextDueAt ? toMillis(data.nextDueAt) : null,
    lastCompletedAt: data.lastCompletedAt ? toMillis(data.lastCompletedAt) : null,
    respondedAt: data.respondedAt ? toMillis(data.respondedAt) : null,
  };
}

function mapMetricInsight(documentSnapshot: FirebaseFirestore.QueryDocumentSnapshot): InsightMetricRecord | null {
  const data = documentSnapshot.data();

  if (data.visibility !== 'shared') {
    return null;
  }

  return {
    id: documentSnapshot.id,
    mood: Number.isFinite(Number(data.mood)) ? Number(data.mood) : 3,
    connection: Number.isFinite(Number(data.connection)) ? Number(data.connection) : 3,
    tension: Number.isFinite(Number(data.tension)) ? Number(data.tension) : 3,
    appreciation: String(data.appreciation ?? ''),
    need: String(data.need ?? ''),
    reflection: String(data.reflection ?? ''),
    nextStep: String(data.nextStep ?? ''),
    visibility: 'shared',
    createdAt: toMillis(data.createdAt),
  };
}

function mapMetricLoveNote(documentSnapshot: FirebaseFirestore.QueryDocumentSnapshot): LoveNoteMetricRecord {
  const data = documentSnapshot.data();
  const noteType = String(data.noteType ?? 'warm');

  return {
    id: documentSnapshot.id,
    noteType: isOneOf(noteType, LOVE_NOTE_TYPES) ? noteType : 'warm',
    tags: Array.isArray(data.tags) ? data.tags.filter((value: unknown): value is string => typeof value === 'string') : [],
    createdAt: toMillis(data.createdAt),
  };
}

async function refreshRelationshipMetricSnapshots(coupleId: string) {
  const firestore = getFirestore();
  const [actionSnapshots, insightSnapshots, noteSnapshots] = await Promise.all([
    firestore.collection('couples').doc(coupleId).collection('loveActions').orderBy('updatedAt', 'desc').limit(250).get(),
    firestore.collection('couples').doc(coupleId).collection('insights').orderBy('createdAt', 'desc').limit(180).get(),
    firestore.collection('couples').doc(coupleId).collection('mirrorMessages').orderBy('createdAt', 'desc').limit(180).get(),
  ]);
  const actions = actionSnapshots.docs.map(mapMetricLoveAction);
  const insights = insightSnapshots.docs.map(mapMetricInsight).filter((entry): entry is InsightMetricRecord => !!entry);
  const notes = noteSnapshots.docs.map(mapMetricLoveNote);
  const snapshots = buildRelationshipMetricSnapshots({ actions, insights, notes });
  const batch = firestore.batch();

  snapshots.forEach(snapshot => {
    batch.set(
      firestore.collection('couples').doc(coupleId).collection('metricSnapshots').doc(snapshot.id),
      {
        ...snapshot.data,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });

  await batch.commit();
}

export const searchNearbyRestaurants = onCall(
  {
    secrets: [GOOGLE_PLACES_API_KEY],
    timeoutSeconds: 60,
  },
  async request => {
    const { uid, email } = requireAuth(request);
    await ensureRelationshipProfile(uid, email);

    const query = readRequiredString(request.data?.query, 'food type', 80);
    const latitude = readRequiredFiniteNumber(request.data?.latitude, 'latitude');
    const longitude = readRequiredFiniteNumber(request.data?.longitude, 'longitude');
    const radiusMiles = readRequiredFiniteNumber(request.data?.radiusMiles, 'radius miles');

    if (latitude < -90 || latitude > 90) {
      throw new HttpsError('invalid-argument', 'Latitude is out of range.');
    }

    if (longitude < -180 || longitude > 180) {
      throw new HttpsError('invalid-argument', 'Longitude is out of range.');
    }

    if (
      radiusMiles < MIN_NEARBY_RESTAURANT_RADIUS_MILES
      || radiusMiles > MAX_NEARBY_RESTAURANT_RADIUS_MILES
    ) {
      throw new HttpsError(
        'invalid-argument',
        `Search radius must be between ${MIN_NEARBY_RESTAURANT_RADIUS_MILES} and ${MAX_NEARBY_RESTAURANT_RADIUS_MILES} miles.`,
      );
    }

    const radiusMeters = radiusMiles * METERS_PER_MILE;

    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY.value(),
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.googleMapsUri',
      },
      body: JSON.stringify({
        textQuery: `${query} restaurant`,
        includedType: 'restaurant',
        strictTypeFiltering: true,
        maxResultCount: 8,
        rankPreference: 'RELEVANCE',
        locationBias: {
          circle: {
            center: { latitude, longitude },
            radius: radiusMeters,
          },
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Google Places search failed', {
        status: response.status,
        query,
        errorBody,
      });

      if (response.status === 403 && /API_KEY_SERVICE_BLOCKED|blocked/i.test(errorBody)) {
        throw new HttpsError(
          'failed-precondition',
          'Restaurant search is blocked for this project. Enable Places API (New) and allow this API key to use it.',
        );
      }

      throw new HttpsError('internal', 'Restaurant search is unavailable right now.');
    }

    const payload = await response.json() as {
      places?: Array<{
        id?: string;
        displayName?: { text?: string };
        formattedAddress?: string;
        location?: { latitude?: number; longitude?: number };
        googleMapsUri?: string;
      }>;
    };

    return {
      success: true,
      places: (payload.places ?? [])
        .map(place => ({
          placeId: place.id ?? '',
          name: place.displayName?.text ?? '',
          address: place.formattedAddress ?? '',
          latitude: place.location?.latitude ?? NaN,
          longitude: place.location?.longitude ?? NaN,
          googleMapsUri: typeof place.googleMapsUri === 'string' ? place.googleMapsUri : null,
        }))
        .filter(place => place.placeId && place.name && place.address && Number.isFinite(place.latitude) && Number.isFinite(place.longitude)),
    };
  },
);

export const sendPartnerInvite = onCall(
  {
    secrets: [RESEND_API_KEY],
    timeoutSeconds: 60,
  },
  async request => {
    const { uid, email } = requireAuth(request);
    const partnerEmailInput = String(request.data?.partnerEmail ?? '').trim();
    const partnerEmail = normalizeEmail(partnerEmailInput);

    if (!partnerEmailInput || !isValidEmail(partnerEmailInput)) {
      throw new HttpsError('invalid-argument', 'Enter a valid partner email first.');
    }

    if (partnerEmail === normalizeEmail(email)) {
      throw new HttpsError('invalid-argument', 'Use your partner’s email, not your own.');
    }

    await ensureRelationshipProfile(uid, email);

    const firestore = getFirestore();
    const myProfileSnapshot = await firestore.collection('users').doc(uid).get();

    if (myProfileSnapshot.data()?.coupleId) {
      throw new HttpsError('failed-precondition', 'You are already connected to a partner.');
    }

    const outgoingInviteSnapshot = await firestore
      .collection('partnerInvites')
      .where('fromUserId', '==', uid)
      .where('status', '==', 'pending')
      .limit(1)
      .get();

    if (!outgoingInviteSnapshot.empty) {
      throw new HttpsError('already-exists', 'You already have a pending partner invite.');
    }

    const targetProfileSnapshot = await firestore
      .collection('users')
      .where('normalizedEmail', '==', partnerEmail)
      .limit(1)
      .get();

    if (targetProfileSnapshot.docs[0]?.data()?.coupleId) {
      throw new HttpsError('failed-precondition', 'That partner is already connected to someone else.');
    }

    const inviteRef = await firestore.collection('partnerInvites').add({
      fromUserId: uid,
      fromEmail: email,
      toEmail: partnerEmailInput,
      normalizedToEmail: partnerEmail,
      status: 'pending',
      acceptedByUserId: null,
      coupleId: null,
      deliveryProvider: IS_FUNCTIONS_EMULATOR ? 'emulator' : 'resend',
      deliveryStatus: IS_FUNCTIONS_EMULATOR ? 'emulator' : 'pending',
      deliveryErrorMessage: null,
      deliverySentAt: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    let deliveryStatus: InviteDeliveryStatus = IS_FUNCTIONS_EMULATOR ? 'emulator' : 'sent';
    let deliveryErrorMessage: string | null = null;

    if (!IS_FUNCTIONS_EMULATOR) {
      try {
        const resend = new Resend(RESEND_API_KEY.value());
        const result = await resend.emails.send({
          from: INVITE_FROM_EMAIL.value(),
          to: partnerEmailInput,
          replyTo: email,
          subject: `${email} invited you to connect on How 2 Love Me`,
          html: getInviteEmailHtml(email),
          text: getInviteEmailText(email),
        });

        if (result.error) {
          throw new Error(result.error.message);
        }

        await inviteRef.update({
          deliveryStatus: 'sent',
          deliveryErrorMessage: null,
          deliverySentAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      } catch (error) {
        deliveryStatus = 'failed';
        deliveryErrorMessage = getErrorMessage(error);
        console.error('Partner invite email delivery failed', {
          inviteId: inviteRef.id,
          partnerEmail,
          deliveryErrorMessage,
        });
        await inviteRef.update({
          deliveryStatus,
          deliveryErrorMessage,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    } else {
      await inviteRef.update({
        deliveryStatus: 'emulator',
        deliveryErrorMessage: null,
        deliverySentAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    return {
      success: true,
      deliveryStatus,
      deliveryErrorMessage:
        deliveryStatus === 'failed'
          ? 'Invite created, but email delivery failed. They can still accept it from the Us tab once signed in.'
          : null,
    };
  },
);

export const acceptPartnerInvite = onCall(async request => {
  const { uid, email } = requireAuth(request);
  const inviteId = String(request.data?.inviteId ?? '').trim();

  if (!inviteId) {
    throw new HttpsError('invalid-argument', 'Missing partner invite ID.');
  }

  await ensureRelationshipProfile(uid, email);

  const firestore = getFirestore();

  let coupleId = '';
  let inviterUserId = '';
  let inviterEmail = '';

  await firestore.runTransaction(async transaction => {
    const inviteRef = firestore.collection('partnerInvites').doc(inviteId);
    const inviteSnapshot = await transaction.get(inviteRef);

    if (!inviteSnapshot.exists) {
      throw new HttpsError('not-found', 'That partner invite no longer exists.');
    }

    const invite = inviteSnapshot.data();

    if (!invite) {
      throw new HttpsError('not-found', 'That partner invite no longer exists.');
    }

    if (invite.status !== 'pending') {
      throw new HttpsError('failed-precondition', 'That partner invite is no longer pending.');
    }

    if (invite.normalizedToEmail !== normalizeEmail(email)) {
      throw new HttpsError('permission-denied', 'That invite was sent to a different email address.');
    }

    const inviterRef = firestore.collection('users').doc(invite.fromUserId);
    const recipientRef = firestore.collection('users').doc(uid);
    const inviterSnapshot = await transaction.get(inviterRef);
    const recipientSnapshot = await transaction.get(recipientRef);
    const inviterProfile = inviterSnapshot.data();
    const recipientProfile = recipientSnapshot.data();

    if (inviterProfile?.coupleId) {
      throw new HttpsError('failed-precondition', 'That partner is already connected.');
    }

    if (recipientProfile?.coupleId) {
      throw new HttpsError('failed-precondition', 'You are already connected to a partner.');
    }

    const coupleRef = firestore.collection('couples').doc();
    coupleId = coupleRef.id;
    inviterUserId = invite.fromUserId;
    inviterEmail = invite.fromEmail;

    transaction.set(coupleRef, {
      inviteId,
      memberIds: [invite.fromUserId, uid],
      memberEmails: [invite.fromEmail, email],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    transaction.set(
      inviterRef,
      {
        email: invite.fromEmail,
        normalizedEmail: normalizeEmail(invite.fromEmail),
        partnerId: uid,
        partnerEmail: email,
        coupleId: coupleRef.id,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    transaction.set(
      recipientRef,
      {
        email,
        normalizedEmail: normalizeEmail(email),
        partnerId: invite.fromUserId,
        partnerEmail: invite.fromEmail,
        coupleId: coupleRef.id,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    transaction.update(inviteRef, {
      status: 'accepted',
      acceptedByUserId: uid,
      coupleId: coupleRef.id,
      acceptedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  if (coupleId) {
    await Promise.all([
      syncPreferenceRevealSummary(firestore, {
        uid: inviterUserId,
        email: inviterEmail,
        coupleId,
      }),
      syncPreferenceRevealSummary(firestore, {
        uid,
        email,
        coupleId,
      }),
      refreshRelationshipMetricSnapshots(coupleId),
    ]);
  }

  return { success: true };
});

export const declinePartnerInvite = onCall(async request => {
  const { uid, email } = requireAuth(request);
  const inviteId = String(request.data?.inviteId ?? '').trim();

  if (!inviteId) {
    throw new HttpsError('invalid-argument', 'Missing partner invite ID.');
  }

  const firestore = getFirestore();
  const inviteRef = firestore.collection('partnerInvites').doc(inviteId);
  const inviteSnapshot = await inviteRef.get();
  const invite = inviteSnapshot.data();

  if (!inviteSnapshot.exists || !invite) {
    throw new HttpsError('not-found', 'That partner invite no longer exists.');
  }

  if (invite.normalizedToEmail !== normalizeEmail(email)) {
    throw new HttpsError('permission-denied', 'That invite was sent to a different email address.');
  }

  if (invite.status !== 'pending') {
    throw new HttpsError('failed-precondition', 'That partner invite is no longer pending.');
  }

  await inviteRef.update({
    status: 'declined',
    declinedByUserId: uid,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { success: true };
});

export const cancelPartnerInvite = onCall(async request => {
  const { uid } = requireAuth(request);
  const inviteId = String(request.data?.inviteId ?? '').trim();

  if (!inviteId) {
    throw new HttpsError('invalid-argument', 'Missing partner invite ID.');
  }

  const firestore = getFirestore();
  const inviteRef = firestore.collection('partnerInvites').doc(inviteId);
  const inviteSnapshot = await inviteRef.get();
  const invite = inviteSnapshot.data();

  if (!inviteSnapshot.exists || !invite) {
    throw new HttpsError('not-found', 'That partner invite no longer exists.');
  }

  if (invite.fromUserId !== uid) {
    throw new HttpsError('permission-denied', 'Only the sender can cancel this invite.');
  }

  if (invite.status !== 'pending') {
    throw new HttpsError('failed-precondition', 'That partner invite is no longer pending.');
  }

  await inviteRef.update({
    status: 'cancelled',
    cancelledByUserId: uid,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { success: true };
});

export const completeOnboarding = onCall(async request => {
  const { uid, email } = requireAuth(request);
  await ensureRelationshipProfile(uid, email);

  const { displayName, notificationPrivacy, starterPreferences } = normalizeOnboardingPayload(request.data);
  const firestore = getFirestore();
  const userRef = firestore.collection('users').doc(uid);
  const profileSnapshot = await userRef.get();
  const profile = profileSnapshot.data() as UserRelationshipProfile | undefined;

  const batch = firestore.batch();
  batch.set(
    userRef,
    {
      email,
      normalizedEmail: normalizeEmail(email),
      displayName,
      notificationPrivacy,
      adultConfirmedAt: profile?.adultConfirmedAt ?? FieldValue.serverTimestamp(),
      privacyAcceptedAt: profile?.privacyAcceptedAt ?? FieldValue.serverTimestamp(),
      safetyAcceptedAt: profile?.safetyAcceptedAt ?? FieldValue.serverTimestamp(),
      onboardingCompletedAt: profile?.onboardingCompletedAt ?? FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      lastSeenAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  if (!profile?.onboardingCompletedAt) {
    starterPreferences.forEach((preference: LovePreferencePayload) => {
      const preferenceRef = userRef.collection('lovePreferences').doc();
      batch.set(preferenceRef, {
        ...preference,
        createdByUserId: uid,
        createdByEmail: email,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
  }

  await batch.commit();

  const nextProfileSnapshot = await userRef.get();
  const nextProfile = nextProfileSnapshot.data() as UserRelationshipProfile | undefined;

  if (nextProfile?.coupleId) {
    await syncPreferenceRevealSummary(firestore, {
      uid,
      email,
      coupleId: nextProfile.coupleId,
    });
  }

  return { success: true, preferenceCount: starterPreferences.length };
});

export const createLovePreference = onCall(async request => {
  const { uid, email } = requireAuth(request);
  await ensureRelationshipProfile(uid, email);

  const payload = normalizeLovePreferencePayload(request.data);
  const firestore = getFirestore();
  const profile = await getRelationshipProfile(uid);
  const preferenceRef = await firestore.collection('users').doc(uid).collection('lovePreferences').add({
    ...payload,
    createdByUserId: uid,
    createdByEmail: email,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  if (profile.coupleId) {
    await syncPreferenceRevealSummary(firestore, { uid, email, coupleId: profile.coupleId });
  }

  return { success: true, preferenceId: preferenceRef.id };
});

export const updateLovePreference = onCall(async request => {
  const { uid, email } = requireAuth(request);
  await ensureRelationshipProfile(uid, email);

  const preferenceId = readRequiredString(request.data?.preferenceId, 'love preference ID', 120);
  const payload = normalizeLovePreferencePayload(request.data);
  const firestore = getFirestore();
  const profile = await getRelationshipProfile(uid);
  const preferenceRef = firestore.collection('users').doc(uid).collection('lovePreferences').doc(preferenceId);
  const preferenceSnapshot = await preferenceRef.get();
  const existing = preferenceSnapshot.data();

  if (!preferenceSnapshot.exists || !existing) {
    throw new HttpsError('not-found', 'That love preference no longer exists.');
  }

  if (existing.createdByUserId !== uid) {
    throw new HttpsError('permission-denied', 'Only the owner can update this love preference.');
  }

  await preferenceRef.update({
    ...payload,
    createdByUserId: existing.createdByUserId,
    createdByEmail: existing.createdByEmail,
    createdAt: existing.createdAt,
    updatedAt: FieldValue.serverTimestamp(),
  });

  if (profile.coupleId) {
    await syncPreferenceRevealSummary(firestore, { uid, email, coupleId: profile.coupleId });
  }

  return { success: true, preferenceId };
});

export const createLoveAction = onCall(async request => {
  const { uid, email } = requireAuth(request);
  await ensureRelationshipProfile(uid, email);

  const { coupleId, partnerId, partnerEmail } = await requireConnectedRelationship(uid);
  const payload = normalizeLoveActionPayload(request.data, uid, partnerId);
  const responsibleUserId = payload.responsibleUserId;
  const recipientUserId = responsibleUserId === uid ? partnerId : uid;
  const responsibleUserEmail = responsibleUserId === uid ? email : partnerEmail;
  const recipientUserEmail = recipientUserId === uid ? email : partnerEmail;
  const firestore = getFirestore();
  const actionRef = await firestore.collection('couples').doc(coupleId).collection('loveActions').add({
    title: payload.title,
    area: payload.area,
    preferenceId: payload.preferenceId,
    notes: payload.notes,
    importance: payload.importance,
    frequency: payload.frequency,
    timing: payload.timing,
    customTiming: payload.customTiming,
    visibility: payload.visibility,
    status: payload.status,
    nextDueAt: payload.nextDueAt,
    lastCompletedAt: payload.lastCompletedAt,
    respondedAt: null,
    respondedByUserId: null,
    respondedByEmail: null,
    confirmationReaction: null,
    confirmationNote: '',
    appreciationReaction: null,
    appreciationNote: '',
    proposedByUserId: uid,
    proposedByEmail: email,
    responsibleUserId,
    responsibleUserEmail,
    recipientUserId,
    recipientUserEmail,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { success: true, actionId: actionRef.id };
});

export const updateLoveAction = onCall(async request => {
  const { uid, email } = requireAuth(request);
  await ensureRelationshipProfile(uid, email);

  const actionId = readRequiredString(request.data?.actionId, 'love action ID', 120);
  const { coupleId, partnerId, partnerEmail } = await requireConnectedRelationship(uid);
  const payload = normalizeLoveActionPayload(request.data, uid, partnerId);
  const firestore = getFirestore();
  const actionRef = firestore.collection('couples').doc(coupleId).collection('loveActions').doc(actionId);
  const actionSnapshot = await actionRef.get();
  const existing = actionSnapshot.data();

  if (!actionSnapshot.exists || !existing) {
    throw new HttpsError('not-found', 'That love action no longer exists.');
  }

  if (existing.proposedByUserId !== uid) {
    throw new HttpsError('permission-denied', 'Only the original proposer can update this love action right now.');
  }

  const responsibleUserId = payload.responsibleUserId;
  const recipientUserId = responsibleUserId === uid ? partnerId : uid;
  const responsibleUserEmail = responsibleUserId === uid ? email : partnerEmail;
  const recipientUserEmail = recipientUserId === uid ? email : partnerEmail;

  await actionRef.update({
    title: payload.title,
    area: payload.area,
    preferenceId: payload.preferenceId,
    notes: payload.notes,
    importance: payload.importance,
    frequency: payload.frequency,
    timing: payload.timing,
    customTiming: payload.customTiming,
    visibility: payload.visibility,
    status: payload.status,
    nextDueAt: payload.nextDueAt,
    lastCompletedAt: payload.lastCompletedAt,
    respondedAt: payload.status === 'proposed' ? null : existing.respondedAt ?? null,
    respondedByUserId: payload.status === 'proposed' ? null : existing.respondedByUserId ?? null,
    respondedByEmail: payload.status === 'proposed' ? null : existing.respondedByEmail ?? null,
    confirmationReaction: payload.status === 'proposed' ? null : existing.confirmationReaction ?? null,
    confirmationNote: payload.status === 'proposed' ? '' : existing.confirmationNote ?? '',
    appreciationReaction: payload.status === 'proposed' ? null : existing.appreciationReaction ?? null,
    appreciationNote: payload.status === 'proposed' ? '' : existing.appreciationNote ?? '',
    proposedByUserId: existing.proposedByUserId,
    proposedByEmail: existing.proposedByEmail,
    responsibleUserId,
    responsibleUserEmail,
    recipientUserId,
    recipientUserEmail,
    createdAt: existing.createdAt,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { success: true, actionId };
});

export const deleteLovePreference = onCall(async request => {
  const { uid, email } = requireAuth(request);
  await ensureRelationshipProfile(uid, email);

  const preferenceId = readRequiredString(request.data?.preferenceId, 'love preference ID', 120);
  const firestore = getFirestore();
  const profile = await getRelationshipProfile(uid);
  const preferenceRef = firestore.collection('users').doc(uid).collection('lovePreferences').doc(preferenceId);
  const preferenceSnapshot = await preferenceRef.get();
  const existing = preferenceSnapshot.data();

  if (!preferenceSnapshot.exists || !existing) {
    throw new HttpsError('not-found', 'That love preference no longer exists.');
  }

  if (existing.createdByUserId !== uid) {
    throw new HttpsError('permission-denied', 'Only the owner can delete this love preference.');
  }

  await preferenceRef.delete();

  if (profile.coupleId) {
    await syncPreferenceRevealSummary(firestore, { uid, email, coupleId: profile.coupleId });
  }

  return { success: true, preferenceId };
});

export const deleteLoveAction = onCall(async request => {
  const { uid, email } = requireAuth(request);
  await ensureRelationshipProfile(uid, email);

  const actionId = readRequiredString(request.data?.actionId, 'love action ID', 120);
  const { coupleId } = await requireConnectedRelationship(uid);
  const firestore = getFirestore();
  const actionRef = firestore.collection('couples').doc(coupleId).collection('loveActions').doc(actionId);
  const actionSnapshot = await actionRef.get();
  const existing = actionSnapshot.data();

  if (!actionSnapshot.exists || !existing) {
    throw new HttpsError('not-found', 'That love action no longer exists.');
  }

  if (existing.proposedByUserId !== uid) {
    throw new HttpsError('permission-denied', 'Only the original proposer can delete this love action right now.');
  }

  await actionRef.delete();
  return { success: true, actionId };
});

export const respondToLoveActionProposal = onCall(async request => {
  const { uid, email } = requireAuth(request);
  await ensureRelationshipProfile(uid, email);

  const actionId = readRequiredString(request.data?.actionId, 'love action ID', 120);
  const response = normalizeLoveActionProposalResponse(request.data);
  const { coupleId } = await requireConnectedRelationship(uid);
  const firestore = getFirestore();
  const actionRef = firestore.collection('couples').doc(coupleId).collection('loveActions').doc(actionId);
  const actionSnapshot = await actionRef.get();
  const existing = actionSnapshot.data();

  if (!actionSnapshot.exists || !existing) {
    throw new HttpsError('not-found', 'That love action no longer exists.');
  }

  if (existing.recipientUserId !== uid) {
    throw new HttpsError('permission-denied', 'Only the receiving partner can respond to this proposal.');
  }

  if (existing.status !== 'proposed') {
    throw new HttpsError('failed-precondition', 'Only proposed Love Actions can be accepted or declined.');
  }

  const nextStatus: LoveActionStatus = response === 'accept' ? 'scheduled' : 'needsAttention';

  await actionRef.update({
    status: nextStatus,
    respondedAt: FieldValue.serverTimestamp(),
    respondedByUserId: uid,
    respondedByEmail: email,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { success: true, actionId, status: nextStatus };
});

export const transitionLoveActionStatus = onCall(async request => {
  const { uid, email } = requireAuth(request);
  await ensureRelationshipProfile(uid, email);

  const actionId = readRequiredString(request.data?.actionId, 'love action ID', 120);
  const targetStatus = normalizeLoveActionLifecycleTarget(request.data);
  const feedback = normalizeLoveActionFeedback(request.data);
  const { coupleId } = await requireConnectedRelationship(uid);
  const firestore = getFirestore();
  const actionRef = firestore.collection('couples').doc(coupleId).collection('loveActions').doc(actionId);
  const actionSnapshot = await actionRef.get();
  const existing = actionSnapshot.data();

  if (!actionSnapshot.exists || !existing) {
    throw new HttpsError('not-found', 'That love action no longer exists.');
  }

  if (targetStatus === 'due') {
    if (existing.responsibleUserId !== uid) {
      throw new HttpsError('permission-denied', 'Only the responsible partner can mark this Love Action due.');
    }

    if (existing.status !== 'scheduled') {
      throw new HttpsError('failed-precondition', 'Only scheduled Love Actions can move into due.');
    }

    await actionRef.update({
      status: 'due',
      nextDueAt: existing.nextDueAt ?? FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { success: true, actionId, status: 'due' };
  }

  if (targetStatus === 'performed') {
    if (existing.responsibleUserId !== uid) {
      throw new HttpsError('permission-denied', 'Only the responsible partner can mark this Love Action done.');
    }

    if (existing.status !== 'due') {
      throw new HttpsError('failed-precondition', 'Only due Love Actions can be marked performed.');
    }

    await actionRef.update({
      status: 'performed',
      lastCompletedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { success: true, actionId, status: 'performed' };
  }

  if (targetStatus === 'confirmed') {
    if (existing.recipientUserId !== uid) {
      throw new HttpsError('permission-denied', 'Only the receiving partner can confirm this Love Action.');
    }

    if (existing.status !== 'performed') {
      throw new HttpsError('failed-precondition', 'Only performed Love Actions can be confirmed.');
    }

    await actionRef.update({
      status: 'confirmed',
      confirmationReaction: feedback.confirmationReaction,
      confirmationNote: feedback.confirmationNote,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { success: true, actionId, status: 'confirmed' };
  }

  if (existing.recipientUserId !== uid) {
    throw new HttpsError('permission-denied', 'Only the receiving partner can appreciate this Love Action.');
  }

  if (existing.status !== 'performed' && existing.status !== 'confirmed') {
    throw new HttpsError('failed-precondition', 'Only performed or confirmed Love Actions can be appreciated.');
  }

  await actionRef.update({
    status: 'appreciated',
    appreciationReaction: feedback.appreciationReaction,
    appreciationNote: feedback.appreciationNote,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { success: true, actionId, status: 'appreciated' };
});

export const registerDevicePushToken = onCall(async request => {
  const { uid, email } = requireAuth(request);
  await ensureRelationshipProfile(uid, email);

  const { installationId, token, platform } = normalizePushDevicePayload(request.data);
  const firestore = getFirestore();
  const deviceRef = firestore.collection('users').doc(uid).collection('pushDevices').doc(installationId);
  const snapshot = await deviceRef.get();

  await deviceRef.set(
    {
      installationId,
      token,
      platform,
      createdAt: snapshot.exists ? snapshot.get('createdAt') ?? FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return { success: true, installationId };
});

export const unregisterDevicePushToken = onCall(async request => {
  const { uid, email } = requireAuth(request);
  await ensureRelationshipProfile(uid, email);

  const installationId = readRequiredString(request.data?.installationId, 'device installation ID', 160);
  const firestore = getFirestore();
  await firestore.collection('users').doc(uid).collection('pushDevices').doc(installationId).delete();

  return { success: true, installationId };
});

export const sendLoveActionReminder = onCall(async request => {
  const { uid, email } = requireAuth(request);
  await ensureRelationshipProfile(uid, email);

  const actionId = readRequiredString(request.data?.actionId, 'love action ID', 120);
  const { coupleId } = await requireConnectedRelationship(uid);
  const firestore = getFirestore();
  const actionRef = firestore.collection('couples').doc(coupleId).collection('loveActions').doc(actionId);
  const actionSnapshot = await actionRef.get();
  const existing = actionSnapshot.data();

  if (!actionSnapshot.exists || !existing) {
    throw new HttpsError('not-found', 'That love action no longer exists.');
  }

  const delivery = getLoveActionReminderDelivery(existing, uid);
  const deviceSnapshots = await firestore
    .collection('users')
    .doc(delivery.targetUserId)
    .collection('pushDevices')
    .get();

  if (deviceSnapshots.empty) {
    return { success: true, actionId, deliveredCount: 0, targetUserId: delivery.targetUserId };
  }

  const tokens = deviceSnapshots.docs
    .map(snapshot => ({ id: snapshot.id, token: snapshot.get('token') as string | undefined }))
    .filter(device => !!device.token);

  let deliveredCount = 0;

  await Promise.all(
    tokens.map(async device => {
      try {
        await getMessaging().send({
          token: device.token!,
          notification: {
            title: delivery.title,
            body: delivery.body,
          },
          data: {
            type: 'loveActionReminder',
            actionId,
            coupleId,
          },
          android: {
            priority: 'high',
            notification: {
              channelId: 'love-reminders',
            },
          },
          apns: {
            payload: {
              aps: {
                sound: 'default',
              },
            },
          },
        });
        deliveredCount += 1;
      } catch (error: any) {
        if (
          error?.code === 'messaging/registration-token-not-registered'
          || error?.code === 'messaging/invalid-registration-token'
        ) {
          await firestore
            .collection('users')
            .doc(delivery.targetUserId)
            .collection('pushDevices')
            .doc(device.id)
            .delete();
        }
      }
    }),
  );

  return { success: true, actionId, deliveredCount, targetUserId: delivery.targetUserId };
});

export const syncRelationshipMetricsFromLoveActions = onDocumentWritten(
  'couples/{coupleId}/loveActions/{actionId}',
  async event => {
    await refreshRelationshipMetricSnapshots(event.params.coupleId);
  },
);

export const syncRelationshipMetricsFromInsights = onDocumentWritten(
  'couples/{coupleId}/insights/{insightId}',
  async event => {
    await refreshRelationshipMetricSnapshots(event.params.coupleId);
  },
);

export const syncRelationshipMetricsFromLoveNotes = onDocumentWritten(
  'couples/{coupleId}/mirrorMessages/{messageId}',
  async event => {
    await refreshRelationshipMetricSnapshots(event.params.coupleId);
  },
);

