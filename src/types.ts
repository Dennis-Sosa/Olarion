export type MacroBucket =
  | "Time leakage"
  | "Feature / proxy leakage"
  | "Structure / pipeline leakage";

export type FineGrainedLeakageType =
  | "temporal"
  | "proxy"
  | "evaluation"
  | "boundary"
  | "join_entity"
  | "duplicate"
  | "aggregation_lookahead"
  | "label_definition"
  | "missing_metadata";

export type Severity = "low" | "medium" | "high" | "critical";
export type Confidence = "low" | "medium" | "high";

export interface FeatureDictionaryEntry {
  name: string;
  description: string;
}

export interface AuditRequest {
  prediction_goal: string;
  target_column?: string;
  csv_columns: string[];
  preprocessing_code: string;
  model_training_code?: string;
  context?: {
    prediction_time?: string;
    used_features?: string[];
    entity_column?: string;
    entity_repetition?: "unknown" | "unique" | "repeated";
    feature_availability?: Record<string, "before" | "after" | "unknown">;
  };
}

export interface EvidenceItem {
  claim?: string;
  source?: {
    filename: string;
    location: string;
    snippet?: string;
  };
  // Legacy EvidenceCitation fields — some detectors or cached data may use this shape
  text?: string;
  citation_label?: string;
  citation_detail?: string;
  source_type?: string;
}

export interface AuditFinding {
  id: string;
  title: string;
  macro_bucket: MacroBucket;
  fine_grained_type: FineGrainedLeakageType;
  severity: Severity;
  severity_rationale?: string;
  confidence: Confidence;
  flagged_object: string;
  evidence: EvidenceItem[];
  rule_cited?: string;
  escalate_reason?: string | null;
  why_it_matters: string;
  fix_recommendation: string[];
  needs_human_review: boolean;
}

export interface AgentTraceEntry {
  round: number;
  tool_called: string;
  arguments: Record<string, unknown>;
  result_summary: string;
}

export interface AuditReport {
  overall_risk: Severity;
  quality?: {
    status: "complete" | "degraded";
    assessment: "risk_detected" | "no_risk_detected" | "inconclusive";
    stages: AuditStage[];
    model: string;
    prompt_version: string;
    rules_version: string;
    created_at: string;
    duration_ms: number;
    input_scope: string;
  };
  review_decisions?: ReviewDecision[];
  retracted_findings?: AuditFinding[];
  summary: string;
  executive_summary?: string;
  narrative_report: string;
  findings: AuditFinding[];
  missing_metadata: string[];
  clarifying_questions: string[];
  bucket_summary: Record<MacroBucket, number>;
  agent_trace?: AgentTraceEntry[];
}

export interface AgentMessage {
  role: "assistant" | "user";
  content: string;
}

export interface AuditStage {
  id: string;
  status: "done" | "failed" | "skipped";
  duration_ms: number;
  error_code?: string;
}
export interface ReviewDecision {
  finding_id: string;
  action: "keep" | "update" | "retract";
  reason: string;
  source: "prediction_goal" | "preprocessing_code" | "model_training_code";
  quote: string;
  severity?: Severity;
  confidence?: Confidence;
}
export interface FindingFeedback {
  finding_id: string;
  verdict: "confirmed" | "false_positive" | "needs_context";
  note: string;
  updated_at: string;
}
