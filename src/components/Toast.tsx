"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ToastAction = { label: string; onClick: () => void };

export type Toast = {
  id: number;
  message: string;
  /** Optional inline button, e.g. Undo / Redo. */
  action?: ToastAction;
  /**
   * Dedupe key. A new toast with the same source replaces any still on screen,
   * so hammering the same row doesn't stack up a column of near-identical cards.
   */
  source?: string;
};

const TTL = 4000;

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (message: string, opts?: { action?: ToastAction; source?: string }) => {
      setToasts((list) => {
        const kept = opts?.source ? list.filter((t) => t.source !== opts.source) : list;
        return [...kept, { id: nextId.current++, message, action: opts?.action, source: opts?.source }];
      });
    },
    [],
  );

  return { toasts, addToast, dismiss };
}

export function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:items-end"
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const { id } = toast;
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(() => onDismiss(id), TTL);
    return () => clearTimeout(timer);
  }, [id, paused, onDismiss]);

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-lg border border-[var(--color-edge)] bg-[var(--color-panel)] px-3.5 py-2.5 text-sm text-stone-800 shadow-lg"
    >
      <span className="min-w-0 flex-1 break-words">{toast.message}</span>
      {toast.action ? (
        <button
          type="button"
          onClick={() => {
            toast.action!.onClick();
            onDismiss(id);
          }}
          className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-500/10"
        >
          {toast.action.label}
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => onDismiss(id)}
        aria-label="Dismiss"
        className="shrink-0 text-stone-400 transition hover:text-stone-700"
      >
        ✕
      </button>
    </div>
  );
}
