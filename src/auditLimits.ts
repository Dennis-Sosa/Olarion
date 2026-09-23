/** Shared by upload validation and the API. Lengths are JavaScript characters. */
export const AUDIT_LIMITS = {
  columns: 300,
  columnName: 200,
  goal: 12_000,
  code: 60_000,
  predictionTime: 2_000,
  csvHeaderBytes: 65_536,
  zipBytes: 10 * 1024 * 1024,
  pythonFiles: 10,
} as const;
