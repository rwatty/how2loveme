import { create } from 'zustand';

type LoveDraftState = {
  pendingLibraryItemId: string | null;
  pendingNotePromptId: string | null;
  queueLibraryItem: (libraryItemId: string) => void;
  queueNotePrompt: (notePromptId: string) => void;
  clear: () => void;
};

export const useLoveDraftStore = create<LoveDraftState>(set => ({
  pendingLibraryItemId: null,
  pendingNotePromptId: null,
  queueLibraryItem: pendingLibraryItemId =>
    set({
      pendingLibraryItemId,
      pendingNotePromptId: null,
    }),
  queueNotePrompt: pendingNotePromptId =>
    set({
      pendingLibraryItemId: null,
      pendingNotePromptId,
    }),
  clear: () =>
    set({
      pendingLibraryItemId: null,
      pendingNotePromptId: null,
    }),
}));
