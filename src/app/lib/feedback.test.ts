import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { saveFeedback, readFeedback, regressionCandidate } from "./feedback";
import { listAuditRecords } from "./storage";
import type { AuditReport, AuditRequest, FindingFeedback } from "../../types";
const report = { summary: "Test", findings: [] } as unknown as AuditReport;
const feedback: FindingFeedback = {
  finding_id: "f1",
  verdict: "false_positive",
  note: "Column excluded from X",
  updated_at: "2026-09-22",
};
beforeEach(() => {
  const data = new Map();
  const storage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => data.set(k, v),
    removeItem: (k: string) => data.delete(k),
  };
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("window", { localStorage: storage });
});
afterEach(() => vi.unstubAllGlobals());
it("persists a verdict and replaces its previous value", () => {
  saveFeedback(report, feedback);
  saveFeedback(report, { ...feedback, verdict: "confirmed" });
  expect(readFeedback(report)).toHaveLength(1);
  expect(readFeedback(report)[0].verdict).toBe("confirmed");
});
it("tolerates malformed stored feedback and history", () => {
  localStorage.setItem("olarion.finding-feedback.v1", "bad JSON");
  localStorage.setItem("olarion.audit-history", "{}");
  expect(readFeedback(report)).toEqual([]);
  expect(listAuditRecords()).toEqual([]);
});
it("marks exports as unreviewed candidates without assigning ground truth", () => {
  const data = regressionCandidate({} as AuditRequest, report, [feedback]);
  expect(data.expected_leakage).toBe(null);
  expect(data.status).toBe("requires_human_label_review");
  expect(data.feedback).toEqual([feedback]);
});
it("surfaces storage failures to the UI", () => {
  vi.spyOn(localStorage, "setItem").mockImplementation(() => {
    throw new Error("quota");
  });
  expect(() => saveFeedback(report, feedback)).toThrow("quota");
});
