import type { MirrorMessage } from '../store/useMirrorMessageStore';
import type { InsightEntry } from '../store/useInsightsStore';
import type { LoveAction } from '../store/useLoveActionStore';
import type { LoveArea } from '../store/useLoveProfileStore';

export type MetricsWindow = '7d' | '30d' | '90d';
export type PulseTrend = 'rising' | 'steady' | 'dipping';
export type PulseLabel = 'strained' | 'fragile' | 'steady' | 'warming' | 'deepening';
export type HistoryEventKind = 'note' | 'insight' | 'actionCompleted' | 'actionAppreciated';

export type ScoreBreakdown = {
  score: number;
  actionCoverage: number;
  appreciationCoverage: number;
  averageConnection: number;
  averageTension: number;
  noteMomentum: number;
  measuredActions: LoveAction[];
  completedActions: LoveAction[];
  appreciatedActions: LoveAction[];
  measuredInsights: InsightEntry[];
  measuredNotes: MirrorMessage[];
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

export function getMetricsWindowStart(window: MetricsWindow, now = Date.now()) {
  const days = window === '7d' ? 7 : window === '30d' ? 30 : 90;
  return now - days * 24 * 60 * 60 * 1000;
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

function getActionMeasurementTimestamp(action: LoveAction) {
  return action.lastCompletedAt ?? action.respondedAt ?? action.nextDueAt ?? action.updatedAt;
}

function isMeasuredAction(action: LoveAction, windowStart: number) {
  if (
    action.status !== 'scheduled'
    && action.status !== 'due'
    && action.status !== 'performed'
    && action.status !== 'confirmed'
    && action.status !== 'appreciated'
  ) {
    return false;
  }

  return getActionMeasurementTimestamp(action) >= windowStart;
}

function roundMetric(value: number) {
  return Math.round(value * 10) / 10;
}

function toDayKey(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

export function buildScoreBreakdown(input: {
  actions: LoveAction[];
  insights: InsightEntry[];
  notes: MirrorMessage[];
  windowStart: number;
}) : ScoreBreakdown {
  const measuredActions = input.actions.filter(action => isMeasuredAction(action, input.windowStart));
  const completedActions = measuredActions.filter(
    action => action.status === 'performed' || action.status === 'confirmed' || action.status === 'appreciated',
  );
  const appreciatedActions = measuredActions.filter(action => action.status === 'appreciated');
  const measuredInsights = input.insights.filter(entry => entry.createdAt >= input.windowStart);
  const measuredNotes = input.notes.filter(note => note.createdAt >= input.windowStart);
  const actionCoverage = measuredActions.length === 0 ? 0 : completedActions.length / measuredActions.length;
  const appreciationCoverage = measuredActions.length === 0 ? 0 : appreciatedActions.length / measuredActions.length;
  const averageConnection = average(measuredInsights.map(entry => entry.connection));
  const averageTension = average(measuredInsights.map(entry => entry.tension));
  const noteMomentum = Math.min(1, measuredNotes.length / 8);
  const connectionSignal = averageConnection > 0 ? averageConnection / 5 : 0;
  const tensionRelief = averageTension > 0 ? (6 - averageTension) / 5 : 0;
  const score = clampScore(
    actionCoverage * 45
      + appreciationCoverage * 20
      + connectionSignal * 20
      + tensionRelief * 10
      + noteMomentum * 5,
  );

  return {
    score: roundMetric(score),
    actionCoverage: roundMetric(actionCoverage * 100),
    appreciationCoverage: roundMetric(appreciationCoverage * 100),
    averageConnection: roundMetric(averageConnection),
    averageTension: roundMetric(averageTension),
    noteMomentum: roundMetric(noteMomentum * 100),
    measuredActions,
    completedActions,
    appreciatedActions,
    measuredInsights,
    measuredNotes,
  };
}

export function buildPulseSummary(input: {
  entries: InsightEntry[];
  score: number;
  windowStart: number;
}) : PulseSummary {
  const recentEntries = input.entries
    .filter(entry => entry.createdAt >= input.windowStart)
    .slice()
    .sort((left, right) => right.createdAt - left.createdAt);
  const averageMood = average(recentEntries.map(entry => entry.mood));
  const averageConnection = average(recentEntries.map(entry => entry.connection));
  const averageTension = average(recentEntries.map(entry => entry.tension));
  const recentThree = recentEntries.slice(0, 3);
  const previousThree = recentEntries.slice(3, 6);
  const recentConnection = average(recentThree.map(entry => entry.connection));
  const previousConnection = average(previousThree.map(entry => entry.connection));
  const recentTension = average(recentThree.map(entry => entry.tension));
  const previousTension = average(previousThree.map(entry => entry.tension));
  const trendDelta = recentConnection - previousConnection + (previousTension - recentTension) * 0.6;
  const trend: PulseTrend = trendDelta > 0.35 ? 'rising' : trendDelta < -0.35 ? 'dipping' : 'steady';
  const label: PulseLabel =
    averageConnection >= 4.3 && averageTension <= 2.1 && input.score >= 75
      ? 'deepening'
      : averageConnection >= 3.7 && averageTension <= 2.8 && input.score >= 60
        ? 'warming'
        : averageConnection >= 3 && averageTension <= 3.4
          ? 'steady'
          : averageConnection >= 2.3 && averageTension <= 4
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
    result[action.area] = (result[action.area] ?? 0) + 1;
    return result;
  }, {} as Record<LoveArea, number>);

  return Object.entries(counts)
    .map(([area, count]) => ({
      area: area as LoveArea,
      count,
      share: roundMetric((count / relevantActions.length) * 100),
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
