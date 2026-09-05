export type LoveNoteType = 'warm' | 'playful' | 'reassuring' | 'grateful' | 'desire';
export type LoveNoteTag =
  | 'repair'
  | 'flirty'
  | 'reconnection'
  | 'gratitude'
  | 'support'
  | 'desire'
  | 'affirmation'
  | 'daily'
  | 'softness';

export type LoveNotePrompt = {
  id: string;
  label: string;
  tone: LoveNoteType;
  prompt: string;
  starter: string;
  tags: LoveNoteTag[];
};

export const LOVE_NOTE_TYPE_LABELS: Record<LoveNoteType, string> = {
  warm: 'Warm',
  playful: 'Playful',
  reassuring: 'Reassuring',
  grateful: 'Grateful',
  desire: 'Desire',
};

export const LOVE_NOTE_TAG_LABELS: Record<LoveNoteTag, string> = {
  repair: 'Repair',
  flirty: 'Flirty',
  reconnection: 'Reconnect',
  gratitude: 'Gratitude',
  support: 'Support',
  desire: 'Desire',
  affirmation: 'Affirmation',
  daily: 'Daily',
  softness: 'Softness',
};

export const LOVE_NOTE_TYPES: LoveNoteType[] = ['warm', 'playful', 'reassuring', 'grateful', 'desire'];
export const LOVE_NOTE_TAGS: LoveNoteTag[] = [
  'repair',
  'flirty',
  'reconnection',
  'gratitude',
  'support',
  'desire',
  'affirmation',
  'daily',
  'softness',
];

export const LOVE_NOTE_PROMPTS: LoveNotePrompt[] = [
  {
    id: 'warm-return',
    label: 'Warm return',
    tone: 'warm',
    prompt: 'Use this when you want to soften the space between you before tonight begins.',
    starter: 'Come closer tonight. I want us to land softly together.',
    tags: ['reconnection', 'softness', 'daily'],
  },
  {
    id: 'playful-nudge',
    label: 'Playful nudge',
    tone: 'playful',
    prompt: 'Use this when you want to flirt lightly and keep your partner on your mind.',
    starter: 'Just a small interruption to say I am still thinking about you.',
    tags: ['flirty', 'daily', 'reconnection'],
  },
  {
    id: 'steady-reassurance',
    label: 'Steady reassurance',
    tone: 'reassuring',
    prompt: 'Use this after stress, conflict, or distance when safety matters more than novelty.',
    starter: 'We are okay. I am still with you, and I want to move gently toward you tonight.',
    tags: ['repair', 'support', 'softness'],
  },
  {
    id: 'gratitude-drop',
    label: 'Gratitude',
    tone: 'grateful',
    prompt: 'Use this when you want to name what your partner carried, noticed, or offered.',
    starter: 'Thank you for how you showed up for us today. I noticed it and felt it.',
    tags: ['gratitude', 'affirmation', 'daily'],
  },
  {
    id: 'slow-desire',
    label: 'Slow desire',
    tone: 'desire',
    prompt: 'Use this when you want to express desire with warmth instead of pressure.',
    starter: 'I want closeness with you tonight, slowly and with real attention.',
    tags: ['desire', 'softness', 'reconnection'],
  },
  {
    id: 'repair-open',
    label: 'Repair opener',
    tone: 'reassuring',
    prompt: 'Use this when you want to reopen connection without pretending nothing happened.',
    starter: 'I do not want distance to harden between us. I want to come back together gently.',
    tags: ['repair', 'reconnection', 'support'],
  },
];
