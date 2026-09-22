import type { AuditReport, AuditRequest } from "../types";

export interface ThinkingStep {
  id: string;
  status: "running" | "done" | "skipped" | "failed";
  title: string;
  detail?: string;
  timestamp: number;
}

export async function auditWithLLM(
  request: AuditRequest,
): Promise<AuditReport> {
  const response = await fetch("/api/audit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ request }),
  });

  const text = await response.text();
  const payload =
    text.length > 0
      ? (JSON.parse(text) as { report?: AuditReport; error?: string })
      : {};

  if (!response.ok) {
    throw new Error(
      payload.error ?? `Audit request failed: ${response.status}`,
    );
  }

  const { report } = payload;
  if (!report) {
    throw new Error("Audit response did not include a report.");
  }

  return report;
}

export async function auditWithStream(
  request: AuditRequest,
  onStep: (step: ThinkingStep) => void,
  signal?: AbortSignal,
): Promise<AuditReport> {
  const response = await fetch("/api/audit-stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ request }),
    signal,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(
      payload.error ?? `Audit request failed: ${response.status}`,
    );
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");
  const decoder = new TextDecoder();
  let buffer = "",
    report: AuditReport | null = null;
  const consume = (line: string) => {
    if (!line.startsWith("data:")) return;
    let event;
    try {
      event = JSON.parse(line.slice(5).trim());
    } catch {
      throw new Error("Invalid audit stream event.");
    }
    if (event.type === "error")
      throw new Error(event.message ?? "Audit failed");
    if (event.type === "step") onStep({ ...event, timestamp: Date.now() });
    if (event.type === "complete") {
      if (!event.report || !Array.isArray(event.report.findings))
        throw new Error("Invalid audit report.");
      report = event.report;
    }
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += done
        ? decoder.decode()
        : decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) consume(line.trimEnd());
      if (done) {
        if (buffer.trim()) consume(buffer.trimEnd());
        break;
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  if (!report) throw new Error("Audit stream ended without a report.");
  return report;
}

export async function chatWithLLM(
  question: string,
  report: AuditReport,
  request: AuditRequest,
  history: Array<{ role: string; content: string }>,
): Promise<string> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, report, request, history }),
  });

  const text = await response.text();
  const payload =
    text.length > 0
      ? (JSON.parse(text) as { answer?: string; error?: string })
      : {};

  if (!response.ok) {
    throw new Error(payload.error ?? `Chat request failed: ${response.status}`);
  }

  const { answer } = payload;
  if (!answer) {
    throw new Error("Chat response did not include an answer.");
  }

  return answer;
}
