import type { LoveNoteType } from './loveNotes';
import {
  LOVE_AREA_LABELS,
  LOVE_LIBRARY_EFFORT_LABELS,
  LOVE_LIBRARY_GOAL_LABELS,
  LOVE_LIBRARY_ITEMS,
  type LoveLibraryEffort,
  type LoveLibraryGoal,
} from './loveLibrary';
import type { MirrorMessage } from '../store/useMirrorMessageStore';
import type { InsightEntry } from '../store/useInsightsStore';
import type { LoveAction } from '../store/useLoveActionStore';
import type { LoveArea, LovePreferenceImportance } from '../store/useLoveProfileStore';

export type MetricsWindow = '7d' | '30d' | '90d';
export type PulseTrend = 'rising' | 'steady' | 'dipping';
export type PulseLabel = 'strained' | 'fragile' | 'steady' | 'warming' | 'deepening';
export type HistoryEventKind = 'note' | 'insight' | 'actionCompleted' | 'actionAppreciated';
export type CoachingFocus = 'insights' | 'loveNotes' | 'loveActions';
export type ScoreChangeDirection = 'up' | 'down' | 'flat';

export type ScoreComponent = {
  id: string;
  label: string;
  score: number;
  summary: string;
};

export type CoachingActionSuggestion = {
  itemId: string;
  title: string;
  area: LoveArea;
  goal: LoveLibraryGoal;
  effort: LoveLibraryEffort;
};

export type CoachingRecommendation = {
  id: string;
  title: string;
  body: string;
  reason: string;
  signal: string;
  ctaLabel: string;
  focus: CoachingFocus;
  area: LoveArea | null;
  promptId: string | null;
  noteType: LoveNoteType | null;
  suggestedAction: CoachingActionSuggestion | null;
};

export type ScoreDriver = {
  id: string;
  label: string;
  valueDelta: number;
  scoreImpact: number;
  direction: ScoreChangeDirection;
  summary: string;
};

export type ScoreChangeSummary = {
  direction: ScoreChangeDirection;
  delta: number;
  headline: string;
  body: string;
  drivers: ScoreDriver[];
};

export type TrendInterpretation = {
  tone: 'growing' | 'steady' | 'caution';
  headline: string;
  body: string;
  supportPills: string[];
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

type WeightedMetricKey =
  | 'actionReliability'
  | 'appreciationScore'
  | 'reflectionScore'
  | 'emotionalPresenceScore'
  | 'noteCareScore';

type RecommendationCandidate = CoachingRecommendation & { priority: number };

type RecommendationSignalContext = {
  averageConnection: number;
  averageTension: number;
  score: number;
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
const EFFORT_RANK: Record<LoveLibraryEffort, number> = {
  tiny: 0,
  steady: 1,
  deep: 2,
};
const SCORE_COMPONENT_WEIGHTS: Record<WeightedMetricKey, number> = {
  actionReliability: 0.34,
  appreciationScore: 0.14,
  reflectionScore: 0.18,
  emotionalPresenceScore: 0.22,
  noteCareScore: 0.12,
};
const AREA_GOAL_PRIORITIES: Record<LoveArea, LoveLibraryGoal[]> = {
  emotional: ['reassure', 'reconnect', 'support'],
  physicalIntimate: ['intimacy', 'reconnect', 'play'],
  communication: ['support', 'reassure', 'teamwork'],
  financial: ['teamwork', 'support', 'reassure'],
  spiritual: ['reconnect', 'reassure', 'support'],
  mental: ['support', 'reassure', 'teamwork'],
  social: ['play', 'reconnect', 'support'],
  partnership: ['teamwork', 'support', 'reconnect'],
};
const SCORE_DRIVER_CONFIG: Array<{
  id: WeightedMetricKey;
  label: string;
  upSummary: string;
  downSummary: string;
  baselineUpSummary: string;
  baselineDownSummary: string;
}> = [
  {
    id: 'actionReliability',
    label: 'Action reliability',
    upSummary: 'Follow-through improved and lifted the score.',
    downSummary: 'Follow-through softened and pulled the score down.',
    baselineUpSummary: 'Follow-through is one of the strongest supports under the score right now.',
    baselineDownSummary: 'Follow-through is one of the clearest pressures on the score right now.',
  },
  {
    id: 'appreciationScore',
    label: 'Appreciation loop',
    upSummary: 'More acknowledgment is helping care feel mutual.',
    downSummary: 'Acknowledgment dropped, so care is landing with less reinforcement.',
    baselineUpSummary: 'Appreciation is doing real work to hold the score up right now.',
    baselineDownSummary: 'The score would strengthen if completed care was acknowledged more often.',
  },
  {
    id: 'reflectionScore',
    label: 'Reflection depth',
    upSummary: 'Recent check-ins became more specific and actionable.',
    downSummary: 'Recent check-ins became lighter or less specific.',
    baselineUpSummary: 'Your reflections are adding substance to the score right now.',
    baselineDownSummary: 'Shallower reflections are keeping the score from reading as clearly as it could.',
  },
  {
    id: 'emotionalPresenceScore',
    label: 'Emotional presence',
    upSummary: 'Mood, connection, and tension are pointing in a better direction.',
    downSummary: 'Mood, connection, or tension signals became more strained.',
    baselineUpSummary: 'Emotional presence is a major strength in the current score.',
    baselineDownSummary: 'Emotional presence is the main emotional drag on the score right now.',
  },
  {
    id: 'noteCareScore',
    label: 'Love Note care',
    upSummary: 'Recent notes added warmth, range, and specificity.',
    downSummary: 'Affection slowed down or became less varied.',
    baselineUpSummary: 'Recent notes are actively helping the score hold warmth.',
    baselineDownSummary: 'More intentional affection would noticeably help the score.',
  },
];

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

function getActionAreaCounts() {
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
  }, getActionAreaCounts());
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

function getPromptSuggestion(area: LoveArea | null, mode: 'repair' | 'reconnect' | 'warmth' | 'gratitude') {
  if (mode === 'repair') {
    if (area === 'communication' || area === 'partnership') {
      return { promptId: 'repair-open', noteType: 'reassuring' as LoveNoteType };
    }

    if (area === 'physicalIntimate' || area === 'social') {
      return { promptId: 'warm-return', noteType: 'warm' as LoveNoteType };
    }

    return { promptId: 'steady-reassurance', noteType: 'reassuring' as LoveNoteType };
  }

  if (mode === 'gratitude') {
    return { promptId: 'gratitude-drop', noteType: 'grateful' as LoveNoteType };
  }

  if (mode === 'warmth') {
    if (area === 'physicalIntimate') {
      return { promptId: 'slow-desire', noteType: 'desire' as LoveNoteType };
    }

    if (area === 'social') {
      return { promptId: 'playful-nudge', noteType: 'playful' as LoveNoteType };
    }

    if (area === 'emotional' || area === 'partnership') {
      return { promptId: 'gratitude-drop', noteType: 'grateful' as LoveNoteType };
    }

    return { promptId: 'warm-return', noteType: 'warm' as LoveNoteType };
  }

  if (area === 'physicalIntimate') {
    return { promptId: 'slow-desire', noteType: 'desire' as LoveNoteType };
  }

  if (area === 'social') {
    return { promptId: 'playful-nudge', noteType: 'playful' as LoveNoteType };
  }

  return { promptId: 'warm-return', noteType: 'warm' as LoveNoteType };
}

function buildActionSuggestion(
  area: LoveArea | null,
  options?: {
    preferredGoals?: LoveLibraryGoal[];
    preferLowEffort?: boolean;
  },
): CoachingActionSuggestion | null {
  if (!area) {
    return null;
  }

  const preferredGoals = options?.preferredGoals?.length ? options.preferredGoals : AREA_GOAL_PRIORITIES[area];
  const goalRank = new Map(preferredGoals.map((goal, index) => [goal, index]));
  const candidates = LOVE_LIBRARY_ITEMS.filter(item => item.area === area);

  if (candidates.length === 0) {
    return null;
  }

  const sortedCandidates = candidates
    .slice()
    .sort((left, right) => {
      const leftGoalRank = goalRank.get(left.goal) ?? preferredGoals.length + 1;
      const rightGoalRank = goalRank.get(right.goal) ?? preferredGoals.length + 1;
      const leftEffortRank = options?.preferLowEffort ? EFFORT_RANK[left.effort] : 0;
      const rightEffortRank = options?.preferLowEffort ? EFFORT_RANK[right.effort] : 0;

      return Number(Boolean(right.featured)) - Number(Boolean(left.featured))
        || leftGoalRank - rightGoalRank
        || leftEffortRank - rightEffortRank
        || left.title.localeCompare(right.title);
    });
  const chosen = sortedCandidates[0];

  return chosen
    ? {
        itemId: chosen.id,
        title: chosen.title,
        area: chosen.area,
        goal: chosen.goal,
        effort: chosen.effort,
      }
    : null;
}

function getScoreDirection(delta: number): ScoreChangeDirection {
  if (delta > 0.4) {
    return 'up';
  }

  if (delta < -0.4) {
    return 'down';
  }

  return 'flat';
}

function buildScoreDriverSummary(config: (typeof SCORE_DRIVER_CONFIG)[number], direction: ScoreChangeDirection, isBaseline: boolean) {
  if (direction === 'flat') {
    return isBaseline
      ? `${config.label} is relatively neutral in the current score.`
      : `${config.label} stayed fairly stable.`;
  }

  if (direction === 'up') {
    return isBaseline ? config.baselineUpSummary : config.upSummary;
  }

  return isBaseline ? config.baselineDownSummary : config.downSummary;
}

function getCurrentMetricSource(scoreBreakdown: ScoreBreakdown, latestSnapshot: RelationshipMetricSnapshot | null) {
  return {
    score: latestSnapshot?.score ?? scoreBreakdown.score,
    actionReliability: latestSnapshot?.actionReliability ?? scoreBreakdown.actionReliability,
    appreciationScore: latestSnapshot?.appreciationScore ?? scoreBreakdown.appreciationScore,
    reflectionScore: latestSnapshot?.reflectionScore ?? scoreBreakdown.reflectionScore,
    emotionalPresenceScore: latestSnapshot?.emotionalPresenceScore ?? scoreBreakdown.emotionalPresenceScore,
    noteCareScore: latestSnapshot?.noteCareScore ?? scoreBreakdown.noteCareScore,
    averageConnection: latestSnapshot?.averageConnection ?? scoreBreakdown.averageConnection,
    averageTension: latestSnapshot?.averageTension ?? scoreBreakdown.averageTension,
    checkInStreakDays: latestSnapshot?.checkInStreakDays ?? 0,
    pulseLabel: latestSnapshot?.pulseLabel ?? null,
    pulseTrend: latestSnapshot?.pulseTrend ?? null,
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
  completedActionCount: number;
  appreciatedActionCount: number;
  trendDelta: number;
  isConnected: boolean;
}) {
  const recommendations: RecommendationCandidate[] = [];
  const repairPrompt = getPromptSuggestion(input.weakestArea ?? input.dominantArea, 'repair');
  const warmthPrompt = getPromptSuggestion(input.weakestArea ?? input.dominantArea, 'warmth');
  const reconnectPrompt = getPromptSuggestion(input.weakestArea ?? input.dominantArea, 'reconnect');
  const appreciationPrompt = getPromptSuggestion(input.dominantArea ?? input.weakestArea, 'gratitude');

  if (input.isConnected && (input.sharedInsightCount === 0 || input.sharedReflectionRatio < 35)) {
    recommendations.push({
      id: 'share-reflection',
      priority: 92,
      title: 'Bring one reflection into the shared space',
      body: 'Your relationship score becomes more trustworthy when at least one honest check-in is visible to both of you.',
      reason:
        input.sharedInsightCount === 0
          ? 'No recent shared reflections are feeding the relationship signal yet.'
          : `Only ${Math.round(input.sharedReflectionRatio)}% of recent reflections are shared, so the system is reading more private feeling than shared reality.`,
      signal: 'Low shared visibility',
      ctaLabel: 'Share an insight',
      focus: 'insights',
      area: null,
      promptId: null,
      noteType: null,
      suggestedAction: null,
    });
  }

  if (input.averageTension >= 3.6) {
    recommendations.push({
      id: 'repair-note',
      priority: 100,
      title: 'Lead with repair before asking for more',
      body: `Tension is elevated right now${input.weakestArea ? `, especially around ${LOVE_AREA_LABELS[input.weakestArea].toLowerCase()} care` : ''}. A gentle repair opener is more likely to land than a bigger request.`,
      reason: `Average tension is ${roundMetric(input.averageTension)}/5, which is high enough that reassurance should come before novelty or pressure.`,
      signal: 'High tension',
      ctaLabel: 'Open Love Notes',
      focus: 'loveNotes',
      area: input.weakestArea,
      promptId: repairPrompt.promptId,
      noteType: repairPrompt.noteType,
      suggestedAction: null,
    });
  }

  if (input.averageConnection <= 2.8 && input.score < 60) {
    recommendations.push({
      id: 'rebuild-connection',
      priority: 96,
      title: 'Rebuild closeness before solving everything else',
      body: 'Connection is reading low. Start with one honest reflection and one soft bid for closeness instead of stacking more tasks or open loops.',
      reason: `Average connection is only ${roundMetric(input.averageConnection)}/5 while the overall score is still under ${Math.round(input.score)}.`,
      signal: 'Low connection',
      ctaLabel: 'Open Insights',
      focus: 'insights',
      area: input.weakestArea,
      promptId: null,
      noteType: null,
      suggestedAction: null,
    });
  }

  if (input.actionReliability < 50) {
    const suggestedAction = buildActionSuggestion(input.weakestArea, {
      preferredGoals: ['support', 'reconnect', 'reassure'],
      preferLowEffort: true,
    });

    recommendations.push({
      id: 'schedule-small-action',
      priority: 88,
      title: 'Choose one smaller, more winnable Love Action',
      body: suggestedAction
        ? `Follow-through looks inconsistent. Use ${suggestedAction.title.toLowerCase()} as the next small win so reliability can recover without adding more complexity.`
        : `Follow-through looks inconsistent. Pick one low-effort action${input.weakestArea ? ` in ${LOVE_AREA_LABELS[input.weakestArea].toLowerCase()}` : ''} so completion can recover before you add more complexity.`,
      reason: `Action reliability is at ${Math.round(input.actionReliability)}%, so the relationship signal trusts promises less than it could right now.`,
      signal: 'Low follow-through',
      ctaLabel: 'Plan an action',
      focus: 'loveActions',
      area: input.weakestArea,
      promptId: null,
      noteType: null,
      suggestedAction,
    });
  }

  if (input.appreciationScore < 45 && input.completedActionCount > 0) {
    recommendations.push({
      id: 'name-appreciation',
      priority: 84,
      title: 'Close the loop with appreciation',
      body: 'Completed care is showing up, but not much of it is being named afterward. A quick appreciation creates more emotional return than another task right now.',
      reason: `${input.completedActionCount} recent Love Actions were completed, but only ${input.appreciatedActionCount} reached full appreciation.`,
      signal: 'Low acknowledgment',
      ctaLabel: 'Appreciate an action',
      focus: 'loveActions',
      area: input.dominantArea,
      promptId: appreciationPrompt.promptId,
      noteType: appreciationPrompt.noteType,
      suggestedAction: buildActionSuggestion(input.dominantArea, {
        preferredGoals: ['reassure', 'support', 'teamwork'],
        preferLowEffort: true,
      }),
    });
  }

  if (input.noteCareScore < 45 || input.loveNoteCount === 0) {
    recommendations.push({
      id: 'warm-note',
      priority: 78,
      title: 'Use a more targeted Love Note',
      body: `Your recent note momentum is light${input.weakestArea ? ` around ${LOVE_AREA_LABELS[input.weakestArea].toLowerCase()} care` : ''}. A short note tuned to the weak area can add warmth faster than waiting for a longer check-in.`,
      reason:
        input.loveNoteCount === 0
          ? 'No recent Love Notes are reinforcing warmth or reassurance.'
          : `Love Note care is at ${Math.round(input.noteCareScore)}%, so affection is present but not very consistent or specific.`,
      signal: 'Low note warmth',
      ctaLabel: 'Send a Love Note',
      focus: 'loveNotes',
      area: input.weakestArea ?? input.dominantArea,
      promptId: input.averageTension >= 3.2 ? repairPrompt.promptId : warmthPrompt.promptId,
      noteType: input.averageTension >= 3.2 ? repairPrompt.noteType : warmthPrompt.noteType,
      suggestedAction: null,
    });
  }

  if (
    input.weakestArea
    && input.actionReliability >= 50
    && input.averageTension < 3.6
    && input.score >= 58
  ) {
    const suggestedAction = buildActionSuggestion(input.weakestArea, {
      preferredGoals: AREA_GOAL_PRIORITIES[input.weakestArea],
      preferLowEffort: true,
    });

    recommendations.push({
      id: 'feed-weak-area',
      priority: 66,
      title: `Feed ${LOVE_AREA_LABELS[input.weakestArea].toLowerCase()} on purpose`,
      body: suggestedAction
        ? `${LOVE_AREA_LABELS[input.weakestArea]} is the least-supported area in your recent history. ${suggestedAction.title} would add care where the rhythm is thinnest.`
        : `${LOVE_AREA_LABELS[input.weakestArea]} is the least-supported area in your recent history. A small, intentional action there would make the signal more balanced.`,
      reason: input.dominantArea
        ? `${LOVE_AREA_LABELS[input.dominantArea]} is carrying more of the recent relationship energy, so the score is starting to look one-dimensional.`
        : 'Recent care is landing unevenly across relationship areas.',
      signal: 'Weak area gap',
      ctaLabel: 'Open Love',
      focus: 'loveActions',
      area: input.weakestArea,
      promptId: null,
      noteType: null,
      suggestedAction,
    });
  }

  if (recommendations.length === 0 && input.score >= 72) {
    recommendations.push({
      id: 'protect-strength',
      priority: 50,
      title: 'Protect what is already working',
      body: 'The current rhythm looks healthy. Repeat the rituals that are already landing well before the score has a reason to drift.',
      reason: input.trendDelta >= 0
        ? 'Recent signals are stable or improving, so consistency matters more than reinvention.'
        : 'The score is still strong, but a little maintenance now prevents avoidable slippage.',
      signal: 'Protect momentum',
      ctaLabel: 'Open Love',
      focus: 'loveActions',
      area: input.dominantArea,
      promptId: reconnectPrompt.promptId,
      noteType: reconnectPrompt.noteType,
      suggestedAction: buildActionSuggestion(input.dominantArea, {
        preferredGoals: ['reconnect', 'reassure', 'play'],
        preferLowEffort: true,
      }),
    });
  }

  return recommendations
    .sort((left, right) => right.priority - left.priority)
    .slice(0, 3)
    .map(({ priority, ...recommendation }) => recommendation);
}

function buildScoreComponentSummary(metric: WeightedMetricKey, score: number) {
  if (metric === 'actionReliability') {
    return score >= 72 ? 'Follow-through is holding.' : score >= 55 ? 'Consistency is present but uneven.' : 'Consistency needs more support.';
  }

  if (metric === 'appreciationScore') {
    return score >= 65 ? 'Care is being noticed.' : score >= 45 ? 'Some care is landing, but more acknowledgment would help.' : 'Completed care needs more acknowledgment.';
  }

  if (metric === 'reflectionScore') {
    return score >= 68 ? 'Check-ins are carrying substance.' : score >= 50 ? 'Reflections are helpful but could be more specific.' : 'Reflections need more honesty or specificity.';
  }

  if (metric === 'emotionalPresenceScore') {
    return score >= 68 ? 'Recent entries feel connected and grounded.' : score >= 50 ? 'The emotional signal is mixed but workable.' : 'Mood, connection, or tension signals are strained.';
  }

  return score >= 60 ? 'Warmth is staying in motion.' : score >= 42 ? 'Affection is present but not very consistent.' : 'Affection could be expressed more consistently.';
}

export function buildScoreBreakdown(input: {
  actions: LoveAction[];
  insights: InsightEntry[];
  notes: MirrorMessage[];
  windowStart: number;
  now?: number;
  isConnected?: boolean;
}): ScoreBreakdown {
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
    actionReliability * SCORE_COMPONENT_WEIGHTS.actionReliability
      + appreciationScore * SCORE_COMPONENT_WEIGHTS.appreciationScore
      + reflectionScore * SCORE_COMPONENT_WEIGHTS.reflectionScore
      + emotionalPresenceScore * SCORE_COMPONENT_WEIGHTS.emotionalPresenceScore
      + noteCareScore * SCORE_COMPONENT_WEIGHTS.noteCareScore,
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
    completedActionCount: completedActions.length,
    appreciatedActionCount: appreciatedActions.length,
    trendDelta,
    isConnected: input.isConnected ?? true,
  });
  const componentScores: ScoreComponent[] = [
    {
      id: 'actions',
      label: 'Action reliability',
      score: roundMetric(actionReliability),
      summary: buildScoreComponentSummary('actionReliability', actionReliability),
    },
    {
      id: 'appreciation',
      label: 'Appreciation loop',
      score: roundMetric(appreciationScore),
      summary: buildScoreComponentSummary('appreciationScore', appreciationScore),
    },
    {
      id: 'reflection',
      label: 'Reflection depth',
      score: roundMetric(reflectionScore),
      summary: buildScoreComponentSummary('reflectionScore', reflectionScore),
    },
    {
      id: 'presence',
      label: 'Emotional presence',
      score: roundMetric(emotionalPresenceScore),
      summary: buildScoreComponentSummary('emotionalPresenceScore', emotionalPresenceScore),
    },
    {
      id: 'notes',
      label: 'Love Note care',
      score: roundMetric(noteCareScore),
      summary: buildScoreComponentSummary('noteCareScore', noteCareScore),
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
  now?: number;
}): PulseSummary {
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
  const cursor = new Date(input.now ?? Date.now());

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

export function buildTrendInterpretation(input: {
  window: MetricsWindow;
  pulseSummary: PulseSummary;
  scoreBreakdown: ScoreBreakdown;
  latestSnapshot: RelationshipMetricSnapshot | null;
  previousSnapshot: RelationshipMetricSnapshot | null;
}): TrendInterpretation {
  const current = getCurrentMetricSource(input.scoreBreakdown, input.latestSnapshot);
  const previous = input.previousSnapshot
    ? {
        score: input.previousSnapshot.score,
        actionReliability: input.previousSnapshot.actionReliability,
        averageConnection: input.previousSnapshot.averageConnection,
        averageTension: input.previousSnapshot.averageTension,
      }
    : null;
  const scoreDelta = previous ? roundMetric(current.score - previous.score) : roundMetric(input.scoreBreakdown.trendDelta / 5);
  const connectionDelta = previous ? roundMetric(current.averageConnection - previous.averageConnection) : 0;
  const tensionDelta = previous ? roundMetric(current.averageTension - previous.averageTension) : 0;
  const actionDelta = previous ? roundMetric(current.actionReliability - previous.actionReliability) : 0;
  const supportPills = previous
    ? [
        `Score ${scoreDelta > 0 ? '+' : ''}${scoreDelta}`,
        `Connection ${connectionDelta > 0 ? '+' : ''}${connectionDelta}`,
        `Tension ${tensionDelta > 0 ? '+' : ''}${tensionDelta}`,
        `Follow-through ${actionDelta > 0 ? '+' : ''}${Math.round(actionDelta)}%`,
        `Streak ${current.checkInStreakDays}d`,
      ]
    : [
        `Connection ${roundMetric(current.averageConnection)}/5`,
        `Tension ${roundMetric(current.averageTension)}/5`,
        `Streak ${current.checkInStreakDays}d`,
        `${input.window.toUpperCase()} window`,
      ];

  if (input.pulseSummary.trend === 'rising') {
    if (tensionDelta <= -0.2 && connectionDelta >= 0.1) {
      return {
        tone: 'growing',
        headline: 'Connection is warming while tension is easing.',
        body: 'Recent check-ins suggest both more closeness and less strain, which is the healthiest combination for forward momentum.',
        supportPills,
      };
    }

    if (actionDelta >= 4) {
      return {
        tone: 'growing',
        headline: 'Follow-through is helping the pulse recover.',
        body: 'Promises are being completed more reliably, which usually gives both connection and trust a chance to rebound.',
        supportPills,
      };
    }

    return {
      tone: 'growing',
      headline: 'The relationship pulse is moving in a better direction.',
      body: 'Something recent is landing more gently than before. Protect the rhythm that is working instead of changing too much at once.',
      supportPills,
    };
  }

  if (input.pulseSummary.trend === 'dipping') {
    if (tensionDelta >= 0.2) {
      return {
        tone: 'caution',
        headline: 'Tension is outrunning repair right now.',
        body: 'Recent signals show more strain than soothing, so repair and reassurance are likely to help more than adding new asks.',
        supportPills,
      };
    }

    if (connectionDelta <= -0.2) {
      return {
        tone: 'caution',
        headline: 'Connection has softened across recent check-ins.',
        body: 'The emotional bond still matters here, but it is not feeling reinforced often enough in the latest window.',
        supportPills,
      };
    }

    if (actionDelta <= -4) {
      return {
        tone: 'caution',
        headline: 'Follow-through dipped and the pulse noticed.',
        body: 'The relationship system is reacting to lower consistency. Smaller, more reliable actions are the quickest way to recover trust.',
        supportPills,
      };
    }

    return {
      tone: 'caution',
      headline: 'The pulse is under pressure right now.',
      body: 'Recent signals are weaker than the prior stretch. Try reducing friction before you try to force more closeness.',
      supportPills,
    };
  }

  if (current.score >= 74 && current.checkInStreakDays >= 3) {
    return {
      tone: 'steady',
      headline: 'Your rhythm looks stable and intentional.',
      body: 'The score is not just surviving on one good moment. Repeated check-ins and decent follow-through are making the relationship signal more trustworthy.',
      supportPills,
    };
  }

  if (input.pulseSummary.label === 'fragile' || input.pulseSummary.label === 'strained') {
    return {
      tone: 'caution',
      headline: 'The pulse is steady, but not yet relaxed.',
      body: 'The trend is no longer slipping fast, but the underlying tension or low connection still needs direct attention.',
      supportPills,
    };
  }

  return {
    tone: 'steady',
    headline: 'The pulse is steady right now.',
    body: 'The relationship signal is fairly even in this window. Keep reinforcing what works before trying to optimize everything else.',
    supportPills,
  };
}

export function buildScoreChangeSummary(input: {
  scoreBreakdown: ScoreBreakdown;
  latestSnapshot: RelationshipMetricSnapshot | null;
  previousSnapshot: RelationshipMetricSnapshot | null;
}): ScoreChangeSummary {
  const current = getCurrentMetricSource(input.scoreBreakdown, input.latestSnapshot);
  const hasPreviousSnapshot = !!input.previousSnapshot;
  const previous = input.previousSnapshot
    ? {
        actionReliability: input.previousSnapshot.actionReliability,
        appreciationScore: input.previousSnapshot.appreciationScore,
        reflectionScore: input.previousSnapshot.reflectionScore,
        emotionalPresenceScore: input.previousSnapshot.emotionalPresenceScore,
        noteCareScore: input.previousSnapshot.noteCareScore,
        score: input.previousSnapshot.score,
      }
    : null;
  const drivers = SCORE_DRIVER_CONFIG.map(config => {
    const currentValue = current[config.id];
    const rawDelta = previous ? currentValue - previous[config.id] : currentValue - 60;
    const scoreImpact = rawDelta * SCORE_COMPONENT_WEIGHTS[config.id];
    const direction = getScoreDirection(scoreImpact);

    return {
      id: config.id,
      label: config.label,
      valueDelta: roundMetric(rawDelta),
      scoreImpact: roundMetric(scoreImpact),
      direction,
      summary: buildScoreDriverSummary(config, direction, !hasPreviousSnapshot),
    } satisfies ScoreDriver;
  }).sort((left, right) => Math.abs(right.scoreImpact) - Math.abs(left.scoreImpact));
  const positiveDrivers = drivers.filter(driver => driver.direction === 'up').sort((left, right) => right.scoreImpact - left.scoreImpact);
  const negativeDrivers = drivers.filter(driver => driver.direction === 'down').sort((left, right) => left.scoreImpact - right.scoreImpact);
  const topLift = positiveDrivers[0] ?? null;
  const topDrag = negativeDrivers[0] ?? null;
  const delta = previous ? roundMetric(current.score - previous.score) : 0;
  const direction = previous ? getScoreDirection(delta) : 'flat';

  if (!previous) {
    return {
      direction,
      delta,
      headline: 'What is shaping the current score',
      body: topLift && topDrag
        ? `${topLift.label} is doing the most to hold the score up right now, while ${topDrag.label.toLowerCase()} is the clearest pressure point.`
        : topLift
          ? `${topLift.label} is carrying the current score more than the other signals.`
          : 'There is not enough history yet to explain movement, but the current component mix is already visible below.',
      drivers: drivers.slice(0, 4),
    };
  }

  if (direction === 'up') {
    return {
      direction,
      delta,
      headline: `Score up ${Math.abs(delta)} points`,
      body: topLift && topDrag
        ? `The biggest lift came from ${topLift.label.toLowerCase()}. ${topDrag.label} softened a bit, but not enough to cancel the gains.`
        : topLift
          ? `The biggest lift came from ${topLift.label.toLowerCase()}.`
          : 'The score improved, but the movement was spread across several smaller signals.',
      drivers: drivers.slice(0, 4),
    };
  }

  if (direction === 'down') {
    return {
      direction,
      delta,
      headline: `Score down ${Math.abs(delta)} points`,
      body: topDrag && topLift
        ? `${topDrag.label} was the main drag on the score. ${topLift.label} helped buffer the drop, but not enough to fully offset it.`
        : topDrag
          ? `${topDrag.label} was the main drag on the score.`
          : 'The score slipped, but the pressure was spread across several smaller signals.',
      drivers: drivers.slice(0, 4),
    };
  }

  return {
    direction,
    delta,
    headline: 'Score is holding fairly steady',
    body: topLift && topDrag
      ? `${topLift.label} improved, while ${topDrag.label.toLowerCase()} softened, so the overall score barely moved.`
      : 'The current score is mostly stable relative to the prior snapshot.',
    drivers: drivers.slice(0, 4),
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
}): HistoryEvent[] {
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

export function buildLiveMetricChartPoints(input: {
  actions: LoveAction[];
  insights: InsightEntry[];
  notes: MirrorMessage[];
  window: MetricsWindow;
  now?: number;
  isConnected?: boolean;
}) {
  const now = input.now ?? Date.now();
  const windowStart = getMetricsWindowStart(input.window, now);
  const dayKeys = new Set<string>();

  input.insights
    .filter(entry => entry.createdAt >= windowStart && entry.createdAt <= now)
    .forEach(entry => dayKeys.add(toDayKey(entry.createdAt)));
  input.notes
    .filter(note => note.createdAt >= windowStart && note.createdAt <= now)
    .forEach(note => dayKeys.add(toDayKey(note.createdAt)));
  input.actions
    .filter(action => {
      const timestamp = getActionMeasurementTimestamp(action);
      return timestamp >= windowStart && timestamp <= now && action.status !== 'cancelled';
    })
    .forEach(action => dayKeys.add(toDayKey(getActionMeasurementTimestamp(action))));

  return Array.from(dayKeys)
    .sort()
    .slice(-12)
    .map(dayKey => {
      const [year, month, day] = dayKey.split('-').map(Number);
      const dayEnd = new Date(year, (month || 1) - 1, day || 1, 23, 59, 59, 999).getTime();
      const rollingWindowStart = getMetricsWindowStart(input.window, dayEnd);
      const scoreBreakdown = buildScoreBreakdown({
        actions: input.actions.filter(action => getActionMeasurementTimestamp(action) <= dayEnd),
        insights: input.insights.filter(entry => entry.createdAt <= dayEnd),
        notes: input.notes.filter(note => note.createdAt <= dayEnd),
        windowStart: rollingWindowStart,
        now: dayEnd,
        isConnected: input.isConnected,
      });
      const pulseSummary = buildPulseSummary({
        entries: input.insights.filter(entry => entry.createdAt <= dayEnd),
        score: scoreBreakdown.score,
        windowStart: rollingWindowStart,
        trendDelta: scoreBreakdown.trendDelta,
        now: dayEnd,
      });

      return {
        id: `live-${dayKey}`,
        label: formatChartLabel(dayKey),
        score: scoreBreakdown.score,
        connection: pulseSummary.averageConnection,
        tension: pulseSummary.averageTension,
        streak: pulseSummary.checkInStreakDays,
      };
    });
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
}): RelationshipMetricSnapshot {
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

export function getCoachingSuggestionLabel(suggestion: CoachingActionSuggestion | null) {
  if (!suggestion) {
    return null;
  }

  return `${suggestion.title} · ${LOVE_LIBRARY_GOAL_LABELS[suggestion.goal]} · ${LOVE_LIBRARY_EFFORT_LABELS[suggestion.effort]}`;
}
