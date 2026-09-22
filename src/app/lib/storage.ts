import type { AuditReport, AuditRequest } from "../../types";

export interface AuditRecord {
  id: string;
  title: string;
  domain: string;
  caseId?: string;
  createdAt: string;
  request: AuditRequest;
  report: AuditReport;
}

const AUDIT_HISTORY_KEY = "olarion.audit-history";
const CURRENT_AUDIT_KEY = "olarion.current-audit";

function isBrowser() {
  return typeof window !== "undefined";
}

function readHistory(): AuditRecord[] {
  if (!isBrowser()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(AUDIT_HISTORY_KEY);
    const values: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(values)
      ? values.filter(
          (v) =>
            v &&
            typeof v.id === "string" &&
            typeof v.createdAt === "string" &&
            typeof v.title === "string" &&
            v.request &&
            v.report &&
            Array.isArray(v.report.findings),
        )
      : [];
  } catch {
    return [];
  }
}

function writeHistory(records: AuditRecord[]) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(AUDIT_HISTORY_KEY, JSON.stringify(records));
}

export function listAuditRecords(): AuditRecord[] {
  return readHistory().sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );
}

export function getAuditRecord(id: string): AuditRecord | null {
  return listAuditRecords().find((record) => record.id === id) ?? null;
}

export function getCurrentAuditRecord(): AuditRecord | null {
  if (!isBrowser()) {
    return null;
  }

  const currentId = window.localStorage.getItem(CURRENT_AUDIT_KEY);
  if (!currentId) {
    return null;
  }

  return getAuditRecord(currentId);
}

export function setCurrentAuditId(id: string) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(CURRENT_AUDIT_KEY, id);
}

export function saveAuditRecord(record: AuditRecord): AuditRecord {
  const existing = listAuditRecords().filter((item) => item.id !== record.id);
  const nextHistory = [record, ...existing].slice(0, 12);
  writeHistory(nextHistory);
  setCurrentAuditId(record.id);
  return record;
}

export function buildAuditRecord(input: {
  title: string;
  domain: string;
  caseId?: string;
  request: AuditRequest;
  report: AuditReport;
}): AuditRecord {
  return {
    id: `audit-${crypto.randomUUID()}`,
    createdAt: new Date().toISOString(),
    ...input,
  };
}

export function clearLocalRecords() {
  for (const key of [
    AUDIT_HISTORY_KEY,
    CURRENT_AUDIT_KEY,
    "olarion.finding-feedback.v1",
  ])
    window.localStorage.removeItem(key);
}
