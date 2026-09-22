import { afterEach, describe, it, expect, vi } from "vitest";
import { auditWithStream } from "./llmEngine";
import type { AuditRequest } from "../types";
const request = {} as AuditRequest;
function mockStream(chunks: string[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        new ReadableStream({
          start(c) {
            for (const chunk of chunks)
              c.enqueue(new TextEncoder().encode(chunk));
            c.close();
          },
        }),
      ),
    ),
  );
}
afterEach(() => vi.unstubAllGlobals());
describe("SSE audit reader", () => {
  it("does not swallow custom server errors", async () => {
    mockStream(['data: {"type":"error","message":"Service unavailable"}\n\n']);
    await expect(auditWithStream(request, () => {})).rejects.toThrow(
      "Service unavailable",
    );
  });
  it("handles fragmented JSON and an unterminated final line", async () => {
    mockStream(['data: {"ty', 'pe":"complete","report":{"findings":[]}}']);
    await expect(auditWithStream(request, () => {})).resolves.toMatchObject({
      findings: [],
    });
  });
  it("rejects invalid JSON instead of silently dropping it", async () => {
    mockStream(["data: broken\n"]);
    await expect(auditWithStream(request, () => {})).rejects.toThrow(
      "Invalid audit stream",
    );
  });
  it("reports a disconnected stream without a report", async () => {
    mockStream([": heartbeat\n\n"]);
    await expect(auditWithStream(request, () => {})).rejects.toThrow(
      "without a report",
    );
  });
  it("delivers failed steps and skips heartbeat lines", async () => {
    mockStream([
      ": heartbeat\n",
      'data: {"type":"step","id":"proxy","status":"failed"}\n',
      'data: {"type":"complete","report":{"findings":[]}}\n',
    ]);
    const step = vi.fn();
    await auditWithStream(request, step);
    expect(step).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed" }),
    );
  });
});
