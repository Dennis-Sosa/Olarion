import { afterAll, beforeAll, it, expect, vi } from "vitest";
import type { Server } from "node:http";
import app from "./app";
vi.mock("./orchestrator", () => ({
  runAudit: vi
    .fn()
    .mockResolvedValue({
      findings: [],
      quality: { status: "degraded", assessment: "inconclusive" },
    }),
}));
let server: Server, url: string;
beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  url = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));
const post = (path: string, body: unknown) =>
  fetch(url + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
it("returns 400 for malformed audit bodies without consuming a valid request slot", async () => {
  expect(
    (await post("/api/audit", { request: { csv_columns: [12] } })).status,
  ).toBe(400);
});
it("returns 400 for missing chat context", async () => {
  expect((await post("/api/chat", { question: "Hello" })).status).toBe(400);
});
it("rejects invalid classify file lists", async () => {
  expect((await post("/api/classify-code", { files: [null] })).status).toBe(
    400,
  );
});
it("returns a degraded report as a report, then rate limits repeated audits", async () => {
  const body = {
    request: {
      prediction_goal: "Predict outcome",
      target_column: "y",
      csv_columns: ["a", "y"],
      preprocessing_code: "X = df[['a']]",
    },
  };
  const res = await post("/api/audit-stream", body);
  expect(res.status).toBe(200);
  expect(await res.text()).toContain('"status":"degraded"');
  const next = await post("/api/audit", body);
  expect(next.status).toBe(429);
  expect(next.headers.get("Retry-After")).toBe("10");
});
