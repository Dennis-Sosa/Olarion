import { useState } from "react";
import type { AuditReport, FindingFeedback as Feedback } from "../../types";
import { readFeedback, saveFeedback } from "../lib/feedback";
export function FindingFeedback({
  report,
  findingId,
}: {
  report: AuditReport;
  findingId: string;
}) {
  const [saved, setSaved] = useState(() =>
    readFeedback(report).find((f) => f.finding_id === findingId),
  );
  const [verdict, setVerdict] = useState<Feedback["verdict"]>(
    saved?.verdict ?? "needs_context",
  );
  const [note, setNote] = useState(saved?.note ?? "");
  const [message, setMessage] = useState(saved ? "Saved on this device" : "");
  const submit = () => {
    if (!note.trim()) {
      setMessage("Add the evidence or context behind your decision.");
      return;
    }
    const value = {
      finding_id: findingId,
      verdict,
      note: note.trim(),
      updated_at: new Date().toISOString(),
    };
    try {
      saveFeedback(report, value);
      setSaved(value);
      setMessage("Saved on this device");
    } catch {
      setMessage("Could not save. Browser storage is unavailable or full.");
    }
  };
  return (
    <details className="px-6 pb-4 text-sm border-b border-slate-100">
      <summary className="cursor-pointer text-slate-600">
        Review this finding {saved ? "· feedback saved" : ""}
      </summary>
      <div className="mt-3 grid gap-3">
        <label>
          Reviewer decision
          <select
            aria-label={`Review decision for ${findingId}`}
            value={verdict}
            onChange={(e) => setVerdict(e.target.value as Feedback["verdict"])}
            className="ml-3 border rounded px-2 py-1 bg-white"
          >
            <option value="needs_context">Needs more context</option>
            <option value="confirmed">Confirmed concern</option>
            <option value="false_positive">False positive</option>
          </select>
        </label>
        <textarea
          aria-label={`Evidence for ${findingId}`}
          maxLength={2000}
          rows={2}
          className="border rounded p-2 w-full"
          placeholder="Evidence, business context or correction…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={submit}
            className="px-3 py-1.5 rounded bg-slate-800 text-white"
          >
            Save feedback
          </button>
          <span role="status" className="text-xs text-slate-600">
            {message}
          </span>
        </div>
      </div>
    </details>
  );
}
