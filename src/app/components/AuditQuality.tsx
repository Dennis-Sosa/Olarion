import type { AuditReport } from "../../types";
import { Link } from "react-router";
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
              </span>
            ))}
          </div>
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
