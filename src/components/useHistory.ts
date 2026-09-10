"use client";

import { useCallback, useReducer, useRef } from "react";

/**
 * One reversible action. `undo` and `redo` each perform a full server write and
 * settle their own optimistic state; they reject if the write fails, in which
 * case the stacks are left untouched so a retry lands in the same place.
 */
export type HistoryEntry = {
  /** Short noun shown in the toast, e.g. "status change", "star", "edit". */
  label: string;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
};

const LIMIT = 50;

/**
 * A linear undo/redo history. Any fresh action (`push`) drops the redo stack, so
 * redo only ever replays something that was just undone.
 */
export function useHistory() {
  const undoStack = useRef<HistoryEntry[]>([]);
  const redoStack = useRef<HistoryEntry[]>([]);
  // The stacks live in refs (no render needs their contents); this only nudges a
  // re-render so anything that later reads them stays current.
  const [, bump] = useReducer((n: number) => n + 1, 0);

  const push = useCallback((entry: HistoryEntry) => {
    undoStack.current = [...undoStack.current, entry].slice(-LIMIT);
    redoStack.current = [];
    bump();
  }, []);

  const undo = useCallback(async (): Promise<HistoryEntry | null> => {
    const entry = undoStack.current.at(-1);
    if (!entry) return null;
    await entry.undo();
    undoStack.current = undoStack.current.slice(0, -1);
    redoStack.current = [...redoStack.current, entry].slice(-LIMIT);
    bump();
    return entry;
  }, []);

  const redo = useCallback(async (): Promise<HistoryEntry | null> => {
    const entry = redoStack.current.at(-1);
    if (!entry) return null;
    await entry.redo();
    redoStack.current = redoStack.current.slice(0, -1);
    undoStack.current = [...undoStack.current, entry].slice(-LIMIT);
    bump();
    return entry;
  }, []);

  return { push, undo, redo };
}
