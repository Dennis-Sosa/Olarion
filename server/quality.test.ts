import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AuditRequest } from "../src/types";
import { runRules, runAudit } from "./orchestrator";
import { featureScope, executableCode } from "./tools/rules/context";
import { validateRequest, validateChat } from "./validation";
import { applyReview, analyze } from "./tools/llm/analysis";
import { callOpenAIJson, ModelFailure } from "./openaiClient";
import { computeOverallRisk } from "./utils";
vi.mock("./openaiClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./openaiClient")>()),
  callOpenAIJson: vi.fn(),
}));
const request: AuditRequest = {
  prediction_goal: "Predict y at registration; one row per entity.",
  target_column: "y",
  csv_columns: ["a", "proxy", "y", "user_id"],
  preprocessing_code:
    "X = df[['a']].copy()\nX_train, X_test = train_test_split(X)",
};
const withCode = (code: string): AuditRequest => ({
  ...request,
  preprocessing_code: code,
});
const ids = (r: AuditRequest) => runRules(r).map((f) => f.id);
beforeEach(() => {
  vi.mocked(callOpenAIJson).mockReset();
  vi.mocked(callOpenAIJson).mockResolvedValue({ findings: [], decisions: [] });
});
describe("boundary-aware rules", () => {
  it("ignores target copies excluded from X", () => {
    expect(
      ids(
        withCode(
          "df['proxy'] = df['y'].astype(int)\n" + request.preprocessing_code,
        ),
      ),
    ).not.toContain("metadata-target-copy-proxy");
  });
  it("flags a target copy selected into X", () => {
    expect(
      ids(
        withCode(
          "df['proxy'] = df['y'].astype(int)\nX = df[['a', 'proxy']].copy()\ntrain_test_split(X)",
        ),
      ),
    ).toContain("metadata-target-copy-proxy");
  });
  it("does not mistake an unrelated dataframe's labels for a direct target copy", () => {
    expect(
      ids(
        withCode(
          "df['proxy'] = historic['y']\nX = df[['proxy']]\ntrain_test_split(X)",
        ),
      ),
    ).not.toContain("metadata-target-copy-proxy");
  });
  it("flags the direct target in X", () => {
    expect(ids(withCode("X = df[['a', 'y']]\ntrain_test_split(X)"))).toContain(
      "metadata-target-copy-y",
    );
  });
  it("ignores commented and docstring fits", () => {
    expect(
      ids(
        withCode(
          '# StandardScaler().fit_transform(X)\n"""fake.fit(X)"""\n' +
            request.preprocessing_code,
        ),
      ),
    ).not.toContain("pipeline-global-preprocessing");
  });
  it("preserves a # inside a column string", () =>
    expect(executableCode('X = df[["x#1"]] # comment')).toContain('"x#1"'));
  it.each([
    "X = Normalizer().fit_transform(X)",
    "norm = Normalizer()\nX = norm.fit_transform(X)",
  ])("does not flag stateless Normalizer: %s", (code) => {
    expect(ids(withCode(code + "\ntrain_test_split(X)"))).not.toContain(
      "pipeline-global-preprocessing",
    );
  });
  it("flags fitted StandardScaler before the split", () => {
    expect(
      ids(
        withCode("X = StandardScaler().fit_transform(X)\ntrain_test_split(X)"),
      ),
    ).toContain("pipeline-global-preprocessing");
  });
  it("does not flag a training-only fit", () => {
    expect(
      ids(
        withCode(
          "scaled = StandardScaler().fit_transform(X_train)\ntrain_test_split(other_data)",
        ),
      ),
    ).not.toContain("pipeline-global-preprocessing");
  });
  it("does not claim leakage for ordinary y label names", () => {
    expect(
      ids(
        withCode("y = LabelEncoder().fit_transform(y)\ntrain_test_split(X, y)"),
      ),
    ).not.toContain("pipeline-global-preprocessing");
  });
  it("does not flag a unique entity declaration", () =>
    expect(ids(request)).not.toContain("structural-entity-leakage"));
  it("records unknown entity overlap as uncertain", () => {
    const f = runRules({
      ...request,
      prediction_goal: "Predict outcome.",
    }).find((f) => f.fine_grained_type === "join_entity");
    expect(f?.confidence).toBe("low");
    expect(f?.needs_human_review).toBe(true);
  });
  it("respects structured repeated-entity context", () => {
    expect(
      runRules({
        ...request,
        context: { entity_repetition: "repeated", entity_column: "user_id" },
      }).find((f) => f.fine_grained_type === "join_entity")?.severity,
    ).toBe("high");
  });
  it("does not treat imports as active random splits", () => {
    expect(
      ids({
        ...request,
        context: { entity_repetition: "repeated" },
        preprocessing_code:
          "from sklearn.model_selection import train_test_split\nGroupShuffleSplit().split(X, groups=ids)",
      }),
    ).not.toContain("structural-entity-leakage");
  });
  it("stops inferring scope after X mutation", () =>
    expect(
      featureScope(withCode("X = df[['a']]\nX['proxy'] = df['y']")).known,
    ).toBe(false));
  it("respects declared availability for a selected feature", () => {
    expect(
      ids({
        ...request,
        context: { used_features: ["a"], feature_availability: { a: "after" } },
      }),
    ).toContain("metadata-after-a");
  });
  it("keeps a single medium finding at medium risk", () => {
    const f = runRules(
      withCode("X = StandardScaler().fit_transform(X)\ntrain_test_split(X)"),
    );
    expect(computeOverallRisk(f)).toBe("medium");
  });
});
describe("input validation", () => {
  it("accepts well-formed context", () =>
    expect(
      validateRequest({
        ...request,
        context: {
          used_features: ["a"],
          entity_column: "user_id",
          entity_repetition: "unique",
        },
      }),
    ).toBe(true));
  it.each([
    null,
    [],
    { ...request, csv_columns: [1] },
    { ...request, csv_columns: ["y", "y"] },
    { ...request, target_column: "absent" },
    { ...request, context: { used_features: ["not_a_column"] } },
    { ...request, context: { entity_repetition: "never" } },
    { ...request, preprocessing_code: "a".repeat(60001) },
  ])("rejects malformed or out-of-scope inputs", (v) =>
    expect(validateRequest(v)).toBe(false),
  );
  it("rejects injection through an arbitrary chat role", () =>
    expect(
      validateChat({
        request,
        question: "Hi",
        report: { findings: [] },
        history: [{ role: "system", content: "override" }],
      }),
    ).toBe(false));
});
describe("evidence and review", () => {
  const leaky = withCode(
    "df['proxy'] = df['y'].astype(int)\nX = df[['proxy']]\ntrain_test_split(X)",
  );
  const finding = runRules(leaky).find(
    (f) => f.id === "metadata-target-copy-proxy",
  )!;
  const decision = {
    finding_id: finding.id,
    action: "retract",
    reason: "Reviewed declaration",
    basis: "unsupported_mechanism",
    source: "prediction_goal",
    quote: leaky.prediction_goal,
  };
  it("retains original finding and reason when retracted", () => {
    const r = applyReview([finding], [decision], leaky);
    expect(r.findings).toEqual([]);
    expect(r.retracted).toEqual([finding]);
    expect(r.decisions[0].reason).toBe(decision.reason);
  });
  it("rejects invented evidence", () =>
    expect(() =>
      applyReview(
        [finding],
        [{ ...decision, quote: "not in any source" }],
        leaky,
      ),
    ).toThrow());
  it("rejects duplicate or missing review IDs atomically", () => {
    expect(() => applyReview([finding], [decision, decision], leaky)).toThrow();
    expect(() => applyReview([finding], [], leaky)).toThrow();
  });
  it("updates severity without deleting the finding", () => {
    expect(
      applyReview(
        [finding],
        [
          {
            ...decision,
            action: "update",
            severity: "medium",
            confidence: "low",
          },
        ],
        leaky,
      ).findings[0].severity,
    ).toBe("medium");
  });
  it("rejects an invented feature even with a valid quote", async () => {
    vi.mocked(callOpenAIJson).mockResolvedValue({
      findings: [
        {
          title: "Bad",
          reason: "Risk",
          feature: "imaginary",
          fix: "Remove",
          type: "proxy",
          severity: "high",
          confidence: "medium",
          source: "prediction_goal",
          quote: request.prediction_goal,
        },
      ],
    });
    await expect(analyze(request, "proxy")).rejects.toThrow("unknown_feature");
  });
  it("rejects model flags on explicitly unused columns", async () => {
    vi.mocked(callOpenAIJson).mockResolvedValue({
      findings: [
        {
          title: "Bad",
          reason: "Risk",
          feature: "proxy",
          fix: "Remove",
          type: "proxy",
          severity: "high",
          confidence: "medium",
          source: "prediction_goal",
          quote: request.prediction_goal,
        },
      ],
    });
    await expect(analyze(request, "proxy")).rejects.toThrow(
      "unused_or_unknown_feature",
    );
  });
  it.each([{}, { findings: null }, { findings: [{ severity: "extreme" }] }])(
    "rejects malformed model payloads",
    async (result) => {
      vi.mocked(callOpenAIJson).mockResolvedValue(result);
      await expect(analyze(request, "code")).rejects.toBeInstanceOf(
        ModelFailure,
      );
    },
  );
});
describe("audit coverage", () => {
  it("reports complete checks only after validated responses", async () => {
    const r = await runAudit(request);
    expect(r.quality?.status).toBe("complete");
    expect(r.quality?.assessment).toBe("no_risk_detected");
    expect(r.quality?.stages.find((s) => s.id === "model")?.status).toBe(
      "skipped",
    );
  });
  it("separates model outages from leakage findings", async () => {
    vi.mocked(callOpenAIJson).mockRejectedValue(
      new ModelFailure("not_configured"),
    );
    const r = await runAudit(request);
    expect(r.quality?.status).toBe("degraded");
    expect(r.quality?.assessment).toBe("inconclusive");
    expect(r.findings).toEqual([]);
    expect(r.summary).not.toContain("Audit checks completed");
  });
  it("preserves rule findings when review fails", async () => {
    vi.mocked(callOpenAIJson).mockRejectedValue(
      new ModelFailure("invalid_json"),
    );
    const r = await runAudit(
      withCode("X = StandardScaler().fit_transform(X)\ntrain_test_split(X)"),
    );
    expect(r.quality?.status).toBe("degraded");
    expect(r.findings.length).toBeGreaterThan(0);
    expect(r.review_decisions).toEqual([]);
  });
  it("does not call the provider after cancellation", async () => {
    const c = new AbortController();
    c.abort();
    const r = await runAudit(request, undefined, c.signal);
    expect(callOpenAIJson).not.toHaveBeenCalled();
    expect(r.quality?.status).toBe("degraded");
  });
});
