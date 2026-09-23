import type { AuditReport } from "../../types";
import { Link } from "react-router";
function failureHelp(code: string): string {
  if (code === "quota_exhausted")
    return "The model provider reports exhausted quota. The service owner must restore provider quota before another audit can complete.";
  if (code === "rate_limited")
    return "The model provider is temporarily rate-limiting requests. Wait before starting another audit; completed checks are preserved here.";
  if (code === "authentication" || code === "not_configured")
    return "The model service needs a valid server-side configuration. Contact the service owner.";
  if (code === "rate_or_quota_limit")
    return "The provider blocked a request because of a rate or quota limit. The service owner needs to check the provider status.";
  if (code === "timeout_or_cancelled" || code === "provider_unavailable")
    return "A check timed out or the provider was unavailable. Retry later; this report does not establish complete coverage.";
  return "A model result did not pass evidence or output validation. This check remains unresolved; review the source and findings before relying on the report.";
}
export function AuditQuality({ report }: { report: AuditReport }) {
  const q = report.quality,
    partial = !q || q.status === "degraded";
  return (
    <section
      aria-label="Audit coverage"
      className={`mb-6 rounded-xl border p-5 ${partial ? "bg-amber-50 border-amber-200 text-amber-950" : "bg-slate-50 border-slate-200 text-slate-800"}`}
    >
      <h2 className="font-semibold mb-2">
        {!q
          ? "Legacy report · coverage not recorded"
          : partial
            ? "Partial audit · some checks were unavailable"
            : "Audit coverage recorded"}
      </h2>
      <p className="text-sm">
        {partial
          ? "Do not interpret a low score or an empty findings list as a clean audit. Review the failed checks and supplied context; resolve the issue before relying on a rerun."
          : "Checks returned validated responses. Findings still need verification against actual data and deployment context."}
      </p>
      {q?.stages.some((s) => s.id === "review" && s.status === "failed") && (
        <p className="text-sm mt-2 font-medium">
          Findings below are preliminary: the review stage did not complete.
          They may include false alarms and must be verified before acting.
        </p>
      )}
      <Link
        to="/guide#results"
        className="inline-block mt-2 text-sm text-blue-700 underline underline-offset-2"
      >
        How to interpret coverage and review findings
      </Link>
      {q && (
        <>
          <div className="flex flex-wrap gap-2 mt-3">
            {q.stages.map((s) => (
              <span
                key={s.id}
                className="text-xs border rounded-full px-2 py-1 bg-white/70"
              >
                {s.id}: {s.status}
                {s.error_code ? ` (${s.error_code})` : ""}
                {(s.attempts ?? 1) > 1 ? ` · ${s.attempts} attempts` : ""}
                {s.status === "done" && s.recovered_errors?.length
                  ? " · recovered"
                  : ""}
              </span>
            ))}
          </div>
          {q.stages.some((s) => s.status === "failed") && (
            <ul className="mt-3 text-sm space-y-2 list-disc pl-5">
              {[
                ...new Set(
                  q.stages
                    .filter((s) => s.status === "failed")
                    .map((s) => failureHelp(s.error_code ?? "unknown")),
                ),
              ].map((help) => (
                <li key={help}>{help}</li>
              ))}
            </ul>
          )}
          <details className="mt-3 text-xs">
            <summary className="cursor-pointer">Scope and version</summary>
            <p className="mt-2">
              {q.input_scope}. No dataset rows or model performance were
              measured.
            </p>
            <p>
              {q.model} · prompts {q.prompt_version} · rules {q.rules_version} ·{" "}
              {(q.duration_ms / 1000).toFixed(1)}s
            </p>
          </details>
        </>
      )}
      {!!report.retracted_findings?.length && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer">
            {report.retracted_findings.length} findings retracted after review
          </summary>
          {report.review_decisions
            ?.filter((d) => d.action === "retract")
            .map((d) => (
              <div key={d.finding_id} className="mt-2">
                <strong>
                  {
                    report.retracted_findings?.find(
                      (f) => f.id === d.finding_id,
                    )?.title
                  }
                </strong>
                <p>{d.reason}</p>
                <blockquote className="border-l-2 pl-2 mt-1">
                  {d.source}: {d.quote}
                </blockquote>
              </div>
            ))}
        </details>
      )}
    </section>
  );
}
