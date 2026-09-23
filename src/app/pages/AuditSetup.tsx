import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  ArrowRight,
  Upload,
  FileText,
  Code,
  AlertCircle,
  Clock,
  Network,
  Layers,
  Archive,
  CheckCircle2,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import JSZip from "jszip";
import { Navigation } from "../components/Navigation";
import { Footer } from "../components/Footer";
import { FloatingChat } from "../components/FloatingChat";
import { AmbientBackground } from "../components/AmbientBackground";
import { extractCsvColumns } from "../lib/csv";
import { derivedColumns } from "../../lib/featureCatalog";
import { auditPreflight } from "../lib/auditPreflight";
import { AUDIT_LIMITS } from "../../auditLimits";
import { AUDIT_TASK_TEMPLATE } from "../../data/auditGuide";
import type { AuditRequest } from "../../types";
import {
  LEGAL_CLEAN_CSV,
  LEGAL_CLEAN_PREPROCESSING,
  LEGAL_CLEAN_CONFIG,
  LEGAL_LEAKY_CSV,
  LEGAL_LEAKY_PREPROCESSING,
  LEGAL_LEAKY_CONFIG,
} from "../../data/legalQuickFill";

export function AuditSetup() {
  const navigate = useNavigate();
  const [taskDescription, setTaskDescription] = useState("");
  const [targetColumn, setTargetColumn] = useState("");
  const [datasetFile, setDatasetFile] = useState<File | null>(null);
  const [preprocessingCode, setPreprocessingCode] = useState("");
  const [trainingCode, setTrainingCode] = useState("");
  const [predictionTime, setPredictionTime] = useState("");
  const [usedFeatures, setUsedFeatures] = useState("");
  const [entityColumn, setEntityColumn] = useState("");
  const [afterFeatures, setAfterFeatures] = useState("");
  const [entityRepetition, setEntityRepetition] = useState<
    "unknown" | "unique" | "repeated"
  >("unknown");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [zipProcessing, setZipProcessing] = useState(false);
  const [zipStatus, setZipStatus] = useState<string | null>(null);

  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvChecking, setCsvChecking] = useState(false);
  const [zipFiles, setZipFiles] = useState<
    Array<{ filename: string; content: string }>
  >([]);
  const [preprocessingFile, setPreprocessingFile] = useState("");
  const [trainingFile, setTrainingFile] = useState("");
  const recognizedDerived = useMemo(
    () =>
      derivedColumns({
        csv_columns: csvColumns,
        preprocessing_code: preprocessingCode,
        model_training_code: trainingCode,
      }),
    [csvColumns, preprocessingCode, trainingCode],
  );

  useEffect(() => {
    let active = true;
    setCsvColumns([]);
    setCsvError(null);
    setCsvChecking(!!datasetFile);
    if (datasetFile) {
      extractCsvColumns(datasetFile)
        .then((columns) => {
          if (active) setCsvColumns(columns);
        })
        .catch((error: unknown) => {
          if (active)
            setCsvError(
              error instanceof Error
                ? error.message
                : "Could not read the CSV header.",
            );
        })
        .finally(() => {
          if (active) setCsvChecking(false);
        });
    }
    return () => {
      active = false;
    };
  }, [datasetFile]);

  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setZipProcessing(true);
    setZipStatus("Reading ZIP file…");
    setSubmitError(null);
    try {
      if (file.size > AUDIT_LIMITS.zipBytes)
        throw new Error("ZIP files must be at most 10 MB.");
      const zip = await JSZip.loadAsync(file);
      const csvFiles: Array<{ name: string; file: JSZip.JSZipObject }> = [];
      const pyFiles: Array<{ name: string; file: JSZip.JSZipObject }> = [];
      zip.forEach((relativePath, entry) => {
        if (
          entry.dir ||
          relativePath
            .split("/")
            .some((part) => part.startsWith(".") || part === "__MACOSX")
        )
          return;
        if (relativePath.toLowerCase().endsWith(".csv"))
          csvFiles.push({ name: relativePath, file: entry });
        if (relativePath.toLowerCase().endsWith(".py"))
          pyFiles.push({ name: relativePath, file: entry });
      });
      if (csvFiles.length !== 1)
        throw new Error(
          "Use a ZIP with exactly one CSV. Select the dataset for this audit before uploading.",
        );
      if (!pyFiles.length || pyFiles.length > AUDIT_LIMITS.pythonFiles)
        throw new Error("Use 1–10 Python files per ZIP.");
      const csvFile = new File(
        [await csvFiles[0].file.async("blob")],
        csvFiles[0].name.split("/").pop()!,
        { type: "text/csv" },
      );
      await extractCsvColumns(csvFile);
      const codeFiles = await Promise.all(
        pyFiles.map(async (item) => {
          const content = await item.file.async("string");
          if (content.length > AUDIT_LIMITS.code)
            throw new Error(
              `${item.name} exceeds 60,000 characters. Include the relevant complete workflow in a smaller file.`,
            );
          return { filename: item.name, content };
        }),
      );
      // Apply only after all inputs validate. The user chooses the code roles;
      // no scripts are silently selected or sent to a model for classification.
      setDatasetFile(csvFile);
      setZipFiles(codeFiles);
      setPreprocessingFile(codeFiles.length === 1 ? codeFiles[0].filename : "");
      setPreprocessingCode(codeFiles.length === 1 ? codeFiles[0].content : "");
      setTrainingFile("");
      setTrainingCode("");
      setZipStatus(
        `Loaded ${csvFile.name} and ${codeFiles.length} Python file(s). Review the selected code below.`,
      );
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Could not read the ZIP. Check the upload guide.",
      );
      setZipStatus(null);
    } finally {
      setZipProcessing(false);
      e.target.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!datasetFile) {
      setSubmitError("Please upload a training CSV.");
      return;
    }

    setIsSubmitting(true);
    try {
      const csv_columns = await extractCsvColumns(datasetFile);
      const target = targetColumn.trim();
      if (!csv_columns.includes(target)) {
        setSubmitError(
          `Target column "${target}" is not in the CSV header. Headers found: ${csv_columns.join(", ")}`,
        );
        return;
      }

      const explicit = usedFeatures
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);
      const after = afterFeatures
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);
      const request: AuditRequest = {
        prediction_goal: taskDescription.trim(),
        target_column: target,
        csv_columns,
        preprocessing_code: preprocessingCode.trim(),
        model_training_code: trainingCode.trim() || undefined,
        context: {
          prediction_time: predictionTime.trim() || undefined,
          used_features: explicit.length ? explicit : undefined,
          entity_column: entityColumn.trim() || undefined,
          entity_repetition: entityRepetition,
          feature_availability: after.length
            ? Object.fromEntries(after.map((c) => [c, "after" as const]))
            : undefined,
        },
      };

      const errors = auditPreflight(request);
      if (errors.length) {
        setSubmitError(errors.join(" "));
        return;
      }
      navigate("/results", { state: { request } });
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Could not read the CSV file.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit =
    taskDescription.trim() !== "" &&
    targetColumn.trim() !== "" &&
    datasetFile !== null &&
    preprocessingCode.trim() !== "" &&
    !isSubmitting &&
    !zipProcessing &&
    !csvChecking &&
    !csvError;

  // Keyboard quick-fill: matches `test dataset/*/Prediction task description.txt` + `Target column name.txt`
  // (health-clean vs health-leaky share the same txts; legal-clean/leaky and finance-clean/leaky each share the same txts.)
  const HEALTH_TASK =
    "Predict whether a hospitalized adult will meet criteria for sepsis or septic shock within the first 24 hours of an emergency department encounter, using only information that would be available at the time clinicians must decide on early escalation (triage through early ED course).";
  const LEGAL_TASK =
    "Predict whether a defendant will be found guilty in a criminal case.";
  const FINANCE_TASK =
    "Predict whether a loan applicant will default on their loan based on financial profile and credit history.";

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "1") {
        setTaskDescription(HEALTH_TASK);
        setTargetColumn("sepsis_within_24h");
      } else if (e.key === "2") {
        setTaskDescription(LEGAL_TASK);
        setTargetColumn("found_guilty");
      } else if (e.key === "3") {
        setTaskDescription(FINANCE_TASK);
        setTargetColumn("loan_defaulted");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const applyLegalQuickFill = (
    csv: string,
    preprocessing: string,
    config: {
      prediction_goal: string;
      target_column: string;
      csv_filename: string;
    },
  ) => {
    const blob = new Blob([csv], { type: "text/csv" });
    const file = new File([blob], config.csv_filename, { type: "text/csv" });
    setDatasetFile(file);
    setZipFiles([]);
    setPreprocessingFile("");
    setTrainingFile("");
    setZipStatus(null);
    setTaskDescription(config.prediction_goal);
    setTargetColumn(config.target_column);
    setPreprocessingCode(preprocessing);
    setTrainingCode("");
    setPredictionTime("");
    setUsedFeatures("");
    setAfterFeatures("");
    setEntityColumn("");
    setEntityRepetition("unknown");
    setSubmitError(null);
  };

  const handleLegalCleanQuickFill = () => {
    applyLegalQuickFill(
      LEGAL_CLEAN_CSV,
      LEGAL_CLEAN_PREPROCESSING,
      LEGAL_CLEAN_CONFIG,
    );
  };

  const handleLegalLeakyQuickFill = () => {
    applyLegalQuickFill(
      LEGAL_LEAKY_CSV,
      LEGAL_LEAKY_PREPROCESSING,
      LEGAL_LEAKY_CONFIG,
    );
  };

  const fadeUpVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <div className="min-h-screen relative">
      {/* Navigation */}
      <Navigation />

      {/* Ambient background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <AmbientBackground variant="subtle" />
      </div>

      {/* Navigation spacing */}
      <div className="h-20" />

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-12 relative z-10">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            visible: { transition: { staggerChildren: 0.1 } },
          }}
        >
          {/* Page Header */}
          <motion.div variants={fadeUpVariants} className="mb-12">
            <h1 className="text-3xl mb-3 text-[var(--foreground)]">
              Audit Setup
            </h1>
            <p className="text-base text-[var(--muted-foreground)] max-w-2xl">
              Review an ML workflow using CSV headers, Python code and a clear
              prediction boundary.
            </p>
            <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-sm leading-6 text-blue-950">
              <p>
                Only headers are read from your CSV. Row values are not analyzed
                and Python is not executed. More rows do not increase this
                version’s accuracy.
              </p>
              <Link
                to="/guide"
                className="inline-flex items-center gap-1 mt-2 font-medium text-blue-700 hover:underline"
              >
                Upload requirements &amp; examples <ArrowRight size={14} />
              </Link>
              <span className="mx-3 text-blue-200">|</span>
              <Link
                to="/guide?lang=zh"
                className="text-blue-700 hover:underline"
              >
                中文上传指南
              </Link>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleLegalCleanQuickFill}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border)]/60 bg-white/60 hover:bg-white hover:border-[var(--accent-primary)]/40 text-sm text-[var(--foreground)] transition-colors"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Quick Fill: Legal (clean)
              </button>
              <button
                type="button"
                onClick={handleLegalLeakyQuickFill}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-amber-500/35 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/50 text-sm text-[var(--foreground)] transition-colors"
              >
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Quick Fill: Legal (leaky)
              </button>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Form - Left Column (2 cols) */}
            <div className="min-w-0 lg:col-span-2 space-y-8">
              <form onSubmit={handleSubmit} className="space-y-8">
                {/* Step 1 — ZIP Upload */}
                <motion.div variants={fadeUpVariants}>
                  <div className="mb-4">
                    <h2 className="text-lg text-[var(--foreground)] mb-1">
                      Upload your project
                    </h2>
                    <p className="text-sm text-[var(--muted-foreground)]">
                      Upload a ZIP, or add a CSV and paste code below. Review
                      which files are included before running the audit.
                    </p>
                  </div>
                  <div className="relative">
                    <input
                      type="file"
                      accept=".zip"
                      aria-label="Upload project ZIP"
                      onChange={handleZipUpload}
                      disabled={zipProcessing}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div
                      className={`border-2 border-dashed rounded-xl px-6 py-8 text-center transition-all ${
                        zipProcessing
                          ? "border-[var(--accent-primary)]/60 bg-[var(--accent-primary-pale)]"
                          : datasetFile && preprocessingCode
                            ? "border-emerald-300/60 bg-emerald-50/40"
                            : "border-[var(--border)]/60 bg-white/50 hover:border-[var(--accent-primary)]/40 hover:bg-white/70"
                      }`}
                    >
                      <div className="flex flex-col items-center gap-2">
                        {zipProcessing ? (
                          <Loader2 className="w-7 h-7 text-[var(--accent-primary)] animate-spin" />
                        ) : datasetFile && preprocessingCode ? (
                          <CheckCircle2 className="w-7 h-7 text-emerald-500" />
                        ) : (
                          <Archive className="w-7 h-7 text-[var(--muted-foreground)]" />
                        )}
                        <p className="text-sm font-medium text-[var(--foreground)]">
                          {zipProcessing
                            ? zipStatus
                            : datasetFile && preprocessingCode
                              ? "Dataset and code ready — review below"
                              : "Drop a ZIP file here, or click to browse"}
                        </p>
                        {datasetFile && preprocessingCode ? (
                          <div className="flex items-center gap-4 mt-1">
                            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600">
                              <FileText className="w-3.5 h-3.5" />
                              {datasetFile.name}
                            </span>
                            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600">
                              <Code className="w-3.5 h-3.5" />
                              Code extracted
                            </span>
                          </div>
                        ) : (
                          <p className="text-xs text-[var(--muted-foreground)]">
                            One CSV · 1–10 Python files · ZIP at most 10 MB
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  {zipStatus && !zipProcessing && (
                    <p role="status" className="mt-3 text-sm text-slate-600">
                      {zipStatus}
                    </p>
                  )}
                  {zipFiles.length > 0 && (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-white/70 p-5 space-y-4">
                      <h3 className="text-sm font-medium">Choose code roles</h3>
                      <p className="text-xs text-slate-600 leading-6">
                        Only the code in the two inputs below is audited. Other
                        scripts are not included automatically; paste any
                        relevant helper logic into those inputs.
                      </p>
                      <label className="block text-sm">
                        Preprocessing file
                        <select
                          aria-label="Preprocessing file"
                          value={preprocessingFile}
                          onChange={(e) => {
                            const name = e.target.value;
                            setPreprocessingFile(name);
                            setPreprocessingCode(
                              zipFiles.find((f) => f.filename === name)
                                ?.content ?? "",
                            );
                          }}
                          className="mt-2 w-full min-w-0 rounded-lg border border-slate-200 bg-white p-2 text-sm"
                        >
                          <option value="">
                            Choose a file, or paste code below
                          </option>
                          {zipFiles.map((file) => (
                            <option
                              key={file.filename}
                              value={file.filename}
                              disabled={file.filename === trainingFile}
                            >
                              {file.filename}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-sm">
                        Training file (optional)
                        <select
                          aria-label="Training file"
                          value={trainingFile}
                          onChange={(e) => {
                            const name = e.target.value;
                            setTrainingFile(name);
                            setTrainingCode(
                              zipFiles.find((f) => f.filename === name)
                                ?.content ?? "",
                            );
                          }}
                          className="mt-2 w-full min-w-0 rounded-lg border border-slate-200 bg-white p-2 text-sm"
                        >
                          <option value="">
                            Not supplied — training checks will be skipped
                          </option>
                          {zipFiles.map((file) => (
                            <option
                              key={file.filename}
                              value={file.filename}
                              disabled={file.filename === preprocessingFile}
                            >
                              {file.filename}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  )}
                </motion.div>

                {/* Step 2 — Task Details (always manual) */}
                <motion.div variants={fadeUpVariants}>
                  <div className="mb-4">
                    <h2 className="text-lg text-[var(--foreground)] mb-1">
                      Task details
                    </h2>
                    <p className="text-sm text-[var(--muted-foreground)]">
                      Describe your prediction goal and the target column.
                    </p>
                  </div>
                  <div className="space-y-5">
                    <div>
                      <label className="block text-sm text-[var(--foreground)] mb-2">
                        Prediction task description
                        <span className="text-[var(--risk-critical)] ml-1">
                          *
                        </span>
                      </label>
                      <textarea
                        aria-label="Prediction task description"
                        value={taskDescription}
                        onChange={(e) => setTaskDescription(e.target.value)}
                        placeholder="Example: Predict 30-day hospital readmission for heart failure patients at discharge time"
                        className="w-full px-4 py-3 rounded-lg border border-[var(--border)]/60 bg-white/60 backdrop-blur-sm focus:outline-none focus:border-[var(--accent-primary)] transition-all resize-none text-sm"
                        rows={3}
                        required
                      />
                      <p className="text-xs text-[var(--muted-foreground)] mt-1.5">
                        Include the outcome window, prediction time and
                        evaluation population. Up to 12,000 characters.
                      </p>
                    </div>
                    <details className="rounded-lg border border-slate-200 bg-white/60 p-4 text-sm">
                      <summary className="cursor-pointer font-medium">
                        View a task description example
                      </summary>
                      <p className="mt-3 text-xs text-slate-500">
                        Adapt this example to your own data; it is not a
                        verified safe pipeline.
                      </p>
                      <pre className="mt-3 whitespace-pre-wrap break-words text-xs leading-6 text-slate-600">
                        {AUDIT_TASK_TEMPLATE.en}
                      </pre>
                    </details>
                    <div>
                      <label className="block text-sm text-[var(--foreground)] mb-2">
                        Target column name
                        <span className="text-[var(--risk-critical)] ml-1">
                          *
                        </span>
                      </label>
                      <input
                        type="text"
                        aria-label="Target column name"
                        value={targetColumn}
                        onChange={(e) => setTargetColumn(e.target.value)}
                        placeholder="Must match the CSV header exactly (e.g. readmitted_30d)"
                        className="w-full px-4 py-3 rounded-lg border border-[var(--border)]/60 bg-white/60 backdrop-blur-sm focus:outline-none focus:border-[var(--accent-primary)] transition-all text-sm font-mono"
                        required
                      />
                      <p className="text-xs text-[var(--muted-foreground)] mt-1.5">
                        {targetColumn.trim() && csvColumns.length
                          ? csvColumns.includes(targetColumn.trim())
                            ? "Target matched to the CSV header."
                            : "This target is not in the CSV header; check its spelling."
                          : "Use the exact name of the outcome column in your CSV."}
                      </p>
                    </div>
                  </div>
                </motion.div>

                {/* Step 3 — Manual data & code (only if ZIP not used) */}
                {
                  <motion.div variants={fadeUpVariants}>
                    <div className="relative flex items-center gap-4 py-2 mb-6">
                      <div className="flex-1 border-t border-[var(--border)]/60" />
                      <span className="text-xs text-[var(--muted-foreground)] uppercase tracking-wider">
                        review dataset and code
                      </span>
                      <div className="flex-1 border-t border-[var(--border)]/60" />
                    </div>
                    <div className="space-y-6">
                      <div>
                        <label className="block text-sm text-[var(--foreground)] mb-2">
                          Training dataset (CSV)
                          <span className="text-[var(--risk-critical)] ml-1">
                            *
                          </span>
                        </label>
                        <FileUploadArea
                          file={datasetFile}
                          onFileSelect={setDatasetFile}
                          accept=".csv"
                          placeholder="Upload CSV file or drag and drop"
                        />
                        <p className="text-xs text-[var(--muted-foreground)] mt-1.5">
                          UTF-8 CSV, comma-separated. Up to 300 unique, nonempty
                          column names. A header-only CSV is sufficient.
                        </p>
                        {csvChecking && (
                          <p
                            role="status"
                            className="mt-2 text-xs text-blue-700"
                          >
                            Checking CSV headers…
                          </p>
                        )}
                        {csvError && (
                          <p role="alert" className="mt-2 text-sm text-red-700">
                            {csvError}
                          </p>
                        )}
                        {!!csvColumns.length && (
                          <details className="mt-3 text-xs text-slate-600">
                            <summary className="cursor-pointer">
                              {csvColumns.length} valid columns — inspect
                              headers
                            </summary>
                            <p className="mt-2 break-words leading-6">
                              {csvColumns.join(", ")}
                            </p>
                          </details>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm text-[var(--foreground)] mb-2">
                          Preprocessing code
                          <span className="text-[var(--risk-critical)] ml-1">
                            *
                          </span>
                        </label>
                        <CodeInput
                          label="Preprocessing code"
                          value={preprocessingCode}
                          onChange={setPreprocessingCode}
                          placeholder="# Paste your feature engineering and preprocessing code here
# Example:
# df['age_at_admission'] = (df['admission_date'] - df['birth_date']).dt.days / 365
# df['readmission_flag'] = df['readmission_date'].notna()"
                        />
                        <p className="text-xs text-[var(--muted-foreground)] mt-1.5">
                          Include feature creation, joins, splitting and when
                          transforms are fitted. Keep the real workflow,
                          including suspicious steps.
                        </p>
                      </div>
                    </div>
                  </motion.div>
                }

                {/* Optional — model training code */}
                <motion.div variants={fadeUpVariants}>
                  <div className="pt-6 border-t border-[var(--border)]/60 mb-4">
                    <h2 className="text-sm text-[var(--muted-foreground)] mb-0.5">
                      Optional
                    </h2>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      Providing training code helps detect additional
                      pipeline-level leakage.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm text-[var(--foreground)] mb-2">
                      Model training code
                    </label>
                    <CodeInput
                      label="Model training code"
                      value={trainingCode}
                      onChange={setTrainingCode}
                      placeholder="# Optional: paste your model training and evaluation code
# Example:
# from sklearn.model_selection import train_test_split
# X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)
# model.fit(X_train, y_train)"
                      rows={6}
                    />
                    <p className="text-xs text-[var(--muted-foreground)] mt-1.5">
                      Train/test split logic, model fitting and evaluation.
                      Without this input, training-code checks are skipped.
                    </p>
                  </div>
                </motion.div>

                <fieldset className="rounded-xl border border-slate-200 p-5 space-y-4">
                  <legend className="text-sm font-medium px-2">
                    Analysis context — recommended
                  </legend>
                  <p className="text-xs text-slate-500">
                    These fields are optional. Accurate context helps
                    distinguish actual leakage from a valid predictor, but
                    cannot guarantee a correct conclusion.
                  </p>
                  <label className="block text-sm">
                    When is the prediction made?
                    <input
                      aria-label="Prediction time"
                      value={predictionTime}
                      onChange={(e) => setPredictionTime(e.target.value)}
                      maxLength={AUDIT_LIMITS.predictionTime}
                      placeholder="e.g. At application submission, before approval"
                      className="mt-1 w-full border rounded p-2 bg-white"
                    />
                  </label>
                  <label className="block text-sm">
                    Features actually used (comma-separated)
                    <input
                      aria-label="Used features"
                      value={usedFeatures}
                      onChange={(e) => setUsedFeatures(e.target.value)}
                      placeholder="e.g. age, prior_spend"
                      className="mt-1 w-full border rounded p-2 bg-white"
                    />
                  </label>
                  <p className="text-xs text-slate-500 leading-6">
                    List all actual inputs using CSV names or fields recognized
                    from Python column assignments and assign() calls. Explain
                    derived fields and their availability in the task and code.
                    Leave this list blank if it cannot express the complete
                    input set; do not list only part of the model inputs.
                  </p>
                  {recognizedDerived.length > 0 && (
                    <p
                      className="text-xs leading-6 text-blue-800 rounded-lg bg-blue-50 p-3"
                      role="status"
                    >
                      Recognized derived field names:{" "}
                      {recognizedDerived.join(", ")}. You can include these in
                      the feature lists. Name recognition does not establish
                      whether a field is used or safe.
                    </p>
                  )}
                  <label className="block text-sm">
                    Columns known only after prediction (comma-separated)
                    <input
                      aria-label="Unavailable features"
                      value={afterFeatures}
                      onChange={(e) => setAfterFeatures(e.target.value)}
                      placeholder="e.g. final_outcome, refund_amount"
                      className="mt-1 w-full border rounded p-2 bg-white"
                    />
                  </label>
                  <label className="block text-sm">
                    Entity column
                    <input
                      aria-label="Entity column"
                      value={entityColumn}
                      onChange={(e) => setEntityColumn(e.target.value)}
                      placeholder="e.g. customer_id"
                      className="mt-1 w-full border rounded p-2 bg-white"
                    />
                  </label>
                  <label className="block text-sm">
                    Do entities repeat?
                    <select
                      aria-label="Entity repetition"
                      value={entityRepetition}
                      onChange={(e) =>
                        setEntityRepetition(
                          e.target.value as typeof entityRepetition,
                        )
                      }
                      className="mt-1 w-full border rounded p-2 bg-white"
                    >
                      <option value="unknown">
                        Unknown — requires verification
                      </option>
                      <option value="unique">One row per entity</option>
                      <option value="repeated">Multiple rows per entity</option>
                    </select>
                  </label>
                  <p className="text-xs text-slate-500 leading-6">
                    Describe the split method in your task and code. State
                    whether evaluation should represent new entities or
                    returning ones; repeated entities alone do not decide the
                    correct split.
                  </p>
                </fieldset>
                <p className="text-xs text-slate-500">
                  Only CSV headers are submitted. Code, headers and context are
                  sent to our API and OpenAI; no Python is executed. Reports and
                  feedback are saved in this browser.
                </p>
                {/* Submit */}
                <motion.div variants={fadeUpVariants} className="pt-4">
                  {submitError && (
                    <p
                      className="text-sm text-[var(--risk-critical)] mb-4 px-1"
                      role="alert"
                    >
                      {submitError}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className={`w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-lg text-white transition-all ${
                      canSubmit
                        ? "bg-[var(--primary)] hover:bg-[var(--accent-primary)] cursor-pointer"
                        : "bg-gray-300 cursor-not-allowed"
                    }`}
                  >
                    <span className="font-medium">
                      {isSubmitting ? "Preparing…" : "Run Audit"}
                    </span>
                    <ArrowRight className="w-5 h-5" />
                  </button>
                  {!canSubmit && !isSubmitting && (
                    <p className="text-xs text-[var(--muted-foreground)] text-center mt-3">
                      {!datasetFile
                        ? "Upload a ZIP or provide a CSV dataset"
                        : csvError
                          ? "Fix the CSV header issue above to continue"
                          : csvChecking
                            ? "Checking CSV headers…"
                            : !preprocessingCode.trim()
                              ? "Choose a preprocessing file or paste its code"
                              : "Fill in task description and target column to continue"}
                    </p>
                  )}
                </motion.div>
              </form>
            </div>

            {/* Info Panel - Right Column */}
            <motion.div variants={fadeUpVariants} className="col-span-1">
              <div className="bg-white/60 backdrop-blur-sm rounded-xl border border-[var(--border)]/60 p-6 sticky top-28">
                <h3 className="text-base text-[var(--foreground)] mb-4">
                  Before you run
                </h3>
                <ul className="space-y-3 mb-6 pb-6 border-b border-slate-200 text-sm">
                  {[
                    {
                      ready: csvColumns.length > 0 && !csvError && !csvChecking,
                      label: "CSV headers validated",
                    },
                    {
                      ready:
                        !!taskDescription.trim() &&
                        csvColumns.includes(targetColumn.trim()),
                      label: "Task and matching target",
                    },
                    {
                      ready:
                        !!preprocessingCode.trim() &&
                        preprocessingCode.length <= AUDIT_LIMITS.code,
                      label: "Preprocessing code supplied",
                    },
                  ].map((item) => (
                    <li key={item.label} className="flex items-center gap-2">
                      <CheckCircle2
                        size={16}
                        className={
                          item.ready ? "text-emerald-600" : "text-slate-300"
                        }
                      />
                      <span>{item.label}</span>
                      <span className="sr-only">
                        {item.ready ? "Ready" : "Needed"}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-slate-600 leading-6 mb-5">
                  {trainingCode.trim()
                    ? "Training code is included in this audit."
                    : "No training code yet: training checks will be skipped."}{" "}
                  {predictionTime.trim()
                    ? "Prediction time is declared."
                    : "Add prediction time to clarify feature availability."}
                </p>
                <h3 className="text-base text-[var(--foreground)] mb-4">
                  What the agent reviews
                </h3>

                <div className="space-y-4">
                  <AuditTypeCard
                    icon={Clock}
                    title="Temporal Leakage"
                    description="Detects features using post-prediction information"
                  />
                  <AuditTypeCard
                    icon={Network}
                    title="Feature / Proxy Leakage"
                    description="Identifies target proxies and leaked variables"
                  />
                  <AuditTypeCard
                    icon={Layers}
                    title="Pipeline Leakage"
                    description="Audits train/test splits and transformations"
                  />
                </div>

                <div className="mt-6 pt-6 border-t border-[var(--border)]">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-[var(--accent-primary)] flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                        A completed report still needs review. Check evidence
                        and withdrawn findings; an incomplete audit cannot
                        establish safety.
                        <Link
                          to="/guide#results"
                          className="block mt-2 text-blue-700 hover:underline"
                        >
                          How to read coverage and findings
                        </Link>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>

      {/* Footer */}
      <Footer />

      {/* Floating Chat Assistant */}
      <FloatingChat context="setup" />
    </div>
  );
}

// File Upload Component
function FileUploadArea({
  file,
  onFileSelect,
  accept,
  placeholder,
}: {
  file: File | null;
  onFileSelect: (file: File | null) => void;
  accept: string;
  placeholder: string;
}) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    onFileSelect(selectedFile);
  };

  return (
    <div className="relative">
      <input
        type="file"
        accept={accept}
        aria-label="Upload CSV"
        onChange={handleFileChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        required={!file}
      />
      <div
        className={`border-2 border-dashed rounded-lg px-6 py-8 text-center transition-all ${
          file
            ? "border-[var(--accent-primary)] bg-[var(--accent-primary-pale)]"
            : "border-[var(--border)]/60 bg-white/50 hover:border-[var(--accent-primary)]/50 hover:bg-white/70"
        }`}
      >
        {file ? (
          <div className="flex items-center justify-center gap-3">
            <FileText className="w-5 h-5 text-[var(--accent-primary)]" />
            <div className="text-left">
              <p className="text-sm text-[var(--foreground)]">{file.name}</p>
              <p className="text-xs text-[var(--muted-foreground)]">
                {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="w-6 h-6 text-[var(--muted-foreground)]" />
            <p className="text-sm text-[var(--muted-foreground)]">
              {placeholder}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Code Input Component
function CodeInput({
  label,
  value,
  onChange,
  placeholder,
  rows = 8,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  rows?: number;
}) {
  return (
    <div className="relative">
      <div className="absolute top-3 left-3 z-10">
        <Code className="w-4 h-4 text-[var(--muted-foreground)]" />
      </div>
      <textarea
        aria-label={label}
        aria-invalid={value.length > AUDIT_LIMITS.code}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-4 py-3 rounded-lg border border-[var(--border)]/60 bg-white/60 backdrop-blur-sm focus:outline-none focus:border-[var(--accent-primary)] transition-all resize-none font-mono text-xs"
        rows={rows}
        style={{ fontFamily: "ui-monospace, monospace" }}
      />
      <p
        className={`mt-1 text-xs ${value.length > AUDIT_LIMITS.code ? "text-red-700" : "text-slate-500"}`}
        role={value.length > AUDIT_LIMITS.code ? "alert" : undefined}
      >
        {value.length.toLocaleString()} / {AUDIT_LIMITS.code.toLocaleString()}{" "}
        characters
        {value.length > AUDIT_LIMITS.code
          ? " — shorten this input while preserving the relevant workflow. Code has not been truncated."
          : ""}
      </p>
    </div>
  );
}

// Audit Type Card Component
function AuditTypeCard({
  icon: Icon,
  title,
  description,
}: {
  icon: any;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{
          background:
            "linear-gradient(135deg, #A7BFFB 0%, #BFDBFE 50%, #D4E8FF 100%)",
        }}
      >
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div>
        <h4 className="text-sm text-[var(--foreground)] mb-1">{title}</h4>
        <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
}
