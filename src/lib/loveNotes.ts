export type LoveNotePrompt = {
  id: string;
  label: string;
  tone: 'warm' | 'playful' | 'reassuring' | 'grateful' | 'desire';
  prompt: string;
  starter: string;
};

export const LOVE_NOTE_PROMPTS: LoveNotePrompt[] = [
  {
    id: 'warm-return',
    label: 'Warm return',
    tone: 'warm',
    prompt: 'Use this when you want to soften the space between you before tonight begins.',
    starter: 'Come closer tonight. I want us to land softly together.',
  },
  {
    id: 'playful-nudge',
    label: 'Playful nudge',
    tone: 'playful',
    prompt: 'Use this when you want to flirt lightly and keep your partner on your mind.',
    starter: 'Just a small interruption to say I am still thinking about you.',
  },
  {
    id: 'steady-reassurance',
    label: 'Steady reassurance',
    tone: 'reassuring',
    prompt: 'Use this after stress, conflict, or distance when safety matters more than novelty.',
    starter: 'We are okay. I am still with you, and I want to move gently toward you tonight.',
  },
  {
    id: 'gratitude-drop',
    label: 'Gratitude',
    tone: 'grateful',
    prompt: 'Use this when you want to name what your partner carried, noticed, or offered.',
    starter: 'Thank you for how you showed up for us today. I noticed it and felt it.',
  },
  {
    id: 'slow-desire',
    label: 'Slow desire',
    tone: 'desire',
    prompt: 'Use this when you want to express desire with warmth instead of pressure.',
    starter: 'I want closeness with you tonight, slowly and with real attention.',
  },
  {
    id: 'repair-open',
    label: 'Repair opener',
    tone: 'reassuring',
    prompt: 'Use this when you want to reopen connection without pretending nothing happened.',
    starter: 'I do not want distance to harden between us. I want to come back together gently.',
  },
];
