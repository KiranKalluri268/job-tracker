"use client";

import { useEffect, useRef, useState } from "react";

import type { Application, ApplicationInput, Status, WorkMode } from "@/lib/types";
import { STATUSES, WORK_MODES } from "@/lib/types";

import Timeline from "./Timeline";
import { Field, buttonClass, inputClass, primaryButtonClass } from "./ui";

type Draft = {
  company: string;
  role: string;
  status: Status;
  appliedOn: string;
  nextActionOn: string;
  nextActionNote: string;
  location: string;
  workMode: WorkMode | "";
  source: string;
  salary: string;
  postingUrl: string;
  resumeVersion: string;
  coverLetter: boolean;
  contactName: string;
  contactEmail: string;
  notes: string;
};

const BLANK: Draft = {
  company: "",
  role: "",
  status: "Saved",
  appliedOn: "",
  nextActionOn: "",
  nextActionNote: "",
  location: "",
  workMode: "",
  source: "",
  salary: "",
  postingUrl: "",
  resumeVersion: "",
  coverLetter: false,
  contactName: "",
  contactEmail: "",
  notes: "",
};

function draftOf(app: Application | null): Draft {
  if (!app) return BLANK;
  return {
    company: app.company,
    role: app.role,
    status: app.status,
    appliedOn: app.appliedOn ?? "",
    nextActionOn: app.nextActionOn ?? "",
    nextActionNote: app.nextActionNote ?? "",
    location: app.location ?? "",
    workMode: app.workMode ?? "",
    source: app.source ?? "",
    salary: app.salary ?? "",
    postingUrl: app.postingUrl ?? "",
    resumeVersion: app.resumeVersion ?? "",
    coverLetter: app.coverLetter,
    contactName: app.contactName ?? "",
    contactEmail: app.contactEmail ?? "",
    notes: app.notes ?? "",
  };
}

function payloadOf(d: Draft): ApplicationInput {
  return { ...d, workMode: d.workMode === "" ? null : d.workMode } as ApplicationInput;
}

export type ModalProps = {
  /** null means "create a new one". */
  application: Application | null;
  onClose: () => void;
  onSaved: (app: Application) => void;
  onDeleted: (id: string) => void;
};

export default function ApplicationModal({ application, onClose, onSaved, onDeleted }: ModalProps) {
  const isEdit = application !== null;
  const [draft, setDraft] = useState<Draft>(() => draftOf(application));
  const [eventNote, setEventNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  const statusChanged = isEdit && draft.status !== application.status;

  useEffect(() => {
    firstFieldRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = { ...payloadOf(draft), ...(statusChanged && eventNote ? { eventNote } : {}) };
      const res = await fetch(isEdit ? `/api/applications/${application._id}` : "/api/applications", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      onSaved(json.application as Application);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setBusy(false);
    }
  }

  async function remove() {
    if (!isEdit) return;
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
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-stone-900/30 backdrop-blur-sm sm:items-start sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={save}
        className="w-full max-w-4xl rounded-t-2xl border border-[var(--color-edge)] bg-[var(--color-panel)] shadow-2xl sm:my-6 sm:rounded-2xl"
      >
        <header className="flex items-center justify-between gap-4 border-b border-[var(--color-edge)] px-5 py-4">
          <h2 className="text-base font-semibold text-stone-800">
            {isEdit ? `${application.company} — ${application.role}` : "New application"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg px-2 py-1 text-xl leading-none text-stone-500 hover:bg-black/5 hover:text-stone-800"
          >
            ×
          </button>
        </header>

        <div className="grid gap-6 px-5 py-5 lg:grid-cols-[1.6fr_1fr]">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Company">
              <input
                ref={firstFieldRef}
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

            <Field label="Next action" hint="Drives the reminders strip up top.">
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
                placeholder="Follow up with recruiter"
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
                <option value="">—</option>
                {WORK_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Source" hint="LinkedIn, referral, careers page…">
              <input
                className={inputClass}
                value={draft.source}
                onChange={(e) => set("source", e.target.value)}
              />
            </Field>
            <Field label="Salary">
              <input
                className={inputClass}
                placeholder="18-22 LPA"
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

            <Field label="Resume version" hint="Which resume you actually sent.">
              <input
                className={inputClass}
                placeholder="frontend-v3"
                value={draft.resumeVersion}
                onChange={(e) => set("resumeVersion", e.target.value)}
              />
            </Field>
            <label className="flex items-center gap-2.5 self-end pb-2.5 text-sm text-stone-600">
              <input
                type="checkbox"
                className="size-4 accent-indigo-500"
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

          <aside className="lg:border-l lg:border-[var(--color-edge)] lg:pl-6">
            <h3 className="mb-3 text-xs font-medium tracking-wide text-stone-500 uppercase">Timeline</h3>
            {isEdit ? (
              <Timeline events={application.events} />
            ) : (
              <p className="text-sm text-stone-500">History starts once this is saved.</p>
            )}
          </aside>
        </div>

        {error ? (
          <p className="mx-5 mb-3 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-500/30 ring-inset">
            {error}
          </p>
        ) : null}

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-edge)] px-5 py-4">
          <div>
            {isEdit ? (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-stone-500">Delete for good?</span>
                  <button
                    type="button"
                    onClick={remove}
                    disabled={busy}
                    className="rounded-lg bg-rose-500/90 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-500"
                  >
                    Yes, delete
                  </button>
                  <button type="button" onClick={() => setConfirmDelete(false)} className={buttonClass}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="rounded-lg px-3 py-2 text-sm text-rose-600 hover:bg-rose-500/10"
                >
                  Delete
                </button>
              )
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className={buttonClass}>
              Cancel
            </button>
            <button type="submit" disabled={busy} className={primaryButtonClass}>
              {busy ? "Saving…" : isEdit ? "Save changes" : "Add application"}
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}
