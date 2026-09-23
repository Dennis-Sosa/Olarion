import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditRequest } from "../src/types";
import { knownColumns, derivedColumns } from "../src/lib/featureCatalog";
import { validateRequest } from "./validation";
import { auditPreflight } from "../src/app/lib/auditPreflight";
import { analyze, applyReview } from "./tools/llm/analysis";
import { evidenceCatalog } from "./tools/llm/contracts";
import { reviewAgent } from "./tools/llm/reviewAgent";
import { runAudit, runRules } from "./orchestrator";
import { callOpenAIJson, ModelFailure } from "./openaiClient";
vi.mock("./openaiClient", async (original) => ({
  ...(await original<typeof import("./openaiClient")>()),
  callOpenAIJson: vi.fn(),
}));
const request: AuditRequest = {
  prediction_goal:
    "Predict next month's cancellation at t0. One row per entity.",
  target_column: "y",
  csv_columns: ["spend", "segment", "y"],
  preprocessing_code:
    "df['rate'] = df.groupby('segment')['y'].transform('mean')\nX = df[['rate']]\nX_train, X_test = train_test_split(X)",
};
const finding = {
  title: "Target aggregate in inputs",
  feature: "rate",
  type: "proxy",
  mechanism: "Held-out labels enter segment means",
  used_path: "rate is computed on all rows and selected into X",
  severity: "high",
  confidence: "high",
  reason: "The full-data label mean is computed before splitting.",
  fix: "Use out-of-fold encoding within training and train-only maps on holdout.",
  evidence_id: "preprocessing_code:1",
};
beforeEach(() => {
  vi.mocked(callOpenAIJson).mockReset();
});

describe("derived feature recognition", () => {
  it("accepts actual assignments on client and server without adding fake CSV headers", () => {
    const r = {
      ...request,
      context: {
        used_features: ["rate"],
        feature_availability: { rate: "after" as const },
      },
    };
    expect(knownColumns(r)).toContain("rate");
    expect(validateRequest(r)).toBe(true);
    expect(auditPreflight(r)).toEqual([]);
  });
  it("recognizes assign keywords but not nested function arguments, strings or comments", () => {
    expect(
      derivedColumns({
        ...request,
        preprocessing_code: `# df['fake'] = 1
"""df['doc'] = 2"""
df = df.assign(rate=lambda d: fn(d, unwanted=2), other=lambda d: d['spend'])
X = df[['rate', 'other']]`,
      }),
    ).toEqual(["rate", "other"]);
  });
  it("rejects unknown names and keeps entity IDs tied to CSV columns", () => {
    expect(
      validateRequest({
        ...request,
        context: { used_features: ["imaginary"] },
      }),
    ).toBe(false);
    const r = { ...request, context: { entity_column: "rate" } };
    expect(validateRequest(r)).toBe(false);
    expect(auditPreflight(r).length).toBeGreaterThan(0);
  });
  it("allows a derived feature finding but still rejects made-up fields", async () => {
    vi.mocked(callOpenAIJson).mockResolvedValue({ findings: [finding] });
    const f = await analyze(request, "proxy");
    expect(f[0].flagged_object).toBe("rate");
    expect(f[0].evidence[0].source?.snippet).toContain("groupby");
    const contract = vi.mocked(callOpenAIJson).mock.calls[0][3]!;
    expect(JSON.stringify(contract.schema)).toContain('"enum":["rate"]');
    vi.mocked(callOpenAIJson).mockResolvedValue({
      findings: [{ ...finding, feature: "invented" }],
    });
    await expect(analyze(request, "proxy")).rejects.toThrow("unknown_feature");
  });
});

describe("evidence references and reviews", () => {
  it("retains exact source spans including late lines in long inputs", () => {
    const code = Array.from(
      { length: 1000 },
      (_, i) => `value_${i} = ${i}`,
    ).join("\n");
    const refs = evidenceCatalog({ ...request, preprocessing_code: code });
    for (const r of refs)
      expect(
        (r.source === "preprocessing_code"
          ? code
          : request[r.source])!.includes(r.quote),
      ).toBe(true);
    expect(refs.some((r) => r.quote.includes("value_999 = 999"))).toBe(true);
    expect(refs.length).toBeLessThan(130);
  });
  it("rejects invented evidence IDs rather than silently accepting or dropping them", async () => {
    vi.mocked(callOpenAIJson).mockResolvedValue({
      findings: [{ ...finding, evidence_id: "fake:1" }],
    });
    await expect(analyze(request, "proxy")).rejects.toThrow(
      "invalid_evidence_reference",
    );
  });
  it.each(["MinMaxScaler", "SimpleImputer", "StandardScaler"])(
    "prevents %s being retracted as stateless",
    (klass) => {
      const r = {
        ...request,
        preprocessing_code: `preprocessor = ${klass}()\nX = preprocessor.fit_transform(X)\ntrain_test_split(X)`,
      };
      const f = runRules(r).find(
        (f) => f.id === "pipeline-global-preprocessing",
      )!;
      const d = {
        finding_id: f.id,
        action: "retract",
        basis: "stateless_transform",
        reason: "Independent rows",
        source: "preprocessing_code",
        quote: "X = preprocessor.fit_transform(X)",
      };
      expect(() => applyReview([f], [d], r)).toThrow(
        "stateful_transform_is_not_stateless",
      );
      expect(() =>
        applyReview([f], [{ ...d, basis: "valid_entity_boundary" }], r),
      ).toThrow("retraction_does_not_address_fit_scope");
    },
  );
  it("keeps one decision per finding using schema keys and source references", async () => {
    const f = runRules(request)[0];
    vi.mocked(callOpenAIJson).mockResolvedValue({
      decisions: {
        [f.id]: {
          action: "keep",
          basis: "none",
          reason: "Labels cross the split",
          evidence_id: "preprocessing_code:1",
          severity: "high",
          confidence: "high",
        },
      },
    });
    const r = await reviewAgent(request, [f]);
    expect(r.findings).toEqual([f]);
    expect(r.decisions[0].quote).toContain("groupby");
  });
});

describe("bounded recovery with honest coverage", () => {
  const clean = {
    ...request,
    preprocessing_code: "X = df[['spend']]\ntrain_test_split(X)",
  };
  it("records a recovered contract error without failing otherwise valid checks", async () => {
    vi.mocked(callOpenAIJson).mockImplementation(async (system) => {
      if (
        system.includes("Inspect label copies") &&
        !system.includes("previous attempt failed")
      )
        throw new ModelFailure("invalid_schema");
      return { findings: [] };
    });
    const r = await runAudit(clean);
    expect(r.quality?.status).toBe("complete");
    const stage = r.quality?.stages.find((s) => s.id === "proxy")!;
    expect(stage.attempts).toBe(2);
    expect(stage.recovered_errors).toEqual(["invalid_schema"]);
  });
  it("stops after one repair and retains failed coverage", async () => {
    vi.mocked(callOpenAIJson).mockRejectedValue(
      new ModelFailure("invalid_evidence_reference"),
    );
    const r = await runAudit(clean);
    expect(r.quality?.assessment).toBe("inconclusive");
    expect(r.quality?.stages.find((s) => s.id === "proxy")?.attempts).toBe(2);
    expect(callOpenAIJson).toHaveBeenCalledTimes(6);
  });
  it("never retries authentication failures", async () => {
    vi.mocked(callOpenAIJson).mockRejectedValue(
      new ModelFailure("authentication"),
    );
    const r = await runAudit(clean);
    expect(r.quality?.status).toBe("degraded");
    expect(callOpenAIJson).toHaveBeenCalledTimes(3);
  });
});
