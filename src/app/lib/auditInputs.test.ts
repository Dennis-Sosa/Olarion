import { describe, expect, it } from "vitest";
import { parseCsvHeader, extractCsvColumns } from "./csv";
import { auditPreflight } from "./auditPreflight";
import { validateRequest } from "../../../server/validation";
import type { AuditRequest } from "../../types";

describe("CSV upload boundaries", () => {
  it.each([
    "a,,target",
    "a,target,",
    '"",target',
    "a,a,target",
    '"unfinished,target',
    '"a"oops,target',
  ])(
    "rejects malformed headers instead of silently changing the schema: %s",
    (header) => {
      expect(() => parseCsvHeader(header)).toThrow();
    },
  );
  it("keeps escaped quotes, commas and a UTF-8 BOM in valid header-only files", async () => {
    expect(
      await extractCsvColumns(
        new File(['\uFEFF"a, b","quoted ""name""",target'], "data.CSV"),
      ),
    ).toEqual(["a, b", 'quoted "name"', "target"]);
  });
  it("does not inspect or decode row values", async () => {
    const file = new File(
      ["a,target\n", new Uint8Array([255, 254, 0, 1])],
      "data.csv",
    );
    expect(await extractCsvColumns(file)).toEqual(["a", "target"]);
  });
  it("rejects a non-UTF-8 header with an actionable message", async () => {
    await expect(
      extractCsvColumns(new File([new Uint8Array([255, 254, 65])], "data.csv")),
    ).rejects.toThrow("UTF-8");
  });
  it("rejects non-CSV files and oversized headers", async () => {
    await expect(
      extractCsvColumns(new File(["a,target"], "data.xlsx")),
    ).rejects.toThrow(".csv");
    await expect(
      extractCsvColumns(new File(["a".repeat(65537)], "data.csv")),
    ).rejects.toThrow("64 KB");
  });
  it("enforces the same column limit the server accepts", () => {
    const columns = Array.from({ length: 300 }, (_, i) => `col_${i}`);
    expect(parseCsvHeader(columns.join(","))).toHaveLength(300);
    expect(() => parseCsvHeader([...columns, "extra"].join(","))).toThrow(
      "300",
    );
    expect(() => parseCsvHeader("x".repeat(201))).toThrow("200");
  });
});

const input: AuditRequest = {
  prediction_goal: "Predict outcome at registration.",
  target_column: "y",
  csv_columns: ["a", "y", "user_id"],
  preprocessing_code: "X = df[['a']]",
};
describe("preflight before model calls", () => {
  it("allows missing optional context without pretending it was supplied", () => {
    expect(auditPreflight(input)).toEqual([]);
    expect(validateRequest(input)).toBe(true);
  });
  it("explains the current limitation on derived inputs instead of dropping them", () => {
    const request = {
      ...input,
      context: { used_features: ["a", "derived_score"] },
    };
    expect(auditPreflight(request).join(" ")).toContain("derived_score");
    expect(auditPreflight(request).join(" ")).toContain(
      "Describe derived fields",
    );
    expect(validateRequest(request)).toBe(false);
  });
  it("accepts the exact code-length boundary and blocks longer pasted code on both sides", () => {
    const valid = { ...input, model_training_code: "x".repeat(60000) };
    expect(auditPreflight(valid)).toEqual([]);
    expect(validateRequest(valid)).toBe(true);
    const invalid = {
      ...valid,
      model_training_code: valid.model_training_code + "x",
    };
    expect(auditPreflight(invalid).join(" ")).toContain("60,000");
    expect(validateRequest(invalid)).toBe(false);
    expect(invalid.model_training_code.length).toBe(60001);
  });
  it("reports target, task and preprocessing issues before leaving setup", () => {
    expect(
      auditPreflight({
        ...input,
        target_column: "missing",
        preprocessing_code: "",
        prediction_goal: "",
      }),
    ).toHaveLength(3);
  });
});
