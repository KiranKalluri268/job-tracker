"use client";

import { useState } from "react";

import { shortDate } from "@/lib/dates";
import type { Application, Status, WorkMode } from "@/lib/types";
import { STATUSES, WORK_MODES } from "@/lib/types";

import { draftOf, payloadOf, type Draft } from "./applicationDraft";
import Timeline from "./Timeline";
import { Field, buttonClass, inputClass } from "./ui";

export type RowDetailProps = {
  application: Application;
  onSaved: (app: Application) => void;
  onDeleted: (id: string) => void;
  onClose: () => void;
};

/** One read-only label/value pair for view mode. */
function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium tracking-wide text-stone-500 uppercase">{label}</p>
      <p className="mt-0.5 text-sm break-words text-stone-800">{children}</p>
    </div>
  );
}

const DASH = "—";

/**
 * The expanded body of a table row: every field of one application, shown read-only
 * until the pencil is clicked, at which point it becomes an inline form saved with
 * the check and reverted with cancel.
 */
export default function ApplicationRowDetail({
  application,
  onSaved,
  onDeleted,
  onClose,
}: RowDetailProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => draftOf(application));
  const [eventNote, setEventNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const statusChanged = draft.status !== application.status;

  function startEdit() {
    setDraft(draftOf(application));
    setEventNote("");
    setError(null);
    setEditing(true);
  }

  function cancelEdit() {
    setDraft(draftOf(application));
    setEventNote("");
    setError(null);
    setConfirmDelete(false);
    setEditing(false);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = { ...payloadOf(draft), ...(statusChanged && eventNote ? { eventNote } : {}) };
      const res = await fetch(`/api/applications/${application._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      onSaved(json.application as Application);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/applications/${application._id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        throw new Error(json.error ?? "Delete failed");
      }
      onDeleted(application._id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={save}
      className="border-t border-[var(--color-edge)] bg-[var(--color-panel-2)] px-5 py-4"
    >
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-sm font-semibold text-stone-800">
          {application.company} — {application.role}
        </h3>

        {/* Edit becomes the check; cancel sits under it, edit-mode only. */}
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {editing ? (
            <>
              <button
                type="submit"
                disabled={busy}
                aria-label="Save changes"
                className="inline-flex size-8 items-center justify-center rounded-lg bg-indigo-600 text-base font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
              >
                ✓
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                disabled={busy}
                aria-label="Cancel editing"
                className="inline-flex size-8 items-center justify-center rounded-lg border border-[var(--color-edge)] text-base text-stone-500 transition hover:bg-stone-100 hover:text-stone-800 disabled:opacity-50"
              >
                ✕
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={startEdit}
                aria-label="Edit application"
                className="inline-flex size-8 items-center justify-center rounded-lg border border-[var(--color-edge)] text-sm text-stone-600 transition hover:bg-stone-100 hover:text-stone-900"
              >
                ✎
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Collapse row"
                className="inline-flex size-8 items-center justify-center rounded-lg text-base text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
              >
                ⌃
              </button>
            </>
          )}
        </div>
      </div>

      {error ? (
        <p className="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-500/25 ring-inset">
          {error}
        </p>
      ) : null}

      <div className="mt-4 grid gap-5 lg:grid-cols-[1.7fr_1fr]">
        {editing ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Company">
              <input
                required
                className={inputClass}
                value={draft.company}
                onChange={(e) => set("company", e.target.value)}
              />
            </Field>
            <Field label="Role">
              <input
                required
                className={inputClass}
                value={draft.role}
                onChange={(e) => set("role", e.target.value)}
              />
            </Field>

            <Field label="Status">
              <select
                className={inputClass}
                value={draft.status}
                onChange={(e) => set("status", e.target.value as Status)}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Applied on">
              <input
                type="date"
                className={inputClass}
                value={draft.appliedOn}
                onChange={(e) => set("appliedOn", e.target.value)}
              />
            </Field>

            {statusChanged ? (
              <Field
                label="Note for this change"
                className="sm:col-span-2"
                hint="Optional — pinned to the timeline entry for this move."
              >
                <input
                  className={inputClass}
                  placeholder={`${application.status} → ${draft.status}`}
                  value={eventNote}
                  onChange={(e) => setEventNote(e.target.value)}
                />
              </Field>
            ) : null}

            <Field label="Next action">
              <input
                type="date"
                className={inputClass}
                value={draft.nextActionOn}
                onChange={(e) => set("nextActionOn", e.target.value)}
              />
            </Field>
            <Field label="Next action note">
              <input
                className={inputClass}
                value={draft.nextActionNote}
                onChange={(e) => set("nextActionNote", e.target.value)}
              />
            </Field>

            <Field label="Location">
              <input
                className={inputClass}
                value={draft.location}
                onChange={(e) => set("location", e.target.value)}
              />
            </Field>
            <Field label="Work mode">
              <select
                className={inputClass}
                value={draft.workMode}
                onChange={(e) => set("workMode", e.target.value as WorkMode | "")}
              >
                <option value="">{DASH}</option>
                {WORK_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Source">
              <input
                className={inputClass}
                value={draft.source}
                onChange={(e) => set("source", e.target.value)}
              />
            </Field>
            <Field label="Salary">
              <input
                className={inputClass}
                value={draft.salary}
                onChange={(e) => set("salary", e.target.value)}
              />
            </Field>

            <Field label="Posting URL" className="sm:col-span-2">
              <input
                type="url"
                className={inputClass}
                value={draft.postingUrl}
                onChange={(e) => set("postingUrl", e.target.value)}
              />
            </Field>

            <Field label="Resume version">
              <input
                className={inputClass}
                value={draft.resumeVersion}
                onChange={(e) => set("resumeVersion", e.target.value)}
              />
            </Field>
            <label className="flex items-center gap-2.5 self-end pb-2.5 text-sm text-stone-700">
              <input
                type="checkbox"
                className="size-4 accent-indigo-600"
                checked={draft.coverLetter}
                onChange={(e) => set("coverLetter", e.target.checked)}
              />
              Sent a cover letter
            </label>

            <Field label="Contact name">
              <input
                className={inputClass}
                value={draft.contactName}
                onChange={(e) => set("contactName", e.target.value)}
              />
            </Field>
            <Field label="Contact email">
              <input
                type="email"
                className={inputClass}
                value={draft.contactEmail}
                onChange={(e) => set("contactEmail", e.target.value)}
              />
            </Field>

            <Field label="Notes" className="sm:col-span-2">
              <textarea
                rows={4}
                className={`${inputClass} resize-y`}
                value={draft.notes}
                onChange={(e) => set("notes", e.target.value)}
              />
            </Field>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Cell label="Status">{application.status}</Cell>
            <Cell label="Applied on">{shortDate(application.appliedOn)}</Cell>
            <Cell label="Next action">
              {shortDate(application.nextActionOn)}
              {application.nextActionNote ? ` · ${application.nextActionNote}` : ""}
            </Cell>
            <Cell label="Location">{application.location ?? DASH}</Cell>
            <Cell label="Work mode">{application.workMode ?? DASH}</Cell>
            <Cell label="Source">{application.source ?? DASH}</Cell>
            <Cell label="Salary">{application.salary ?? DASH}</Cell>
            <Cell label="Resume version">{application.resumeVersion ?? DASH}</Cell>
            <Cell label="Cover letter">{application.coverLetter ? "Yes" : "No"}</Cell>
            <Cell label="Contact name">{application.contactName ?? DASH}</Cell>
            <Cell label="Contact email">{application.contactEmail ?? DASH}</Cell>
            <Cell label="Posting URL">
              {application.postingUrl ? (
                <a
                  href={application.postingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-700 underline underline-offset-2"
                >
                  Open posting
                </a>
              ) : (
                DASH
              )}
            </Cell>
            <Cell label="Updated">{shortDate(application.updatedAt)}</Cell>
            <div className="sm:col-span-2 lg:col-span-3">
              <Cell label="Notes">{application.notes ?? DASH}</Cell>
            </div>
          </div>
        )}

        <aside className="lg:border-l lg:border-[var(--color-edge)] lg:pl-5">
          <h4 className="mb-3 text-xs font-medium tracking-wide text-stone-500 uppercase">Timeline</h4>
          <Timeline events={application.events} />
        </aside>
      </div>

      {editing ? (
        <div className="mt-4 border-t border-[var(--color-edge)] pt-3">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-stone-500">Delete for good?</span>
              <button
                type="button"
                onClick={remove}
                disabled={busy}
                className="rounded-lg bg-rose-500/90 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
              >
                Yes, delete
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)} className={buttonClass}>
                Keep
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="rounded-lg px-3 py-2 text-sm text-rose-600 hover:bg-rose-500/10"
            >
              Delete application
            </button>
          )}
        </div>
      ) : null}
    </form>
  );
}
