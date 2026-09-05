import type { LoveNoteType } from '../lib/loveNotes';
import type { MirrorMessage } from '../store/useMirrorMessageStore';
import type { InsightEntry } from '../store/useInsightsStore';
import type { LoveAction } from '../store/useLoveActionStore';
import type { LoveArea, LovePreferenceImportance } from '../store/useLoveProfileStore';

export type MetricsWindow = '7d' | '30d' | '90d';
export type PulseTrend = 'rising' | 'steady' | 'dipping';
export type PulseLabel = 'strained' | 'fragile' | 'steady' | 'warming' | 'deepening';
export type HistoryEventKind = 'note' | 'insight' | 'actionCompleted' | 'actionAppreciated';
export type CoachingFocus = 'insights' | 'loveNotes' | 'loveActions';

export type ScoreComponent = {
  id: string;
  label: string;
  score: number;
  summary: string;
};

export type CoachingRecommendation = {
  id: string;
  title: string;
  body: string;
  ctaLabel: string;
  focus: CoachingFocus;
  area: LoveArea | null;
  promptId: string | null;
  noteType: LoveNoteType | null;
};

export type ScoreBreakdown = {
  score: number;
  actionCoverage: number;
  appreciationCoverage: number;
  averageConnection: number;
  averageTension: number;
  averageMood: number;
  noteMomentum: number;
  actionReliability: number;
  appreciationScore: number;
  reflectionScore: number;
  noteCareScore: number;
  emotionalPresenceScore: number;
  sharedReflectionRatio: number;
  trendDelta: number;
  dominantArea: LoveArea | null;
  weakestArea: LoveArea | null;
  measuredActions: LoveAction[];
  completedActions: LoveAction[];
  appreciatedActions: LoveAction[];
  measuredInsights: InsightEntry[];
  measuredNotes: MirrorMessage[];
  componentScores: ScoreComponent[];
  recommendations: CoachingRecommendation[];
};

export type PulseSummary = {
  label: PulseLabel;
  trend: PulseTrend;
  averageMood: number;
  averageConnection: number;
  averageTension: number;
  checkInStreakDays: number;
  sharedReflectionCount: number;
  recentReflectionCount: number;
  scoreDelta: number;
};

export type AreaBalanceItem = {
  area: LoveArea;
  count: number;
  share: number;
};

export type HistoryEvent = {
  id: string;
  kind: HistoryEventKind;
  title: string;
  body: string;
  badge: string;
  timestamp: number;
};

export type RelationshipMetricSnapshot = {
  id: string;
  window: MetricsWindow;
  capturedDay: string;
  capturedDate: number;
  updatedAt: number;
  score: number;
  pulseLabel: PulseLabel;
  pulseTrend: PulseTrend;
  averageMood: number;
  averageConnection: number;
  averageTension: number;
  checkInStreakDays: number;
  sharedInsightCount: number;
  loveNoteCount: number;
  completedActionCount: number;
  appreciatedActionCount: number;
  actionReliability: number;
  appreciationScore: number;
  reflectionScore: number;
  noteCareScore: number;
  emotionalPresenceScore: number;
  dominantArea: LoveArea | null;
  weakestArea: LoveArea | null;
  recommendationTitles: string[];
};

export type MetricChartPoint = {
  id: string;
  label: string;
  score: number;
  connection: number;
  tension: number;
  streak: number;
};

const ALL_LOVE_AREAS: LoveArea[] = [
  'emotional',
  'physicalIntimate',
  'communication',
  'financial',
  'spiritual',
  'mental',
  'social',
  'partnership',
];
const WINDOW_DAYS: Record<MetricsWindow, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};
const ACTION_STATUS_VALUES = {
  proposed: 0,
  scheduled: 0.35,
  due: 0.18,
  performed: 0.72,
  confirmed: 0.9,
  appreciated: 1,
  needsAttention: 0.08,
  cancelled: 0,
} as const;
const IMPORTANCE_WEIGHTS: Record<LovePreferenceImportance, number> = {
  low: 0.8,
  medium: 1,
  high: 1.15,
  essential: 1.3,
};

export function getMetricsWindowStart(window: MetricsWindow, now = Date.now()) {
  return now - WINDOW_DAYS[window] * 24 * 60 * 60 * 1000;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, value));
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundMetric(value: number) {
  return Math.round(value * 10) / 10;
}

function toDayKey(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function formatChartLabel(capturedDay: string) {
  const [year, month, day] = capturedDay.split('-');

  if (!year || !month || !day) {
    return capturedDay;
  }

  return `${month}/${day}`;
}

function getActionMeasurementTimestamp(action: LoveAction) {
  return action.lastCompletedAt ?? action.respondedAt ?? action.nextDueAt ?? action.updatedAt;
}

function isMeasuredAction(action: LoveAction, windowStart: number) {
  return getActionMeasurementTimestamp(action) >= windowStart && action.status !== 'cancelled';
}

function getImportanceWeight(importance: LovePreferenceImportance) {
  return IMPORTANCE_WEIGHTS[importance] ?? 1;
}

function getRecencyWeight(timestamp: number, windowStart: number, now: number) {
  const totalRange = Math.max(1, now - windowStart);
  const ageRatio = Math.max(0, Math.min(1, (timestamp - windowStart) / totalRange));
  return 0.55 + ageRatio * 0.45;
}

function getReflectionCompleteness(entry: InsightEntry) {
  const writtenCount = [entry.appreciation, entry.need, entry.reflection, entry.nextStep].filter(value => value.trim()).length;
  return writtenCount / 4;
}

function getActionAreaCounts(actions: LoveAction[]) {
  return ALL_LOVE_AREAS.reduce<Record<LoveArea, number>>((result, area) => {
    result[area] = 0;
    return result;
  }, {} as Record<LoveArea, number>);
}

function getDominantAndWeakestArea(actions: LoveAction[]) {
  if (actions.length === 0) {
    return { dominantArea: null, weakestArea: null };
  }

  const counts = actions.reduce((result, action) => {
    result[action.area] += action.status === 'appreciated' ? 2 : 1;
    return result;
  }, getActionAreaCounts(actions));
  const sortedAreas = Object.entries(counts).sort((left, right) => right[1] - left[1]);
  const dominantArea = (sortedAreas[0]?.[0] ?? null) as LoveArea | null;
  const weakestNonZero = Object.entries(counts)
    .filter(([, count]) => count > 0)
    .sort((left, right) => left[1] - right[1])[0]?.[0] ?? null;
  const untouchedArea = Object.entries(counts).find(([, count]) => count === 0)?.[0] ?? null;

  return {
    dominantArea,
    weakestArea: (untouchedArea ?? weakestNonZero) as LoveArea | null,
  };
}

function buildCoachingRecommendations(input: {
  score: number;
  actionReliability: number;
  appreciationScore: number;
  reflectionScore: number;
  noteCareScore: number;
  averageConnection: number;
  averageTension: number;
  sharedReflectionRatio: number;
  sharedInsightCount: number;
  loveNoteCount: number;
  weakestArea: LoveArea | null;
  dominantArea: LoveArea | null;
}) {
  const recommendations: CoachingRecommendation[] = [];

  if (input.sharedInsightCount === 0 || input.sharedReflectionRatio < 35) {
    recommendations.push({
      id: 'share-reflection',
      title: 'Bring one reflection into the shared space',
      body: 'Your relationship score becomes more trustworthy when at least one honest check-in is visible to both of you.',
      ctaLabel: 'Share an insight',
      focus: 'insights',
      area: null,
      promptId: null,
      noteType: null,
    });
  }

  if (input.averageTension >= 3.6) {
    recommendations.push({
      id: 'repair-note',
      title: 'Use a repair-oriented Love Note today',
      body: 'Tension is elevated right now. A gentle repair opener or steady reassurance note is likely to help more than a bigger gesture.',
      ctaLabel: 'Open Love Notes',
      focus: 'loveNotes',
      area: input.weakestArea,
      promptId: 'repair-open',
      noteType: 'reassuring',
    });
  }

  if (input.actionReliability < 50) {
    recommendations.push({
      id: 'schedule-small-action',
      title: 'Schedule one smaller, easier Love Action',
      body: `Follow-through looks inconsistent. Pick one low-effort action${input.weakestArea ? ` in ${input.weakestArea}` : ''} so completion can recover before you add more complexity.`,
      ctaLabel: 'Plan an action',
      focus: 'loveActions',
      area: input.weakestArea,
      promptId: null,
      noteType: null,
    });
  }

  if (input.appreciationScore < 45) {
    recommendations.push({
      id: 'name-appreciation',
      title: 'Close the loop with appreciation',
      body: 'Completed care is not showing much acknowledgment yet. Naming what landed well will strengthen the score and the relationship signal.',
      ctaLabel: 'Appreciate an action',
      focus: 'loveActions',
      area: input.dominantArea,
      promptId: null,
      noteType: null,
    });
  }

  if (input.noteCareScore < 45 || input.loveNoteCount === 0) {
    recommendations.push({
      id: 'warm-note',
      title: 'Send a warm or grateful Love Note',
      body: 'Your recent note momentum is light. A short, specific message can improve warmth quickly without requiring a full check-in.',
      ctaLabel: 'Send a Love Note',
      focus: 'loveNotes',
      area: input.dominantArea,
      promptId: input.score < 60 ? 'warm-return' : 'gratitude-drop',
      noteType: input.score < 60 ? 'warm' : 'grateful',
    });
  }

  if (input.averageConnection <= 2.8 && input.score < 60) {
    recommendations.push({
      id: 'rebuild-connection',
      title: 'Rebuild closeness before asking for more',
      body: 'Connection is reading low. Lead with reassurance or gratitude, then choose one concrete next step instead of several open loops.',
      ctaLabel: 'Open Insights',
      focus: 'insights',
      area: null,
      promptId: null,
      noteType: null,
    });
  }

  return recommendations.slice(0, 3);
}

export function buildScoreBreakdown(input: {
  actions: LoveAction[];
  insights: InsightEntry[];
  notes: MirrorMessage[];
  windowStart: number;
  now?: number;
}) : ScoreBreakdown {
  const now = input.now ?? Date.now();
  const measuredActions = input.actions.filter(action => isMeasuredAction(action, input.windowStart));
  const completedActions = measuredActions.filter(
    action => action.status === 'performed' || action.status === 'confirmed' || action.status === 'appreciated',
  );
  const appreciatedActions = measuredActions.filter(action => action.status === 'appreciated');
  const measuredInsights = input.insights
    .filter(entry => entry.createdAt >= input.windowStart)
    .slice()
    .sort((left, right) => right.createdAt - left.createdAt);
  const measuredNotes = input.notes
    .filter(note => note.createdAt >= input.windowStart)
    .slice()
    .sort((left, right) => right.createdAt - left.createdAt);
  const weightedActionTotals = measuredActions.reduce(
    (result, action) => {
      const timestamp = getActionMeasurementTimestamp(action);
      const recencyWeight = getRecencyWeight(timestamp, input.windowStart, now);
      const importanceWeight = getImportanceWeight(action.importance);
      const baseWeight = recencyWeight * importanceWeight;
      const statusValue = ACTION_STATUS_VALUES[action.status] ?? 0;

      result.max += baseWeight;
      result.actual += baseWeight * statusValue;
      result.appreciationMax += baseWeight;
      result.appreciationActual +=
        baseWeight
        * (action.status === 'appreciated'
          ? 1
          : action.status === 'confirmed'
            ? 0.65
            : action.status === 'performed'
              ? 0.4
              : 0.1);
      return result;
    },
    { max: 0, actual: 0, appreciationMax: 0, appreciationActual: 0 },
  );
  const actionReliability =
    weightedActionTotals.max === 0 ? 0 : (weightedActionTotals.actual / weightedActionTotals.max) * 100;
  const appreciationScore =
    weightedActionTotals.appreciationMax === 0
      ? 0
      : (weightedActionTotals.appreciationActual / weightedActionTotals.appreciationMax) * 100;
  const reflectionCompleteness = average(measuredInsights.map(getReflectionCompleteness));
  const sharedReflectionRatio =
    measuredInsights.length === 0
      ? 0
      : (measuredInsights.filter(entry => entry.visibility === 'shared').length / measuredInsights.length) * 100;
  const reflectionFrequencyScore = Math.min(1, measuredInsights.length / 6) * 100;
  const repairFollowThroughScore = average(
    measuredInsights.map(entry => (entry.nextStep.trim() ? 1 : 0.35) + (entry.need.trim() ? 0.25 : 0)),
  ) * 80;
  const reflectionScore = clampScore(
    reflectionCompleteness * 45 + reflectionFrequencyScore * 0.3 + repairFollowThroughScore * 0.25,
  );
  const averageMood = average(measuredInsights.map(entry => entry.mood));
  const averageConnection = average(measuredInsights.map(entry => entry.connection));
  const averageTension = average(measuredInsights.map(entry => entry.tension));
  const emotionalPresenceScore = measuredInsights.length === 0
    ? 0
    : clampScore((((averageMood + averageConnection + (6 - averageTension)) / 3) / 5) * 100);
  const uniqueNoteTypes = new Set(measuredNotes.map(note => note.noteType)).size;
  const averageNoteTags = average(measuredNotes.map(note => note.tags.length));
  const noteFrequencyScore = Math.min(1, measuredNotes.length / 8) * 100;
  const noteDiversityScore = (uniqueNoteTypes / 5) * 100;
  const noteSpecificityScore = Math.min(100, averageNoteTags * 28);
  const noteCareScore = clampScore(noteFrequencyScore * 0.45 + noteDiversityScore * 0.25 + noteSpecificityScore * 0.3);
  const actionCoverage = measuredActions.length === 0 ? 0 : (completedActions.length / measuredActions.length) * 100;
  const appreciationCoverage = measuredActions.length === 0 ? 0 : (appreciatedActions.length / measuredActions.length) * 100;
  const noteMomentum = noteFrequencyScore;
  const recentInsights = measuredInsights.slice(0, 3);
  const previousInsights = measuredInsights.slice(3, 6);
  const recentActions = measuredActions.slice(0, 4);
  const previousActions = measuredActions.slice(4, 8);
  const recentConnection = average(recentInsights.map(entry => entry.connection));
  const previousConnection = average(previousInsights.map(entry => entry.connection));
  const recentTension = average(recentInsights.map(entry => entry.tension));
  const previousTension = average(previousInsights.map(entry => entry.tension));
  const recentActionScore = average(recentActions.map(action => (ACTION_STATUS_VALUES[action.status] ?? 0) * 100));
  const previousActionScore = average(previousActions.map(action => (ACTION_STATUS_VALUES[action.status] ?? 0) * 100));
  const trendDelta = roundMetric((recentConnection - previousConnection) * 12 + (previousTension - recentTension) * 10 + (recentActionScore - previousActionScore) * 0.2);
  const relevantActionsForAreas = measuredActions.filter(
    action => action.status === 'performed' || action.status === 'confirmed' || action.status === 'appreciated',
  );
  const { dominantArea, weakestArea } = getDominantAndWeakestArea(relevantActionsForAreas);
  const score = clampScore(
    actionReliability * 0.34
      + appreciationScore * 0.14
      + reflectionScore * 0.18
      + emotionalPresenceScore * 0.22
      + noteCareScore * 0.12,
  );
  const recommendations = buildCoachingRecommendations({
    score,
    actionReliability,
    appreciationScore,
    reflectionScore,
    noteCareScore,
    averageConnection,
    averageTension,
    sharedReflectionRatio,
    sharedInsightCount: measuredInsights.filter(entry => entry.visibility === 'shared').length,
    loveNoteCount: measuredNotes.length,
    weakestArea,
    dominantArea,
  });
  const componentScores: ScoreComponent[] = [
    {
      id: 'actions',
      label: 'Action reliability',
      score: roundMetric(actionReliability),
      summary: actionReliability >= 70 ? 'Follow-through is holding.' : 'Consistency needs more support.',
    },
    {
      id: 'appreciation',
      label: 'Appreciation loop',
      score: roundMetric(appreciationScore),
      summary: appreciationScore >= 65 ? 'Care is being noticed.' : 'Completed care needs more acknowledgment.',
    },
    {
      id: 'reflection',
      label: 'Reflection depth',
      score: roundMetric(reflectionScore),
      summary: reflectionScore >= 65 ? 'Check-ins are carrying substance.' : 'Reflections need more honesty or specificity.',
    },
    {
      id: 'presence',
      label: 'Emotional presence',
      score: roundMetric(emotionalPresenceScore),
      summary: emotionalPresenceScore >= 65 ? 'Recent entries feel more connected.' : 'Mood, connection, or tension signals are strained.',
    },
    {
      id: 'notes',
      label: 'Love Note care',
      score: roundMetric(noteCareScore),
      summary: noteCareScore >= 60 ? 'Warmth is staying in motion.' : 'Affection could be expressed more consistently.',
    },
  ];

  return {
    score: roundMetric(score),
    actionCoverage: roundMetric(actionCoverage),
    appreciationCoverage: roundMetric(appreciationCoverage),
    averageConnection: roundMetric(averageConnection),
    averageTension: roundMetric(averageTension),
    averageMood: roundMetric(averageMood),
    noteMomentum: roundMetric(noteMomentum),
    actionReliability: roundMetric(actionReliability),
    appreciationScore: roundMetric(appreciationScore),
    reflectionScore: roundMetric(reflectionScore),
    noteCareScore: roundMetric(noteCareScore),
    emotionalPresenceScore: roundMetric(emotionalPresenceScore),
    sharedReflectionRatio: roundMetric(sharedReflectionRatio),
    trendDelta,
    dominantArea,
    weakestArea,
    measuredActions,
    completedActions,
    appreciatedActions,
    measuredInsights,
    measuredNotes,
    componentScores,
    recommendations,
  };
}

export function buildPulseSummary(input: {
  entries: InsightEntry[];
  score: number;
  windowStart: number;
  trendDelta?: number;
}) : PulseSummary {
  const recentEntries = input.entries
    .filter(entry => entry.createdAt >= input.windowStart)
    .slice()
    .sort((left, right) => right.createdAt - left.createdAt);
  const averageMood = average(recentEntries.map(entry => entry.mood));
  const averageConnection = average(recentEntries.map(entry => entry.connection));
  const averageTension = average(recentEntries.map(entry => entry.tension));
  const trend: PulseTrend =
    (input.trendDelta ?? 0) > 4 ? 'rising' : (input.trendDelta ?? 0) < -4 ? 'dipping' : 'steady';
  const label: PulseLabel =
    averageConnection >= 4.2 && averageTension <= 2.1 && input.score >= 78
      ? 'deepening'
      : averageConnection >= 3.6 && averageTension <= 2.8 && input.score >= 64
        ? 'warming'
        : averageConnection >= 3 && averageTension <= 3.5 && input.score >= 48
          ? 'steady'
          : averageConnection >= 2.4 && averageTension <= 4.1
            ? 'fragile'
            : 'strained';
  const uniqueDays = Array.from(new Set(recentEntries.map(entry => toDayKey(entry.createdAt))));
  let streak = 0;
  const cursor = new Date();

  while (true) {
    const dayKey = cursor.toISOString().slice(0, 10);
    if (!uniqueDays.includes(dayKey)) {
      break;
    }
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return {
    label,
    trend,
    averageMood: roundMetric(averageMood),
    averageConnection: roundMetric(averageConnection),
    averageTension: roundMetric(averageTension),
    checkInStreakDays: streak,
    sharedReflectionCount: recentEntries.filter(entry => entry.visibility === 'shared').length,
    recentReflectionCount: recentEntries.length,
    scoreDelta: roundMetric(input.trendDelta ?? 0),
  };
}

export function buildAreaBalance(actions: LoveAction[], windowStart: number): AreaBalanceItem[] {
  const relevantActions = actions.filter(
    action => isMeasuredAction(action, windowStart) && (action.status === 'confirmed' || action.status === 'appreciated'),
  );

  if (relevantActions.length === 0) {
    return [];
  }

  const counts = relevantActions.reduce<Record<LoveArea, number>>((result, action) => {
    result[action.area] = (result[action.area] ?? 0) + (action.status === 'appreciated' ? 2 : 1);
    return result;
  }, {} as Record<LoveArea, number>);

  return Object.entries(counts)
    .map(([area, count]) => ({
      area: area as LoveArea,
      count,
      share: roundMetric((count / Object.values(counts).reduce((sum, value) => sum + value, 0)) * 100),
    }))
    .sort((left, right) => right.count - left.count);
}

export function buildHistoryFeed(input: {
  actions: LoveAction[];
  insights: InsightEntry[];
  notes: MirrorMessage[];
  windowStart: number;
}) : HistoryEvent[] {
  const noteEvents = input.notes
    .filter(note => note.createdAt >= input.windowStart)
    .map(note => ({
      id: `note-${note.id}`,
      kind: 'note' as const,
      title: note.text || 'Finger-drawn Love Note',
      body: `${note.tags.join(', ') || 'No tags'} · ${note.noteType}`,
      badge: 'Love Note',
      timestamp: note.createdAt,
    }));
  const insightEvents = input.insights
    .filter(entry => entry.createdAt >= input.windowStart)
    .map(entry => ({
      id: `insight-${entry.id}`,
      kind: 'insight' as const,
      title: entry.reflection || entry.appreciation || entry.need || 'Saved reflection',
      body: `Mood ${entry.mood}/5 · Connection ${entry.connection}/5 · Tension ${entry.tension}/5`,
      badge: entry.visibility === 'shared' ? 'Shared insight' : 'Reflection',
      timestamp: entry.createdAt,
    }));
  const actionEvents = input.actions
    .filter(action => isMeasuredAction(action, input.windowStart))
    .flatMap(action => {
      const events: HistoryEvent[] = [];

      if (action.lastCompletedAt && action.lastCompletedAt >= input.windowStart) {
        events.push({
          id: `action-done-${action.id}`,
          kind: 'actionCompleted',
          title: action.title,
          body: `Completed in ${action.area}`,
          badge: 'Done',
          timestamp: action.lastCompletedAt,
        });
      }

      if (action.status === 'appreciated' && action.updatedAt >= input.windowStart) {
        events.push({
          id: `action-appreciated-${action.id}`,
          kind: 'actionAppreciated',
          title: action.title,
          body: action.appreciationNote || 'This Love Action was appreciated.',
          badge: 'Appreciated',
          timestamp: action.updatedAt,
        });
      }

      return events;
    });

  return [...noteEvents, ...insightEvents, ...actionEvents]
    .sort((left, right) => right.timestamp - left.timestamp)
    .slice(0, 12);
}

export function buildMetricChartPoints(snapshots: RelationshipMetricSnapshot[], window: MetricsWindow) {
  return snapshots
    .filter(snapshot => snapshot.window === window)
    .slice()
    .sort((left, right) => left.capturedDate - right.capturedDate)
    .slice(-12)
    .map(snapshot => ({
      id: snapshot.id,
      label: formatChartLabel(snapshot.capturedDay),
      score: snapshot.score,
      connection: snapshot.averageConnection,
      tension: snapshot.averageTension,
      streak: snapshot.checkInStreakDays,
    }));
}

export function buildMetricSnapshot(input: {
  id: string;
  window: MetricsWindow;
  capturedDay: string;
  capturedDate: number;
  updatedAt: number;
  scoreBreakdown: ScoreBreakdown;
  pulseSummary: PulseSummary;
}) : RelationshipMetricSnapshot {
  return {
    id: input.id,
    window: input.window,
    capturedDay: input.capturedDay,
    capturedDate: input.capturedDate,
    updatedAt: input.updatedAt,
    score: input.scoreBreakdown.score,
    pulseLabel: input.pulseSummary.label,
    pulseTrend: input.pulseSummary.trend,
    averageMood: input.pulseSummary.averageMood,
    averageConnection: input.pulseSummary.averageConnection,
    averageTension: input.pulseSummary.averageTension,
    checkInStreakDays: input.pulseSummary.checkInStreakDays,
    sharedInsightCount: input.pulseSummary.sharedReflectionCount,
    loveNoteCount: input.scoreBreakdown.measuredNotes.length,
    completedActionCount: input.scoreBreakdown.completedActions.length,
    appreciatedActionCount: input.scoreBreakdown.appreciatedActions.length,
    actionReliability: input.scoreBreakdown.actionReliability,
    appreciationScore: input.scoreBreakdown.appreciationScore,
    reflectionScore: input.scoreBreakdown.reflectionScore,
    noteCareScore: input.scoreBreakdown.noteCareScore,
    emotionalPresenceScore: input.scoreBreakdown.emotionalPresenceScore,
    dominantArea: input.scoreBreakdown.dominantArea,
    weakestArea: input.scoreBreakdown.weakestArea,
    recommendationTitles: input.scoreBreakdown.recommendations.map(recommendation => recommendation.title),
  };
}
