import { motion } from "motion/react";
import { Link, useNavigate } from "react-router";
import {
  FileText,
  Calendar,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { AmbientBackground } from "../components/AmbientBackground";
import { FloatingChat } from "../components/FloatingChat";
import { Navigation } from "../components/Navigation";
import { Footer } from "../components/Footer";
import {
  listAuditRecords,
  clearLocalRecords,
  type AuditRecord,
} from "../lib/storage";

function deleteAuditRecord(id: string) {
  const key = "olarion.audit-history";
  try {
    const raw = window.localStorage.getItem(key);
    const records: AuditRecord[] = raw ? JSON.parse(raw) : [];
    window.localStorage.setItem(
      key,
      JSON.stringify(records.filter((r) => r.id !== id)),
    );
  } catch {
    /* ignore */
  }
}

export function PastAudits() {
  const navigate = useNavigate();
  const [records, setRecords] = useState<AuditRecord[]>(() =>
    listAuditRecords(),
  );

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    deleteAuditRecord(id);
    setRecords(listAuditRecords());
  };

  const handleView = (record: AuditRecord) => {
    navigate("/results", {
      state: {
        report: record.report,
        request: record.request,
        fromHistory: true,
      },
    });
  };

  const fadeUpVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <div className="min-h-screen relative">
      <Navigation />

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <AmbientBackground variant="subtle" />
      </div>

      <div className="h-20" />

      <motion.section
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
        className="max-w-5xl mx-auto px-8 pt-12 pb-8 relative z-10"
      >
        <motion.div variants={fadeUpVariants} className="mb-8">
          <h1 className="font-serif text-4xl mb-3 text-[var(--foreground)]">
            Past Audits
          </h1>
          <p className="text-base text-[var(--muted-foreground)] max-w-2xl">
            Review local audit reports, including partial and unverified
            results.
          </p>
        </motion.div>

        <motion.div
          variants={fadeUpVariants}
          className="flex items-center justify-between mb-8"
        >
          <div className="flex items-center gap-4">
            <div className="px-4 py-2 rounded-lg bg-white border border-[var(--border)]">
              <span className="text-sm text-[var(--muted-foreground)]">
                {records.length} {records.length === 1 ? "audit" : "audits"}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  "Delete all audit history and feedback from this browser?",
                )
              ) {
                clearLocalRecords();
                setRecords([]);
              }
            }}
            className="text-sm text-red-700 underline"
          >
            Clear local history &amp; feedback
          </button>
          <Link
            to="/setup"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[var(--primary)] text-white hover:bg-[var(--accent-primary)] transition-colors"
          >
            <span>New Audit</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>
      </motion.section>

      <motion.section
        initial="hidden"
        animate="visible"
        variants={{
          visible: { transition: { staggerChildren: 0.1, delayChildren: 0.2 } },
        }}
        className="max-w-5xl mx-auto px-8 pb-16 relative z-10"
      >
        <div className="space-y-4">
          {records.map((record) => {
            const { report } = record;
            const criticalCount = report.findings.filter(
              (f) => f.severity === "critical",
            ).length;
            const highCount = report.findings.filter(
              (f) => f.severity === "high",
            ).length;
            const mediumCount = report.findings.filter(
              (f) => f.severity === "medium",
            ).length;
            const dateStr = new Date(record.createdAt).toLocaleDateString(
              "en-US",
              {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              },
            );

            return (
              <motion.div key={record.id} variants={fadeUpVariants}>
                <div
                  onClick={() => handleView(record)}
                  className="block bg-white rounded-lg border border-[var(--border)] p-6 hover:border-[var(--accent-primary)] hover:shadow-md transition-all group cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="w-12 h-12 rounded-lg bg-[var(--secondary)] flex items-center justify-center border border-[var(--border)] group-hover:bg-[var(--accent-primary-pale)] transition-colors">
                        <FileText className="w-6 h-6 text-[var(--accent-primary)]" />
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg text-[var(--foreground)] group-hover:text-[var(--accent-primary)] transition-colors line-clamp-1">
                            {record.title}
                          </h3>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 text-green-700 text-xs border border-green-200 flex-shrink-0">
                            <CheckCircle className="w-3 h-3" />
                            {report.quality?.status === "complete"
                              ? "Checks completed"
                              : "Partial / unverified"}
                          </span>
                          <RiskPill
                            severity={
                              !report.quality ||
                              report.quality.assessment === "inconclusive"
                                ? "inconclusive"
                                : report.overall_risk
                            }
                          />
                        </div>

                        <div className="flex items-center gap-4 mb-3">
                          <div className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground)]">
                            <Calendar className="w-4 h-4" />
                            {dateStr}
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          {criticalCount > 0 && (
                            <div className="flex items-center gap-1.5 text-sm">
                              <div className="w-2 h-2 rounded-full bg-red-500" />
                              <span className="text-[var(--muted-foreground)]">
                                {criticalCount} critical
                              </span>
                            </div>
                          )}
                          {highCount > 0 && (
                            <div className="flex items-center gap-1.5 text-sm">
                              <div className="w-2 h-2 rounded-full bg-amber-500" />
                              <span className="text-[var(--muted-foreground)]">
                                {highCount} high
                              </span>
                            </div>
                          )}
                          {mediumCount > 0 && (
                            <div className="flex items-center gap-1.5 text-sm">
                              <div className="w-2 h-2 rounded-full bg-yellow-500" />
                              <span className="text-[var(--muted-foreground)]">
                                {mediumCount} medium
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 ml-4">
                      <button
                        type="button"
                        onClick={(e) => handleDelete(e, record.id)}
                        className="p-2 rounded-lg text-[var(--muted-foreground)] hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Delete audit"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <ArrowRight className="w-5 h-5 text-[var(--muted-foreground)] group-hover:text-[var(--accent-primary)] group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {records.length === 0 && (
          <motion.div
            variants={fadeUpVariants}
            className="bg-white rounded-lg border border-[var(--border)] p-12 text-center"
          >
            <FileText className="w-12 h-12 text-[var(--muted-foreground)] mx-auto mb-4" />
            <h3 className="text-lg mb-2 text-[var(--foreground)]">
              No audits yet
            </h3>
            <p className="text-sm text-[var(--muted-foreground)] mb-6">
              Start your first audit to detect model leakage
            </p>
            <Link
              to="/setup"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[var(--primary)] text-white hover:bg-[var(--accent-primary)] transition-colors"
            >
              <span>Start Audit</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        )}
      </motion.section>

      <Footer />
      <FloatingChat context="landing" />
    </div>
  );
}

function RiskPill({ severity }: { severity: string }) {
  const styles: Record<string, string> = {
    critical: "bg-red-50 text-red-700 border-red-200",
    high: "bg-orange-50 text-orange-700 border-orange-200",
    medium: "bg-amber-50 text-amber-700 border-amber-200",
    low: "bg-lime-50 text-lime-700 border-lime-200",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border font-semibold uppercase tracking-wide flex-shrink-0 ${styles[severity] ?? styles.medium}`}
    >
      {severity === "critical" && <AlertTriangle className="w-3 h-3" />}
      {severity}
    </span>
  );
}
