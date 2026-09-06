import React, { useEffect, useMemo, useRef, useState } from 'react';
import { type LayoutChangeEvent, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAuth } from '@react-native-firebase/auth';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons/static';
import JumpToSectionFab, { type JumpSection } from '../components/JumpToSectionFab';
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
  buildAreaBalance,
  buildHistoryFeed,
  buildLiveMetricChartPoints,
  buildMetricChartPoints,
  buildPulseSummary,
  buildScoreBreakdown,
  buildScoreChangeSummary,
  buildTrendInterpretation,
  getCoachingSuggestionLabel,
  getMetricsWindowStart,
  type CoachingRecommendation,
  type MetricsWindow,
  type PulseLabel,
  type PulseTrend,
} from '../lib/relationshipMetrics';
import {
  deleteInsightEntry,
  saveInsightEntry,
  shareInsightEntry,
  updateInsightEntry,
} from '../lib/relationshipSync';
import { LOVE_AREA_LABELS } from '../lib/loveLibrary';
import { LOVE_NOTE_PROMPTS, LOVE_NOTE_TYPE_LABELS } from '../lib/loveNotes';
import type { MainTabParamList } from '../navigation/MainNavigator';
import {
  useInsightsStore,
  type InsightEntry,
  type InsightVisibility,
} from '../store/useInsightsStore';
import { useLoveActionStore } from '../store/useLoveActionStore';
import { useMirrorMessageStore } from '../store/useMirrorMessageStore';
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

function getPulseLabelCopy(label: PulseLabel) {
  switch (label) {
    case 'deepening':
      return 'You have meaningful follow-through, lower tension, and stronger recent connection.';
    case 'warming':
      return 'Things are trending gentler and more connected, even if they are not effortless yet.';
    case 'steady':
      return 'The relationship pulse looks stable right now, with room to keep building warmth.';
    case 'fragile':
      return 'Connection is still present, but the pulse looks vulnerable and could use care soon.';
    default:
      return 'Recent signals show strain or low follow-through. Slow repair and steady check-ins matter most here.';
  }
}

function getPulseTrendLabel(trend: PulseTrend) {
  switch (trend) {
    case 'rising':
      return 'Rising';
    case 'dipping':
      return 'Dipping';
    default:
      return 'Steady';
  }
}

function getRecommendationFocusLabel(focus: CoachingRecommendation['focus']) {
  switch (focus) {
    case 'loveActions':
      return 'Love Action';
    case 'loveNotes':
      return 'Love Note';
    default:
      return 'Insight';
  }
}

function getSectionIconName(section: 'pulse' | 'score' | 'trends' | 'coaching' | 'history' | 'checkin' | 'saved') {
  switch (section) {
    case 'pulse':
      return 'heart-pulse';
    case 'score':
      return 'chart-line';
    case 'trends':
      return 'chart-timeline-variant';
    case 'coaching':
      return 'lightbulb-on-outline';
    case 'history':
      return 'history';
    case 'checkin':
      return 'notebook-check-outline';
    default:
      return 'content-save-outline';
  }
}

function getVisibilityBadgeIconName(visibility: InsightVisibility) {
  switch (visibility) {
    case 'private':
      return 'lock-outline';
    case 'decideLater':
      return 'clock-outline';
    default:
      return 'account-group-outline';
  }
}

function getPulseTrendIconName(trend: PulseTrend) {
  switch (trend) {
    case 'rising':
      return 'trending-up';
    case 'dipping':
      return 'trending-down';
    default:
      return 'trending-neutral';
  }
}

function getRecommendationFocusIconName(focus: CoachingRecommendation['focus']) {
  switch (focus) {
    case 'loveActions':
      return 'checkbox-marked-circle-outline';
    case 'loveNotes':
      return 'card-text-outline';
    default:
      return 'notebook-outline';
  }
}

function getHistoryBadgeIconName(badge: string) {
  switch (badge) {
    case 'Love Note':
      return 'heart-outline';
    case 'Shared insight':
      return 'account-group-outline';
    case 'Reflection':
      return 'notebook-outline';
    case 'Done':
      return 'check-circle-outline';
    case 'Appreciated':
      return 'hand-heart-outline';
    default:
      return 'tag-outline';
  }
}

function StatusPill({
  icon,
  label,
  style,
  textStyle,
}: {
  icon: string;
  label: string;
  style?: any;
  textStyle?: any;
}) {
  return (
    <View style={[styles.iconPill, style]}>
      <MaterialDesignIcons name={icon as any} size={14} color="#6B4A55" />
      <Text style={[styles.iconPillText, textStyle]}>{label}</Text>
    </View>
  );
}

function MetricPill({
  icon,
  label,
  wide,
}: {
  icon: string;
  label: string;
  wide?: boolean;
}) {
  return <StatusPill icon={icon} label={label} style={wide ? styles.metricPillWide : styles.metricPill} textStyle={styles.metricLabel} />;
}

function SectionHeading({
  section,
  title,
  meta,
}: {
  section: 'pulse' | 'score' | 'trends' | 'coaching' | 'history' | 'checkin' | 'saved';
  title: string;
  meta?: string;
}) {
  return (
    <View style={styles.sectionHeaderRow}>
      <View style={styles.sectionIconWrap}>
        <MaterialDesignIcons name={getSectionIconName(section) as any} size={18} color="#B25B63" />
      </View>
      <View style={styles.sectionHeaderCopy}>
        <Text variant="titleMedium" style={styles.cardTitle}>
          {title}
        </Text>
        {meta ? <Text style={styles.sectionMeta}>{meta}</Text> : null}
      </View>
    </View>
  );
}

function formatSignedValue(value: number, suffix = '') {
  const rounded = Math.round(value * 10) / 10;

  if (rounded > 0) {
    return `+${rounded}${suffix}`;
  }

  if (rounded < 0) {
    return `${rounded}${suffix}`;
  }

  return `0${suffix}`;
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

function getWindowLabel(window: MetricsWindow) {
  switch (window) {
    case '7d':
      return '7-day';
    case '30d':
      return '30-day';
    default:
      return '90-day';
  }
}

type TrendPoint = {
  id: string;
  label: string;
  score: number;
  connection: number;
  tension: number;
  streak: number;
};

const SPARKLINE_WIDTH = 120;
const SPARKLINE_HEIGHT = 44;
const SPARKLINE_FRAME_VERTICAL_PADDING = 6;
const SPARKLINE_SPARSE_THRESHOLD = 4;
const MAX_SPARKLINE_BARS = 7;
const SCORE_CHART_HEIGHT = 112;

function getBarHeights(values: number[], maxValue: number, minimumRatio = 0.18) {
  const safeMax = Math.max(maxValue, 1);
  return values.map(value => {
    if (!Number.isFinite(value) || value <= 0) {
      return minimumRatio;
    }

    return Math.max(minimumRatio, Math.min(1, value / safeMax));
  });
}

function shouldShowChartLabel(index: number, total: number) {
  return index === 0 || index === total - 1 || index % 2 === 0;
}

function TrendSparkline({
  points,
  metric,
  color,
  showAnchors = false,
}: {
  points: TrendPoint[];
  metric: 'score' | 'streak';
  color: string;
  showAnchors?: boolean;
}) {
  if (points.length === 0) {
    return <View style={styles.sparklinePlaceholder} />;
  }

  const visiblePoints = points.slice(-MAX_SPARKLINE_BARS);
  const values = visiblePoints.map(point => (metric === 'score' ? point.score : point.streak));
  const heights = getBarHeights(values, Math.max(...values, 1), showAnchors ? 0.18 : 0.24);
  const isSparse = showAnchors && visiblePoints.length < SPARKLINE_SPARSE_THRESHOLD;
  const plotHeight = showAnchors
    ? SPARKLINE_HEIGHT - SPARKLINE_FRAME_VERTICAL_PADDING * 2
    : SPARKLINE_HEIGHT;

  return (
    <View style={styles.sparklineWrap}>
      <View style={[styles.sparklineRow, showAnchors ? styles.sparklineRowAnchored : null]}>
        {visiblePoints.map((point, index) => {
          const isLatest = index === visiblePoints.length - 1;

          return (
            <View key={`${metric}-spark-${point.id}`} style={styles.sparklineBarSlot}>
              <View
                style={[
                  styles.sparklineBar,
                  showAnchors ? styles.sparklineBarThin : null,
                  {
                    backgroundColor: color,
                    height: Math.max(10, Math.round(plotHeight * heights[index]!)),
                    opacity: isLatest ? 1 : 0.28 + heights[index]! * 0.48,
                  },
                ]}
              />
            </View>
          );
        })}
      </View>
      {showAnchors ? (
        <>
          <View style={styles.sparklineAnchorRow}>
            <Text style={styles.sparklineAnchorLabel}>Older</Text>
            <Text style={styles.sparklineAnchorLabel}>Now</Text>
          </View>
          {isSparse ? <Text style={styles.sparklineCaption}>Trend just starting</Text> : null}
        </>
      ) : null}
    </View>
  );
}

function InsightsTopSummaryCard({
  score,
  delta,
  pulseLabel,
  pulseTrend,
  streak,
  weakestArea,
  connected,
  chartPoints,
  privateCount,
  laterCount,
  sharedCount,
}: {
  score: number;
  delta: number;
  pulseLabel: PulseLabel;
  pulseTrend: PulseTrend;
  streak: number;
  weakestArea: string | null;
  connected: boolean;
  chartPoints: TrendPoint[];
  privateCount: number;
  laterCount: number;
  sharedCount: number;
}) {
  return (
    <Surface style={styles.topSummaryCard} elevation={0}>
      <View style={styles.topSummaryHeader}>
        <View style={styles.topSummaryPrimary}>
          <Text style={styles.topSummaryEyebrow}>{connected ? 'Relationship pulse' : 'Personal pulse'}</Text>
          <Text style={styles.topSummaryScore}>{Math.round(score)}</Text>
          <Text style={styles.topSummaryScoreMeta}>{connected ? 'Connection Score' : 'Care Score'}</Text>
          <View style={styles.summaryRow}>
            <StatusPill
              icon={getPulseTrendIconName(pulseTrend)}
              label={formatSignedValue(delta, ' pts')}
              style={[styles.summaryPill, delta > 0 ? styles.summaryPillPositive : delta < 0 ? styles.summaryPillNegative : null]}
              textStyle={styles.summaryLabel}
            />
            <StatusPill icon="heart-pulse" label={pulseLabel} style={styles.summaryPill} textStyle={styles.summaryLabel} />
            <StatusPill
              icon={getPulseTrendIconName(pulseTrend)}
              label={getPulseTrendLabel(pulseTrend)}
              style={styles.summaryPill}
              textStyle={styles.summaryLabel}
            />
          </View>
        </View>
        <View style={styles.topSummarySparkWrap}>
          <Text style={styles.sparklineMeta}>Recent score</Text>
          <TrendSparkline points={chartPoints} metric="score" color="#B25B63" showAnchors />
        </View>
      </View>
      <View style={styles.topSummaryGrid}>
        <Surface style={styles.topSummaryStatCard} elevation={0}>
          <Text style={styles.topSummaryStatValue}>{streak}d</Text>
          <Text style={styles.topSummaryStatLabel}>Streak</Text>
        </Surface>
        <Surface style={styles.topSummaryStatCard} elevation={0}>
          <Text style={styles.topSummaryStatValue}>{connected ? 'Shared' : 'Solo'}</Text>
          <Text style={styles.topSummaryStatLabel}>Mode</Text>
        </Surface>
        <Surface style={styles.topSummaryStatCard} elevation={0}>
          <Text style={styles.topSummaryStatValue}>{weakestArea ?? 'Balanced'}</Text>
          <Text style={styles.topSummaryStatLabel}>Care area</Text>
        </Surface>
      </View>
      <View style={styles.summaryRow}>
        <StatusPill icon="lock-outline" label={`Private ${privateCount}`} style={styles.summaryPill} textStyle={styles.summaryLabel} />
        <StatusPill icon="clock-outline" label={`Later ${laterCount}`} style={styles.summaryPill} textStyle={styles.summaryLabel} />
        <StatusPill
          icon={connected ? 'account-group-outline' : 'heart-outline'}
          label={connected ? `Shared ${sharedCount}` : `Notes ${privateCount + laterCount}`}
          style={styles.summaryPill}
          textStyle={styles.summaryLabel}
        />
      </View>
    </Surface>
  );
}

function ScoreLineChart({
  title,
  points,
  color,
  maxValue,
  currentValue,
  delta,
  supportingText,
  emptyCopy,
}: {
  title: string;
  points: TrendPoint[];
  color: string;
  maxValue: number;
  currentValue: number;
  delta: number;
  supportingText: string;
  emptyCopy: string;
}) {
  if (points.length === 0) {
    return (
      <Surface style={styles.chartCard} elevation={0}>
        <Text style={styles.chartTitle}>{title}</Text>
        <Text style={styles.emptyCopy}>{emptyCopy}</Text>
      </Surface>
    );
  }

  const visiblePoints = points.slice(-8);
  const values = visiblePoints.map(point => point.score);
  const heights = getBarHeights(values, maxValue, 0.14);

  return (
    <Surface style={styles.chartCard} elevation={0}>
      <View style={styles.chartHeaderRow}>
        <View style={styles.entryHeaderCopy}>
          <Text style={styles.chartTitle}>{title}</Text>
          <Text style={styles.sectionMeta}>Are we improving or slipping?</Text>
        </View>
        <View style={styles.chartHeaderMetricWrap}>
          <Text style={styles.chartHeroValue}>{Math.round(currentValue)}</Text>
          <View style={[styles.summaryPill, delta > 0 ? styles.summaryPillPositive : delta < 0 ? styles.summaryPillNegative : null]}>
            <Text style={styles.summaryLabel}>{formatSignedValue(delta, ' pts')}</Text>
          </View>
        </View>
      </View>
      <View style={styles.lineChartFrame}>
        <View style={styles.scoreBarsRow}>
          {visiblePoints.map((point, index) => (
            <View key={`score-point-${point.id}`} style={styles.scoreBarColumn}>
              <View
                style={[
                  styles.scoreBar,
                  {
                    backgroundColor: color,
                    height: Math.max(16, Math.round(SCORE_CHART_HEIGHT * heights[index]!)),
                    opacity: index === visiblePoints.length - 1 ? 1 : 0.24 + heights[index]! * 0.58,
                  },
                ]}
              />
            </View>
          ))}
        </View>
      </View>
      <View style={styles.chartAxisRow}>
        {visiblePoints.map((point, index) => (
          <Text key={`score-label-${point.id}`} style={styles.chartAxisLabel}>
            {shouldShowChartLabel(index, visiblePoints.length) ? point.label : ' '}
          </Text>
        ))}
      </View>
      <Text style={styles.entryDetail}>{supportingText}</Text>
    </Surface>
  );
}

function ConnectionTensionLineChart({
  title,
  points,
  headline,
  body,
}: {
  title: string;
  points: TrendPoint[];
  headline: string;
  body: string;
}) {
  if (points.length === 0) {
    return (
      <Surface style={styles.chartCard} elevation={0}>
        <Text style={styles.chartTitle}>{title}</Text>
        <Text style={styles.emptyCopy}>Recent activity will fill this in after your first metrics sync.</Text>
      </Surface>
    );
  }

  const visiblePoints = points.slice(-6);

  return (
    <Surface style={styles.chartCard} elevation={0}>
      <View style={styles.chartHeaderRow}>
        <View style={styles.entryHeaderCopy}>
          <Text style={styles.chartTitle}>{title}</Text>
          <Text style={styles.sectionMeta}>How are closeness and strain moving?</Text>
        </View>
        <View style={styles.chartLegendRow}>
          <View style={styles.chartLegendItem}>
            <View style={[styles.chartLegendDot, { backgroundColor: '#B25B63' }]} />
            <Text style={styles.chartLegendLabel}>Connection</Text>
          </View>
          <View style={styles.chartLegendItem}>
            <View style={[styles.chartLegendDot, { backgroundColor: '#7D8AB8' }]} />
            <Text style={styles.chartLegendLabel}>Tension</Text>
          </View>
        </View>
      </View>
      <View style={styles.dualMetricList}>
        {visiblePoints.map(point => (
          <View key={`dual-row-${point.id}`} style={styles.dualMetricRow}>
            <Text style={styles.dualMetricLabel}>{point.label}</Text>
            <View style={styles.dualMetricBars}>
              <View style={styles.dualMetricTrack}>
                <View
                  style={[
                    styles.dualMetricFill,
                    styles.dualMetricConnection,
                    { width: `${Math.max(14, (point.connection / 5) * 100)}%` },
                  ]}
                />
              </View>
              <View style={styles.dualMetricTrack}>
                <View
                  style={[
                    styles.dualMetricFill,
                    styles.dualMetricTension,
                    { width: `${Math.max(14, (point.tension / 5) * 100)}%` },
                  ]}
                />
              </View>
            </View>
            <Text style={styles.dualMetricValue}>{point.connection.toFixed(1)} / {point.tension.toFixed(1)}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.entryPreview}>{headline}</Text>
      <Text style={styles.entryDetail}>{body}</Text>
    </Surface>
  );
}

function StreakSparklineCard({
  points,
  currentStreak,
}: {
  points: TrendPoint[];
  currentStreak: number;
}) {
  return (
    <Surface style={styles.streakCard} elevation={0}>
      <View style={styles.streakCardHeader}>
        <View style={styles.entryHeaderCopy}>
          <Text style={styles.chartTitle}>Check-in consistency</Text>
          <Text style={styles.sectionMeta}>A lighter habit signal.</Text>
        </View>
        <View style={styles.streakValueWrap}>
          <Text style={styles.streakValue}>{currentStreak}d</Text>
          <Text style={styles.streakValueLabel}>streak</Text>
        </View>
      </View>
      <TrendSparkline points={points} metric="streak" color="#D79395" />
      <Text style={styles.entryDetail}>
        {currentStreak > 0
          ? `You have checked in ${currentStreak} day${currentStreak === 1 ? '' : 's'} in a row.`
          : 'A few consecutive check-ins will make this rhythm easier to trust.'}
      </Text>
    </Surface>
  );
}

const MOOD_HINTS = ['Heavy', 'Tender', 'Steady', 'Open', 'Lit up'];
const CONNECTION_HINTS = ['Distant', 'Off', 'Okay', 'Close', 'Deeply connected'];
const TENSION_HINTS = ['Calm', 'Gentle', 'Present', 'Strained', 'High tension'];
const INSIGHTS_JUMP_SECTIONS: JumpSection[] = [
  { key: 'pulse', label: 'Relationship Pulse' },
  { key: 'score', label: 'Connection Score' },
  { key: 'trends', label: 'Trend Charts' },
  { key: 'coaching', label: 'Coaching' },
  { key: 'history', label: 'History' },
  { key: 'checkin', label: 'Daily Check-In' },
  { key: 'saved', label: 'Saved Reflections' },
];

type ArchiveFilter = 'private' | 'decideLater' | 'shared';

type EntryContext = {
  entry: InsightEntry;
  source: 'private' | 'shared';
  linkedPrivateEntryId?: string | null;
};

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
          <StatusPill
            icon={getVisibilityBadgeIconName(entry.visibility)}
            label={getVisibilityBadgeLabel(entry.visibility)}
            style={styles.visibilityPill}
            textStyle={styles.visibilityPillText}
          />
        </View>
        {showAuthor ? <Text style={styles.entryAuthor}>From {entry.createdByEmail}</Text> : null}
        <View style={styles.metricsRow}>
          <MetricPill icon="emoticon-outline" label={`Mood ${entry.mood}/5`} />
          <MetricPill icon="heart-outline" label={`Connection ${entry.connection}/5`} />
          <MetricPill icon="lightning-bolt-outline" label={`Tension ${entry.tension}/5`} />
        </View>
        <Text style={styles.entryPreview}>{getInsightPreview(entry)}</Text>
        {entry.appreciation ? <Text style={styles.entryDetail}>Appreciation · {entry.appreciation}</Text> : null}
        {entry.need ? <Text style={styles.entryDetail}>Need · {entry.need}</Text> : null}
        {entry.nextStep ? <Text style={styles.entryDetail}>Next step · {entry.nextStep}</Text> : null}
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
  const syncingSnapshots = useInsightsStore(state => state.syncingSnapshots);
  const privateEntries = useInsightsStore(state => state.privateEntries);
  const sharedEntries = useInsightsStore(state => state.sharedEntries);
  const metricSnapshots = useInsightsStore(state => state.metricSnapshots);
  const loveActions = useLoveActionStore(state => state.actions);
  const loveNotes = useMirrorMessageStore(state => state.messages);
  const [mood, setMood] = useState(3);
  const [connection, setConnection] = useState(3);
  const [tension, setTension] = useState(2);
  const [appreciation, setAppreciation] = useState('');
  const [need, setNeed] = useState('');
  const [reflection, setReflection] = useState('');
  const [nextStep, setNextStep] = useState('');
  const [visibility, setVisibility] = useState<InsightVisibility>(profile?.coupleId ? 'decideLater' : 'private');
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilter>('private');
  const [scoreWindow, setScoreWindow] = useState<MetricsWindow>('7d');
  const [editingContext, setEditingContext] = useState<EntryContext | null>(null);
  const [deleteContext, setDeleteContext] = useState<EntryContext | null>(null);
  const [saving, setSaving] = useState(false);
  const [sharingEntryId, setSharingEntryId] = useState<string | null>(null);
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState('');
  const [sectionOffsets, setSectionOffsets] = useState<Record<string, number>>({});
  const scrollViewRef = useRef<any>(null);
  const isConnected = !!profile?.coupleId;

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
  const scoreWindowStart = useMemo(() => getMetricsWindowStart(scoreWindow), [scoreWindow]);
  const relationshipEntries = isConnected ? sharedEntries : privateEntries;
  const scoreBreakdown = useMemo(
    () =>
      buildScoreBreakdown({
        actions: loveActions,
        insights: relationshipEntries,
        notes: loveNotes,
        windowStart: scoreWindowStart,
        isConnected,
      }),
    [isConnected, loveActions, loveNotes, relationshipEntries, scoreWindowStart],
  );
  const pulseSummary = useMemo(
    () =>
      buildPulseSummary({
        entries: relationshipEntries,
        score: scoreBreakdown.score,
        windowStart: scoreWindowStart,
        trendDelta: scoreBreakdown.trendDelta,
      }),
    [relationshipEntries, scoreBreakdown.score, scoreBreakdown.trendDelta, scoreWindowStart],
  );
  const areaBalance = useMemo(
    () => buildAreaBalance(loveActions, scoreWindowStart),
    [loveActions, scoreWindowStart],
  );
  const historyFeed = useMemo(
    () =>
      buildHistoryFeed({
        actions: loveActions,
        insights: relationshipEntries,
        notes: loveNotes,
        windowStart: scoreWindowStart,
      }),
    [loveActions, loveNotes, relationshipEntries, scoreWindowStart],
  );
  const recentRelationshipFollowThrough = useMemo(
    () =>
      scoreBreakdown.completedActions
        .slice()
        .sort((left, right) => (right.lastCompletedAt ?? right.updatedAt) - (left.lastCompletedAt ?? left.updatedAt))
        .slice(0, 5),
    [scoreBreakdown.completedActions],
  );
  const selectedWindowSnapshots = useMemo(
    () =>
      metricSnapshots
        .filter(snapshot => snapshot.window === scoreWindow)
        .slice()
        .sort((left, right) => left.capturedDate - right.capturedDate),
    [metricSnapshots, scoreWindow],
  );
  const latestSnapshot = selectedWindowSnapshots.at(-1) ?? null;
  const previousSnapshot = selectedWindowSnapshots.at(-2) ?? null;
  const chartPoints = useMemo(
    () =>
      selectedWindowSnapshots.length > 0
        ? buildMetricChartPoints(metricSnapshots, scoreWindow)
        : buildLiveMetricChartPoints({
            actions: loveActions,
            insights: relationshipEntries,
            notes: loveNotes,
            window: scoreWindow,
            isConnected,
          }),
    [isConnected, loveActions, loveNotes, metricSnapshots, relationshipEntries, scoreWindow, selectedWindowSnapshots.length],
  );
  const trendInterpretation = useMemo(
    () =>
      buildTrendInterpretation({
        window: scoreWindow,
        pulseSummary,
        scoreBreakdown,
        latestSnapshot,
        previousSnapshot,
      }),
    [latestSnapshot, previousSnapshot, pulseSummary, scoreBreakdown, scoreWindow],
  );
  const scoreChangeSummary = useMemo(
    () =>
      buildScoreChangeSummary({
        scoreBreakdown,
        latestSnapshot,
        previousSnapshot,
      }),
    [latestSnapshot, previousSnapshot, scoreBreakdown],
  );
  const displayScore = latestSnapshot?.score ?? scoreBreakdown.score;
  const displayPulseLabel = latestSnapshot?.pulseLabel ?? pulseSummary.label;
  const displayPulseTrend = latestSnapshot?.pulseTrend ?? pulseSummary.trend;
  const displayAverageMood = latestSnapshot?.averageMood ?? pulseSummary.averageMood;
  const displayAverageConnection = latestSnapshot?.averageConnection ?? pulseSummary.averageConnection;
  const displayAverageTension = latestSnapshot?.averageTension ?? pulseSummary.averageTension;
  const displayStreak = latestSnapshot?.checkInStreakDays ?? pulseSummary.checkInStreakDays;
  const loadingCopy = !hydrated || relationshipSyncing || syncingPrivate || syncingShared || (isConnected && syncingSnapshots);
  const canSubmit = hydrated && writtenCount > 0 && !saving;

  useEffect(() => {
    if (!isConnected && archiveFilter === 'shared') {
      setArchiveFilter('private');
    }
  }, [archiveFilter, isConnected]);

  useEffect(() => {
    if (!isConnected && visibility === 'shared') {
      setVisibility('private');
    }
  }, [isConnected, visibility]);

  const registerSection = (key: string) => ({ nativeEvent: { layout } }: LayoutChangeEvent) => {
    const nextY = layout.y;
    setSectionOffsets(current => (current[key] === nextY ? current : { ...current, [key]: nextY }));
  };

  const visibleJumpSections = INSIGHTS_JUMP_SECTIONS.map(section => {
    if (section.key === 'pulse') {
      return { ...section, label: isConnected ? 'Relationship Pulse' : 'Personal Pulse' };
    }

    if (section.key === 'score') {
      return { ...section, label: isConnected ? 'Connection Score' : 'Care Score' };
    }

    return section;
  }).filter(section => sectionOffsets[section.key] !== undefined);

  const handleJumpToSection = (key: string) => {
    const targetY = sectionOffsets[key];

    if (typeof targetY === 'number') {
      scrollViewRef.current?.scrollTo({ y: Math.max(0, targetY - 12), animated: true });
    }
  };

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

    if (visibility === 'shared' && !isConnected) {
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

  const handleRecommendationPress = (recommendation: CoachingRecommendation) => {
    if (recommendation.focus === 'insights') {
      setSnackbar('Use the reflection form below to act on this recommendation.');
      return;
    }

    navigation.navigate('Love');
    setSnackbar(
      recommendation.focus === 'loveActions'
        ? 'Open Love to create or respond to a Love Action.'
        : 'Open Love to send a guided Love Note.',
    );
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
        { value: 'shared', label: 'Share', disabled: !isConnected },
      ];

  return (
    <>
      <SafeAreaView style={styles.screen} edges={['top']}>
        <ScrollView
          ref={scrollViewRef}
          contentInsetAdjustmentBehavior="never"
          style={styles.scrollView}
          contentContainerStyle={styles.content}
        >
          <Text variant="headlineMedium" style={styles.header}>
            Insights
          </Text>
          <Text style={styles.subheader}>
            {isConnected
              ? 'Check in, read the pulse, and decide what stays private versus shared.'
              : 'Check in, read your own patterns, and build clarity before you decide what should be shared later.'}
          </Text>
          <InsightsTopSummaryCard
            score={displayScore}
            delta={scoreChangeSummary.delta}
            pulseLabel={displayPulseLabel}
            pulseTrend={displayPulseTrend}
            streak={displayStreak}
            weakestArea={scoreBreakdown.weakestArea ? LOVE_AREA_LABELS[scoreBreakdown.weakestArea] : null}
            connected={isConnected}
            chartPoints={chartPoints}
            privateCount={privateOnlyEntries.length}
            laterCount={laterEntries.length}
            sharedCount={sharedEntries.length}
          />
          {loadingCopy ? <Text style={styles.syncText}>Syncing your reflection space...</Text> : null}
          {!!relationshipError ? <Text style={styles.errorText}>{relationshipError}</Text> : null}
          {!isConnected ? (
            <Card style={styles.connectionCard}>
              <Card.Content style={styles.connectionCardContent}>
                <Text variant="titleMedium" style={styles.cardTitle}>
                  Share your reflections when you’re ready
                </Text>
                <Text style={styles.connectionBody}>
                  Private check-ins, personal Love Actions, and personal Love Notes work now. Connect in Us when you want to turn this into a shared relationship dashboard.
                </Text>
                <Button mode="contained" onPress={() => navigation.navigate('Us')} style={styles.primaryButton}>
                  Go to Us
                </Button>
              </Card.Content>
            </Card>
          ) : null}
          <View onLayout={registerSection('pulse')}>
            <Card style={styles.archiveCard}>
              <Card.Content>
                <SectionHeading
                  section="pulse"
                  title={isConnected ? 'Relationship pulse' : 'Personal pulse'}
                  meta={
                    isConnected
                      ? 'Shared reflections, tension, connection, and follow-through in one read.'
                      : 'Private reflections, personal actions, and Love Notes in one read.'
                  }
                />
              <View style={styles.metricsRow}>
                <StatusPill icon="heart-pulse" label={displayPulseLabel} style={styles.metricPill} textStyle={styles.metricLabel} />
                <StatusPill
                  icon={getPulseTrendIconName(displayPulseTrend)}
                  label={getPulseTrendLabel(displayPulseTrend)}
                  style={styles.metricPill}
                  textStyle={styles.metricLabel}
                />
                <StatusPill icon="calendar-check-outline" label={`${displayStreak} day streak`} style={styles.metricPill} textStyle={styles.metricLabel} />
              </View>
              <Text style={styles.archiveMeta}>{getPulseLabelCopy(displayPulseLabel)}</Text>
              <Surface
                style={[
                  styles.explanationCard,
                  trendInterpretation.tone === 'growing'
                    ? styles.explanationCardPositive
                    : trendInterpretation.tone === 'caution'
                      ? styles.explanationCardNegative
                      : null,
                ]}
                elevation={0}
              >
                <Text variant="titleSmall" style={styles.entryDate}>
                  {trendInterpretation.headline}
                </Text>
                <Text style={styles.entryDetail}>{trendInterpretation.body}</Text>
                <View style={styles.metricsRow}>
                  {trendInterpretation.supportPills.map(signal => (
                    <MetricPill key={signal} icon="star-four-points-outline" label={signal} />
                  ))}
                </View>
              </Surface>
              <View style={styles.metricsRow}>
                <MetricPill icon="emoticon-outline" label={`Mood ${displayAverageMood || 0}/5`} />
                <MetricPill icon="heart-outline" label={`Connection ${displayAverageConnection || 0}/5`} />
                <MetricPill icon="lightning-bolt-outline" label={`Tension ${displayAverageTension || 0}/5`} />
              </View>
              <Text style={styles.archiveMeta}>
                {latestSnapshot
                  ? `${latestSnapshot.capturedDay} snapshot loaded for this ${getWindowLabel(scoreWindow)} window.`
                  : pulseSummary.recentReflectionCount === 0
                    ? isConnected
                      ? 'No recent shared reflections yet. Save or share a check-in below to start the pulse history.'
                      : 'No recent reflections yet. Save a private check-in below to start your pulse history.'
                    : `${pulseSummary.recentReflectionCount} reflections and ${scoreBreakdown.measuredNotes.length} Love Notes are shaping this ${isConnected ? 'pulse' : 'personal pulse'}.`}
              </Text>
              </Card.Content>
            </Card>
          </View>
          <View onLayout={registerSection('score')}>
            <Card style={styles.archiveCard}>
              <Card.Content>
                <SectionHeading
                  section="score"
                  title={isConnected ? 'Connection Score' : 'Care Score'}
                  meta="Weighted by recency, follow-through, reflection depth, emotional presence, and Love Note care."
                />
              <Surface style={styles.segmentedWrap} elevation={0}>
                <SegmentedButtons
                  value={scoreWindow}
                  onValueChange={nextValue => setScoreWindow(nextValue as MetricsWindow)}
                  buttons={[
                    { value: '7d', label: 'Last 7 days' },
                    { value: '30d', label: 'Last 30 days' },
                    { value: '90d', label: 'Last 90 days' },
                  ]}
                  style={styles.archiveFilterSelector}
                  theme={{ roundness: 999 }}
                />
              </Surface>
              <View style={styles.metricsRow}>
                <MetricPill icon="chart-line" label={`Score ${Math.round(displayScore)}/100`} />
                <MetricPill icon="check-circle-outline" label={`Completed ${scoreBreakdown.completedActions.length}`} />
                <MetricPill icon="hand-heart-outline" label={`Appreciated ${scoreBreakdown.appreciatedActions.length}`} />
              </View>
              <View style={styles.metricsRow}>
                <MetricPill icon="check-decagram-outline" label={`Reliability ${Math.round(scoreBreakdown.actionReliability)}%`} />
                <MetricPill icon="notebook-edit-outline" label={`Reflection ${Math.round(scoreBreakdown.reflectionScore)}%`} />
                <MetricPill icon="heart-plus-outline" label={`Love Notes ${Math.round(scoreBreakdown.noteCareScore)}%`} />
              </View>
              <View style={styles.metricsRow}>
                <MetricPill icon="gesture-tap-button" label={`Appreciation ${Math.round(scoreBreakdown.appreciationScore)}%`} />
                <MetricPill icon="emoticon-heart-outline" label={`Presence ${Math.round(scoreBreakdown.emotionalPresenceScore)}%`} />
                <MetricPill
                  icon={isConnected ? 'account-group-outline' : 'clock-outline'}
                  label={isConnected ? `Shared ${Math.round(scoreBreakdown.sharedReflectionRatio)}%` : `Later ${laterEntries.length}`}
                />
              </View>
              <Text style={styles.archiveMeta}>
                {scoreBreakdown.measuredActions.length === 0 && scoreBreakdown.measuredInsights.length === 0 && scoreBreakdown.measuredNotes.length === 0
                  ? isConnected
                    ? `No shared signals are shaping this ${getWindowLabel(scoreWindow)} score yet.`
                    : `No personal signals are shaping this ${getWindowLabel(scoreWindow)} score yet.`
                  : `${scoreBreakdown.measuredActions.length} Love Actions, ${scoreBreakdown.measuredInsights.length} reflections, and ${scoreBreakdown.measuredNotes.length} Love Notes are shaping this ${isConnected ? 'score' : 'personal score'}.`}
              </Text>
              <Surface style={styles.explanationCard} elevation={0}>
                <View style={styles.scoreComponentHeader}>
                  <Text variant="titleSmall" style={styles.entryDate}>
                    Why this changed
                  </Text>
                  <View
                    style={[
                      styles.visibilityPill,
                      scoreChangeSummary.direction === 'up'
                        ? styles.visibilityPillPositive
                        : scoreChangeSummary.direction === 'down'
                          ? styles.visibilityPillNegative
                          : null,
                    ]}
                  >
                    <Text style={styles.visibilityPillText}>{formatSignedValue(scoreChangeSummary.delta, ' pts')}</Text>
                  </View>
                </View>
                <Text style={styles.entryPreview}>{scoreChangeSummary.headline}</Text>
                <Text style={styles.entryDetail}>{scoreChangeSummary.body}</Text>
                <View style={styles.driverList}>
                  {scoreChangeSummary.drivers.map(driver => (
                    <Surface key={driver.id} style={styles.driverCard} elevation={0}>
                      <View style={styles.scoreComponentHeader}>
                        <Text variant="titleSmall" style={styles.entryDate}>
                          {driver.label}
                        </Text>
                        <View
                          style={[
                            styles.visibilityPill,
                            driver.direction === 'up'
                              ? styles.visibilityPillPositive
                              : driver.direction === 'down'
                                ? styles.visibilityPillNegative
                                : null,
                          ]}
                        >
                          <Text style={styles.visibilityPillText}>{formatSignedValue(driver.scoreImpact, ' pts')}</Text>
                        </View>
                      </View>
                      <Text style={styles.entryDetail}>{driver.summary}</Text>
                    </Surface>
                  ))}
                </View>
              </Surface>
              <View style={styles.entryList}>
                {scoreBreakdown.componentScores.map(component => (
                  <Surface key={component.id} style={styles.scoreComponentCard} elevation={0}>
                    <View style={styles.scoreComponentHeader}>
                      <Text variant="titleSmall" style={styles.entryDate}>
                        {component.label}
                      </Text>
                      <View style={styles.visibilityPill}>
                        <Text style={styles.visibilityPillText}>{Math.round(component.score)}%</Text>
                      </View>
                    </View>
                    <Text style={styles.entryDetail}>{component.summary}</Text>
                  </Surface>
                ))}
              </View>
              </Card.Content>
            </Card>
          </View>
          <View onLayout={registerSection('trends')}>
            <Card style={styles.archiveCard}>
              <Card.Content>
                <SectionHeading
                  section="trends"
                  title="Trends over time"
                  meta={
                    isConnected
                      ? 'Daily snapshots show whether momentum is building or slipping.'
                      : 'Recent activity shows whether your reflection, care, and follow-through are building or slipping.'
                  }
                />
              <View style={styles.chartStack}>
                <ScoreLineChart
                  title="Score trend"
                  points={chartPoints}
                  color="#B25B63"
                  maxValue={100}
                  currentValue={displayScore}
                  delta={scoreChangeSummary.delta}
                  supportingText={scoreChangeSummary.body}
                  emptyCopy={
                    isConnected
                      ? 'Score history will appear after the first snapshot is written for this couple.'
                      : 'Score history will appear once a few days of personal reflections, Love Notes, or actions have accumulated.'
                  }
                />
                <ConnectionTensionLineChart
                  title="Connection vs tension"
                  points={chartPoints}
                  headline={trendInterpretation.headline}
                  body={trendInterpretation.body}
                />
                <StreakSparklineCard points={chartPoints} currentStreak={displayStreak} />
              </View>
              </Card.Content>
            </Card>
          </View>
          <View onLayout={registerSection('coaching')}>
            <Card style={styles.archiveCard}>
              <Card.Content>
                <SectionHeading
                  section="coaching"
                  title="Coaching recommendations"
                  meta={
                    isConnected
                      ? 'Suggestions based on weak areas, tension, follow-through, and shared visibility.'
                      : 'Suggestions based on weak areas, tension, follow-through, and reflection patterns.'
                  }
                />
              <View style={styles.entryList}>
                {scoreBreakdown.recommendations.length === 0 ? (
                  <Text style={styles.emptyCopy}>No urgent coaching prompts right now. Keep reinforcing what is already working.</Text>
                ) : (
                  scoreBreakdown.recommendations.map(recommendation => {
                    const prompt = recommendation.promptId
                      ? LOVE_NOTE_PROMPTS.find(item => item.id === recommendation.promptId) ?? null
                      : null;
                    return (
                      <Surface key={recommendation.id} style={styles.entryCard} elevation={0}>
                        <View style={styles.entryCardContent}>
                          <View style={styles.entryHeaderRow}>
                            <View style={styles.entryHeaderCopy}>
                              <Text variant="titleSmall" style={styles.entryDate}>
                                {recommendation.title}
                              </Text>
                              <Text style={styles.entryMeta}>{recommendation.ctaLabel}</Text>
                            </View>
                            <StatusPill
                              icon={getRecommendationFocusIconName(recommendation.focus)}
                              label={getRecommendationFocusLabel(recommendation.focus)}
                              style={styles.visibilityPill}
                              textStyle={styles.visibilityPillText}
                            />
                          </View>
                          <Text style={styles.entryDetail}>{recommendation.body}</Text>
                          <Surface style={styles.coachingReasonCard} elevation={0}>
                            <Text style={styles.coachingReasonLabel}>Why now</Text>
                            <Text style={styles.entryDetail}>{recommendation.reason}</Text>
                          </Surface>
                          <View style={styles.metricsRow}>
                            <MetricPill icon="signal" label={recommendation.signal} />
                            {recommendation.area ? (
                              <MetricPill icon="map-marker-outline" label={LOVE_AREA_LABELS[recommendation.area]} />
                            ) : null}
                            {recommendation.noteType ? (
                              <MetricPill icon="message-text-outline" label={LOVE_NOTE_TYPE_LABELS[recommendation.noteType]} />
                            ) : null}
                            {prompt ? <MetricPill icon="lightbulb-outline" label={prompt.label} /> : null}
                            {recommendation.suggestedAction ? (
                              <MetricPill
                                icon="rocket-launch-outline"
                                label={getCoachingSuggestionLabel(recommendation.suggestedAction) ?? 'Suggested action'}
                                wide
                              />
                            ) : null}
                          </View>
                          <Button mode="contained-tonal" onPress={() => handleRecommendationPress(recommendation)} style={styles.shareButton}>
                            {recommendation.ctaLabel}
                          </Button>
                        </View>
                      </Surface>
                    );
                  })
                )}
              </View>
            </Card.Content>
          </Card>
          <Card style={styles.archiveCard}>
            <Card.Content>
              <View style={styles.sectionHeader}>
                <Text variant="titleMedium" style={styles.cardTitle}>
                  Recent follow-through
                </Text>
                <Text style={styles.sectionMeta}>Recent completions and appreciations shaping today’s score.</Text>
              </View>
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
                          <MetricPill icon="calendar-clock-outline" label={`Due ${formatLoveActionMetricDate(action.nextDueAt)}`} />
                          <MetricPill icon="check-circle-outline" label={`Confirmed ${action.confirmationReaction ?? '—'}`} />
                          <MetricPill icon="hand-heart-outline" label={`Appreciated ${action.appreciationReaction ?? '—'}`} />
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
          <Card style={styles.archiveCard}>
            <Card.Content>
              <View style={styles.sectionHeader}>
                <Text variant="titleMedium" style={styles.cardTitle}>
                  {isConnected ? 'Relationship area balance' : 'Care area balance'}
                </Text>
                <Text style={styles.sectionMeta}>Which kinds of care are landing in this window.</Text>
              </View>
              <View style={styles.entryList}>
                {areaBalance.length === 0 ? (
                  <Text style={styles.emptyCopy}>No confirmed or appreciated Love Actions are shaping area balance yet.</Text>
                ) : (
                  areaBalance.map(item => (
                    <Surface key={item.area} style={styles.entryCard} elevation={0}>
                      <View style={styles.entryCardContent}>
                        <View style={styles.entryHeaderRow}>
                          <View style={styles.entryHeaderCopy}>
                            <Text variant="titleSmall" style={styles.entryDate}>
                              {LOVE_AREA_LABELS[item.area]}
                            </Text>
                            <Text style={styles.entryMeta}>{item.count} weighted actions in this area</Text>
                          </View>
                          <View style={styles.visibilityPill}>
                            <Text style={styles.visibilityPillText}>{Math.round(item.share)}%</Text>
                          </View>
                        </View>
                      </View>
                    </Surface>
                  ))
                )}
              </View>
              </Card.Content>
            </Card>
          </View>
          <View onLayout={registerSection('history')}>
            <Card style={styles.archiveCard}>
              <Card.Content>
                <SectionHeading
                  section="history"
                  title="Relationship history"
                  meta="A timeline of Love Notes, reflections, completions, and appreciations."
                />
              <View style={styles.entryList}>
                {historyFeed.length === 0 ? (
                  <Text style={styles.emptyCopy}>No recent history yet in this time window.</Text>
                ) : (
                  historyFeed.map(event => (
                    <Card key={event.id} style={styles.entryCard}>
                      <Card.Content style={styles.entryCardContent}>
                        <View style={styles.entryHeaderRow}>
                          <View style={styles.entryHeaderCopy}>
                            <Text variant="titleSmall" style={styles.entryDate}>
                              {formatInsightDate(event.timestamp)}
                            </Text>
                            <Text style={styles.entryMeta}>{event.title}</Text>
                          </View>
                          <StatusPill
                            icon={getHistoryBadgeIconName(event.badge)}
                            label={event.badge}
                            style={styles.visibilityPill}
                            textStyle={styles.visibilityPillText}
                          />
                        </View>
                        <Text style={styles.entryDetail}>{event.body}</Text>
                      </Card.Content>
                    </Card>
                  ))
                )}
              </View>
              </Card.Content>
            </Card>
          </View>
          <View onLayout={registerSection('checkin')}>
            <Surface style={styles.hero} elevation={0}>
              <View style={styles.heroHeaderRow}>
                <View style={styles.sectionIconWrap}>
                  <MaterialDesignIcons name={getSectionIconName('checkin') as any} size={18} color="#B25B63" />
                </View>
                <View style={styles.sectionHeaderCopy}>
                  <Text variant="titleMedium" style={styles.heroTitle}>
                    Daily check-in + relationship pulse
                  </Text>
                  <Text style={styles.heroBody}>Capture the moment, the need, and the next move.</Text>
                </View>
              </View>
            </Surface>
            <Card style={styles.card}>
              <Card.Content style={styles.cardContent}>
              <SectionHeading
                section="saved"
                title={editingContext ? 'Edit this reflection' : 'Save this reflection as'}
                meta={
                  editingContext
                    ? editingContext.source === 'shared'
                      ? 'Editing a shared insight your partner can see.'
                      : 'Editing a reflection from your private archive.'
                    : 'Choose the privacy level first.'
                }
              />
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
                  ? 'Shared with your partner.'
                  : visibility === 'decideLater'
                    ? 'Saved privately until you decide.'
                    : 'Private to your account only.'}
              </HelperText>
              <View style={styles.sectionHeader}>
                <Text variant="titleMedium" style={styles.cardTitle}>
                  Pulse check
                </Text>
                <Text style={styles.sectionMeta}>Name the temperature of today.</Text>
              </View>
              <View style={styles.ratingStack}>
                <RatingField label="How do you feel right now?" value={mood} onChange={setMood} hints={MOOD_HINTS} />
                <RatingField
                  label={isConnected ? 'How connected do you feel to us?' : 'How connected do you feel to yourself and this season?'}
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
                <Text style={styles.sectionMeta}>Write as little or as much as you need.</Text>
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
          </View>
          <View onLayout={registerSection('saved')}>
            <Card style={styles.archiveCard}>
              <Card.Content>
                <SectionHeading
                  section="saved"
                  title="Saved reflections"
                  meta="Filter your archive by privacy state."
                />
              <Surface style={styles.segmentedWrap} elevation={0}>
                <SegmentedButtons
                  value={archiveFilter}
                  onValueChange={nextValue => setArchiveFilter(nextValue as ArchiveFilter)}
                  buttons={[
                    { value: 'private', label: 'Private' },
                    { value: 'decideLater', label: 'Later' },
                    { value: 'shared', label: 'Shared', disabled: !isConnected },
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
          </View>
        </ScrollView>
      </SafeAreaView>
      <JumpToSectionFab sections={visibleJumpSections} onSelectSection={handleJumpToSection} />
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
  topSummaryCard: {
    borderRadius: 24,
    backgroundColor: '#F8E2D8',
    borderWidth: 1,
    borderColor: '#F0D0C0',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  topSummaryHeader: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  topSummaryPrimary: {
    flex: 1,
    gap: 4,
  },
  topSummaryEyebrow: {
    color: '#8F6B74',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  topSummaryScore: {
    color: '#3F2831',
    fontSize: 38,
    lineHeight: 42,
    fontWeight: '800',
  },
  topSummaryScoreMeta: {
    color: '#7C5964',
    fontSize: 14,
    fontWeight: '600',
  },
  topSummarySparkWrap: {
    width: SPARKLINE_WIDTH,
    alignItems: 'stretch',
    justifyContent: 'center',
    paddingHorizontal: 4,
    gap: 4,
  },
  sparklineMeta: {
    color: '#8F6B74',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  topSummaryGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  topSummaryStatCard: {
    flex: 1,
    minWidth: 0,
    borderRadius: 18,
    backgroundColor: '#FFF8F3',
    borderWidth: 1,
    borderColor: '#F0DED4',
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 4,
  },
  topSummaryStatValue: {
    color: '#3F2831',
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '700',
  },
  topSummaryStatLabel: {
    color: '#8F6B74',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '600',
  },
  summaryPill: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    backgroundColor: '#FFF8F4',
    borderWidth: 1,
    borderColor: '#F2D3C7',
  },
  iconPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryPillPositive: {
    backgroundColor: '#EEF6EA',
    borderColor: '#CFE1C8',
  },
  summaryPillNegative: {
    backgroundColor: '#FAECE8',
    borderColor: '#E7CBC5',
  },
  summaryLabel: {
    color: '#7C5964',
    fontSize: 11,
    fontWeight: '700',
  },
  iconPillText: {
    color: '#7C5964',
    fontSize: 12,
    fontWeight: '700',
  },
  sparklinePlaceholder: {
    width: SPARKLINE_WIDTH,
    height: SPARKLINE_HEIGHT + 16,
  },
  sparklineWrap: {
    gap: 4,
  },
  sparklineRow: {
    width: SPARKLINE_WIDTH,
    height: SPARKLINE_HEIGHT,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 4,
  },
  sparklineRowAnchored: {
    borderRadius: 14,
    backgroundColor: '#FFF8F3',
    borderWidth: 1,
    borderColor: '#F0DED4',
    paddingHorizontal: 8,
    paddingVertical: SPARKLINE_FRAME_VERTICAL_PADDING,
  },
  sparklineBarSlot: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  sparklineBar: {
    width: 8,
    minHeight: 10,
    borderRadius: 999,
  },
  sparklineBarThin: {
    width: 6,
  },
  sparklineAnchorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  sparklineAnchorLabel: {
    color: '#8F6B74',
    fontSize: 10,
    fontWeight: '700',
  },
  sparklineCaption: {
    color: '#8F6B74',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
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
  heroHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
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
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  sectionIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FCE9E1',
    borderWidth: 1,
    borderColor: '#F0D0C0',
  },
  sectionHeaderCopy: {
    flex: 1,
    minWidth: 0,
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
  archiveFilterSelector: {
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
  metricPillWide: {
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#FFF3EA',
    maxWidth: '100%',
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
  explanationCard: {
    marginTop: 10,
    borderRadius: 18,
    backgroundColor: '#FFF8F3',
    borderWidth: 1,
    borderColor: '#F0DED4',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  explanationCardPositive: {
    backgroundColor: '#FFF6F1',
    borderColor: '#E6C3B5',
  },
  explanationCardNegative: {
    backgroundColor: '#FFF3F0',
    borderColor: '#EABDB9',
  },
  visibilityPillPositive: {
    backgroundColor: '#E8F3E4',
  },
  visibilityPillNegative: {
    backgroundColor: '#F7E2E0',
  },
  driverList: {
    gap: 8,
    marginTop: 2,
  },
  driverCard: {
    borderRadius: 16,
    backgroundColor: '#FFF3EA',
    borderWidth: 1,
    borderColor: '#F0DED4',
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 6,
  },
  coachingReasonCard: {
    marginTop: 10,
    borderRadius: 16,
    backgroundColor: '#FFF3EA',
    borderWidth: 1,
    borderColor: '#F0DED4',
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 4,
  },
  coachingReasonLabel: {
    color: '#8F6B74',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  chartStack: {
    gap: 10,
    marginTop: 14,
  },
  chartCard: {
    borderRadius: 20,
    backgroundColor: '#FFF8F3',
    borderWidth: 1,
    borderColor: '#F0DED4',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  streakCard: {
    borderRadius: 20,
    backgroundColor: '#FFF8F3',
    borderWidth: 1,
    borderColor: '#F0DED4',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  chartTitle: {
    color: '#3F2831',
    fontWeight: '700',
  },
  chartHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  chartHeaderMetricWrap: {
    alignItems: 'flex-end',
    gap: 4,
  },
  chartHeroValue: {
    color: '#3F2831',
    fontSize: 24,
    fontWeight: '800',
  },
  lineChartFrame: {
    borderRadius: 18,
    backgroundColor: '#FFF3EA',
    borderWidth: 1,
    borderColor: '#F0DED4',
    paddingHorizontal: 10,
    paddingVertical: 12,
    overflow: 'hidden',
  },
  scoreBarsRow: {
    height: SCORE_CHART_HEIGHT,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
  },
  scoreBarColumn: {
    flex: 1,
    alignSelf: 'stretch',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  scoreBar: {
    width: '100%',
    maxWidth: 22,
    minHeight: 16,
    borderRadius: 999,
  },
  chartAxisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
    paddingHorizontal: 2,
    marginTop: -2,
  },
  chartAxisLabel: {
    flex: 1,
    textAlign: 'center',
    color: '#8F6B74',
    fontSize: 9,
    fontWeight: '600',
  },
  chartLabel: {
    color: '#8F6B74',
    fontSize: 10,
    fontWeight: '600',
  },
  chartLegendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chartLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chartLegendDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  chartLegendLabel: {
    color: '#7C5964',
    fontSize: 11,
    fontWeight: '700',
  },
  dualMetricList: {
    gap: 8,
  },
  dualMetricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dualMetricLabel: {
    width: 34,
    color: '#8F6B74',
    fontSize: 10,
    fontWeight: '700',
  },
  dualMetricBars: {
    flex: 1,
    gap: 5,
  },
  dualMetricTrack: {
    height: 9,
    borderRadius: 999,
    backgroundColor: '#FFF3EA',
    overflow: 'hidden',
  },
  dualMetricFill: {
    height: '100%',
    borderRadius: 999,
  },
  dualMetricConnection: {
    backgroundColor: '#B25B63',
  },
  dualMetricTension: {
    backgroundColor: '#7D8AB8',
  },
  dualMetricValue: {
    width: 52,
    textAlign: 'right',
    color: '#7C5964',
    fontSize: 11,
    fontWeight: '700',
  },
  streakCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  streakValueWrap: {
    alignItems: 'flex-end',
  },
  streakValue: {
    color: '#3F2831',
    fontSize: 24,
    fontWeight: '800',
  },
  streakValueLabel: {
    color: '#8F6B74',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  scoreComponentCard: {
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#FFF8F3',
    borderWidth: 1,
    borderColor: '#F0DED4',
    gap: 6,
  },
  scoreComponentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
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
