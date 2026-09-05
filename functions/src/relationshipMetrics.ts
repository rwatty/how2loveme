export type MetricsWindow = '7d' | '30d' | '90d';
export type PulseTrend = 'rising' | 'steady' | 'dipping';
export type PulseLabel = 'strained' | 'fragile' | 'steady' | 'warming' | 'deepening';
export type LoveArea =
  | 'emotional'
  | 'physicalIntimate'
  | 'communication'
  | 'financial'
  | 'spiritual'
  | 'mental'
  | 'social'
  | 'partnership';
export type LoveImportance = 'low' | 'medium' | 'high' | 'essential';
export type LoveActionStatus =
  | 'proposed'
  | 'scheduled'
  | 'due'
  | 'performed'
  | 'confirmed'
  | 'appreciated'
  | 'needsAttention'
  | 'cancelled';

export type LoveActionMetricRecord = {
  id: string;
  area: LoveArea;
  importance: LoveImportance;
  status: LoveActionStatus;
  updatedAt: number;
  nextDueAt: number | null;
  lastCompletedAt: number | null;
  respondedAt: number | null;
};

export type InsightMetricRecord = {
  id: string;
  mood: number;
  connection: number;
  tension: number;
  appreciation: string;
  need: string;
  reflection: string;
  nextStep: string;
  visibility: 'shared';
  createdAt: number;
};

export type LoveNoteMetricRecord = {
  id: string;
  noteType: 'warm' | 'playful' | 'reassuring' | 'grateful' | 'desire';
  tags: string[];
  createdAt: number;
};

export type RelationshipMetricSnapshotWrite = {
  window: MetricsWindow;
  capturedDay: string;
  capturedDate: Date;
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

const WINDOWS: MetricsWindow[] = ['7d', '30d', '90d'];
const WINDOW_DAYS: Record<MetricsWindow, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};
const AREAS: LoveArea[] = [
  'emotional',
  'physicalIntimate',
  'communication',
  'financial',
  'spiritual',
  'mental',
  'social',
  'partnership',
];
const STATUS_VALUES: Record<LoveActionStatus, number> = {
  proposed: 0,
  scheduled: 0.35,
  due: 0.18,
  performed: 0.72,
  confirmed: 0.9,
  appreciated: 1,
  needsAttention: 0.08,
  cancelled: 0,
};
const IMPORTANCE_WEIGHTS: Record<LoveImportance, number> = {
  low: 0.8,
  medium: 1,
  high: 1.15,
  essential: 1.3,
};

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

function getWindowStart(window: MetricsWindow, now: number) {
  return now - WINDOW_DAYS[window] * 24 * 60 * 60 * 1000;
}

function getActionTimestamp(action: LoveActionMetricRecord) {
  return action.lastCompletedAt ?? action.respondedAt ?? action.nextDueAt ?? action.updatedAt;
}

function getRecencyWeight(timestamp: number, windowStart: number, now: number) {
  const totalRange = Math.max(1, now - windowStart);
  const ageRatio = Math.max(0, Math.min(1, (timestamp - windowStart) / totalRange));
  return 0.55 + ageRatio * 0.45;
}

function getReflectionCompleteness(entry: InsightMetricRecord) {
  const writtenCount = [entry.appreciation, entry.need, entry.reflection, entry.nextStep].filter(value => value.trim()).length;
  return writtenCount / 4;
}

function getAreaExtremes(actions: LoveActionMetricRecord[]) {
  if (actions.length === 0) {
    return { dominantArea: null, weakestArea: null };
  }

  const counts = AREAS.reduce<Record<LoveArea, number>>((result, area) => {
    result[area] = 0;
    return result;
  }, {} as Record<LoveArea, number>);

  for (const action of actions) {
    counts[action.area] += action.status === 'appreciated' ? 2 : 1;
  }

  const dominantArea = Object.entries(counts).sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
  const untouchedArea = Object.entries(counts).find(([, count]) => count === 0)?.[0] ?? null;
  const weakestNonZero = Object.entries(counts)
    .filter(([, count]) => count > 0)
    .sort((left, right) => left[1] - right[1])[0]?.[0] ?? null;

  return {
    dominantArea: dominantArea as LoveArea | null,
    weakestArea: (untouchedArea ?? weakestNonZero) as LoveArea | null,
  };
}

function buildRecommendationTitles(input: {
  actionReliability: number;
  appreciationScore: number;
  noteCareScore: number;
  averageConnection: number;
  averageTension: number;
  sharedInsightCount: number;
  weakestArea: LoveArea | null;
}) {
  const titles: string[] = [];

  if (input.sharedInsightCount === 0) {
    titles.push('Bring one reflection into the shared space');
  }

  if (input.averageTension >= 3.6) {
    titles.push('Use a repair-oriented Love Note today');
  }

  if (input.actionReliability < 50) {
    titles.push(`Schedule one smaller, easier Love Action${input.weakestArea ? ` in ${input.weakestArea}` : ''}`);
  }

  if (input.appreciationScore < 45) {
    titles.push('Close the loop with appreciation');
  }

  if (input.noteCareScore < 45) {
    titles.push('Send a warm or grateful Love Note');
  }

  if (input.averageConnection <= 2.8) {
    titles.push('Rebuild closeness before asking for more');
  }

  return titles.slice(0, 3);
}

function buildWindowSnapshot(input: {
  window: MetricsWindow;
  actions: LoveActionMetricRecord[];
  insights: InsightMetricRecord[];
  notes: LoveNoteMetricRecord[];
  now: number;
  capturedDay: string;
}) : RelationshipMetricSnapshotWrite {
  const windowStart = getWindowStart(input.window, input.now);
  const measuredActions = input.actions.filter(action => getActionTimestamp(action) >= windowStart && action.status !== 'cancelled');
  const completedActions = measuredActions.filter(
    action => action.status === 'performed' || action.status === 'confirmed' || action.status === 'appreciated',
  );
  const appreciatedActions = measuredActions.filter(action => action.status === 'appreciated');
  const measuredInsights = input.insights.filter(entry => entry.createdAt >= windowStart).sort((a, b) => b.createdAt - a.createdAt);
  const measuredNotes = input.notes.filter(note => note.createdAt >= windowStart).sort((a, b) => b.createdAt - a.createdAt);
  const weightedActions = measuredActions.reduce(
    (result, action) => {
      const baseWeight = getRecencyWeight(getActionTimestamp(action), windowStart, input.now) * IMPORTANCE_WEIGHTS[action.importance];
      result.max += baseWeight;
      result.actual += baseWeight * STATUS_VALUES[action.status];
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
  const actionReliability = weightedActions.max === 0 ? 0 : (weightedActions.actual / weightedActions.max) * 100;
  const appreciationScore =
    weightedActions.appreciationMax === 0 ? 0 : (weightedActions.appreciationActual / weightedActions.appreciationMax) * 100;
  const reflectionCompleteness = average(measuredInsights.map(getReflectionCompleteness));
  const reflectionFrequencyScore = Math.min(1, measuredInsights.length / 6) * 100;
  const repairFollowThroughScore = average(
    measuredInsights.map(entry => (entry.nextStep.trim() ? 1 : 0.35) + (entry.need.trim() ? 0.25 : 0)),
  ) * 80;
  const reflectionScore = clampScore(reflectionCompleteness * 45 + reflectionFrequencyScore * 0.3 + repairFollowThroughScore * 0.25);
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
  const score = clampScore(
    actionReliability * 0.34
      + appreciationScore * 0.14
      + reflectionScore * 0.18
      + emotionalPresenceScore * 0.22
      + noteCareScore * 0.12,
  );
  const recentInsights = measuredInsights.slice(0, 3);
  const previousInsights = measuredInsights.slice(3, 6);
  const recentActions = measuredActions.slice(0, 4);
  const previousActions = measuredActions.slice(4, 8);
  const trendDelta =
    (average(recentInsights.map(entry => entry.connection)) - average(previousInsights.map(entry => entry.connection))) * 12
    + (average(previousInsights.map(entry => entry.tension)) - average(recentInsights.map(entry => entry.tension))) * 10
    + (average(recentActions.map(action => STATUS_VALUES[action.status] * 100))
      - average(previousActions.map(action => STATUS_VALUES[action.status] * 100)))
      * 0.2;
  const pulseTrend: PulseTrend = trendDelta > 4 ? 'rising' : trendDelta < -4 ? 'dipping' : 'steady';
  const pulseLabel: PulseLabel =
    averageConnection >= 4.2 && averageTension <= 2.1 && score >= 78
      ? 'deepening'
      : averageConnection >= 3.6 && averageTension <= 2.8 && score >= 64
        ? 'warming'
        : averageConnection >= 3 && averageTension <= 3.5 && score >= 48
          ? 'steady'
          : averageConnection >= 2.4 && averageTension <= 4.1
            ? 'fragile'
            : 'strained';
  const uniqueDays = Array.from(new Set(measuredInsights.map(entry => toDayKey(entry.createdAt))));
  let checkInStreakDays = 0;
  const cursor = new Date(input.now);

  while (true) {
    const dayKey = cursor.toISOString().slice(0, 10);
    if (!uniqueDays.includes(dayKey)) {
      break;
    }
    checkInStreakDays += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  const relevantAreaActions = measuredActions.filter(
    action => action.status === 'performed' || action.status === 'confirmed' || action.status === 'appreciated',
  );
  const { dominantArea, weakestArea } = getAreaExtremes(relevantAreaActions);

  return {
    window: input.window,
    capturedDay: input.capturedDay,
    capturedDate: new Date(`${input.capturedDay}T00:00:00.000Z`),
    score: roundMetric(score),
    pulseLabel,
    pulseTrend,
    averageMood: roundMetric(averageMood),
    averageConnection: roundMetric(averageConnection),
    averageTension: roundMetric(averageTension),
    checkInStreakDays,
    sharedInsightCount: measuredInsights.length,
    loveNoteCount: measuredNotes.length,
    completedActionCount: completedActions.length,
    appreciatedActionCount: appreciatedActions.length,
    actionReliability: roundMetric(actionReliability),
    appreciationScore: roundMetric(appreciationScore),
    reflectionScore: roundMetric(reflectionScore),
    noteCareScore: roundMetric(noteCareScore),
    emotionalPresenceScore: roundMetric(emotionalPresenceScore),
    dominantArea,
    weakestArea,
    recommendationTitles: buildRecommendationTitles({
      actionReliability,
      appreciationScore,
      noteCareScore,
      averageConnection,
      averageTension,
      sharedInsightCount: measuredInsights.length,
      weakestArea,
    }),
  };
}

export function buildRelationshipMetricSnapshots(input: {
  actions: LoveActionMetricRecord[];
  insights: InsightMetricRecord[];
  notes: LoveNoteMetricRecord[];
  now?: number;
}) {
  const now = input.now ?? Date.now();
  const capturedDay = toDayKey(now);

  return WINDOWS.map(window => ({
    id: `${window}-${capturedDay}`,
    data: buildWindowSnapshot({
      window,
      actions: input.actions,
      insights: input.insights,
      notes: input.notes,
      now,
      capturedDay,
    }),
  }));
}
