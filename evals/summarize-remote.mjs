// Recompute published numbers from raw reports. Never publish partial runs as completed evaluations.
import fs from "node:fs";
import crypto from "node:crypto";
import assert from "node:assert/strict";
const publish = (path, content) => {
  if (process.argv.includes("--check"))
    assert.equal(fs.readFileSync(path, "utf8"), content, `${path} is stale`);
  else fs.writeFileSync(path, content);
};
const read = (name) => JSON.parse(fs.readFileSync(name, "utf8"));
function load(resultPath, casesPath, manifestPath) {
  const result = read(resultPath),
    bytes = fs.readFileSync(casesPath),
    cases = JSON.parse(bytes);
  const hash = crypto.createHash("sha256").update(bytes).digest("hex");
  assert.equal(hash, read(manifestPath).cases_sha256);
  assert.equal(result.provenance.cases_sha256, hash);
  assert.ok(["finished", "stopped_rate_limit"].includes(result.status));
  // A last-case rate limit can set the terminal reason even when every planned request was attempted.
  assert.equal(result.rows.length, cases.length);
  assert.equal(new Set(result.rows.map((r) => r.case_id)).size, cases.length);
  for (const c of cases) {
    const r = result.rows.find((r) => r.case_id === c.id);
    assert.ok(r);
    assert.equal(r.expected_leakage, c.expected_leakage);
    if (r.report) {
      for (const decision of r.report.review_decisions ?? [])
        assert.ok(
          c.request[decision.source]?.includes(decision.quote),
          `Invalid review citation: ${c.id}`,
        );
      for (const finding of r.report.findings) {
        if (finding.rule_cited) continue;
        for (const e of finding.evidence) {
          const field = {
            "task description": "prediction_goal",
            "preprocessing_code.py": "preprocessing_code",
            "model_training_code.py": "model_training_code",
          }[e.source?.filename];
          assert.ok(
            field &&
              e.source?.snippet &&
              c.request[field]?.includes(e.source.snippet),
            `Invalid finding citation: ${c.id}`,
          );
        }
      }

      assert.equal(
        r.report.quality.prompt_version,
        result.provenance.health.prompt_version,
      );
      assert.equal(r.report.quality.model, result.provenance.health.model);
      assert.equal(r.complete, r.report.quality.status === "complete");
      assert.equal(
        r.predicted_leakage,
        r.report.findings.some(
          (f) => f.fine_grained_type !== "missing_metadata",
        ),
      );
    }
  }
  return result;
}
function summarize(result, rows = result.rows) {
  const completed = rows.filter((r) => r.complete);
  const tp = completed.filter(
    (r) => r.expected_leakage && r.predicted_leakage,
  ).length;
  const fp = completed.filter(
    (r) => !r.expected_leakage && r.predicted_leakage,
  ).length;
  const tn = completed.filter(
    (r) => !r.expected_leakage && !r.predicted_leakage,
  ).length;
  const fn = completed.filter(
    (r) => r.expected_leakage && !r.predicted_leakage,
  ).length;
  return {
    version: result.provenance.health.prompt_version,
    total: rows.length,
    completed: completed.length,
    positive_total: rows.filter((r) => r.expected_leakage).length,
    positive_completed: completed.filter((r) => r.expected_leakage).length,
    negative_total: rows.filter((r) => !r.expected_leakage).length,
    negative_completed: completed.filter((r) => !r.expected_leakage).length,
    correct: tp + tn,
    wrong: fp + fn,
    incomplete: rows.length - completed.length,
    tp,
    fp,
    tn,
    fn,
    accuracy: completed.length ? (tp + tn) / completed.length : null,
    precision: tp + fp ? tp / (tp + fp) : null,
    recall: tp + fn ? tp / (tp + fn) : null,
    false_positive_rate: fp + tn ? fp / (fp + tn) : null,
    training_checked: rows.filter((r) =>
      r.report?.quality.stages.some(
        (s) => s.id === "model" && s.status === "done",
      ),
    ).length,
    repaired_stages: rows
      .flatMap((r) => r.report?.quality.stages ?? [])
      .filter((s) => s.status === "done" && s.attempts > 1).length,
    failed_stages: rows
      .flatMap((r) => r.report?.quality.stages ?? [])
      .filter((s) => s.status === "failed").length,
  };
}
const old = load(
  "evals/remote-live-results-2.0.1.json",
  "evals/cases.json",
  "evals/manifest.json",
);
const current = load(
  "evals/remote-live-results-2.1.2.json",
  "evals/cases.json",
  "evals/manifest.json",
);
const extra = load(
  "evals/challenge-live-results-2.1.2.json",
  "evals/challenge-cases-2.1.0.json",
  "evals/challenge-manifest-2.1.0.json",
);
assert.equal(current.provenance.tested_commit, extra.provenance.tested_commit);
assert.equal(
  current.provenance.health.prompt_version,
  extra.provenance.health.prompt_version,
);
const common = new Set(
  old.rows
    .filter(
      (r) =>
        r.complete &&
        current.rows.some((n) => n.complete && n.case_id === r.case_id),
    )
    .map((r) => r.case_id),
);
const summary = {
  baseline: summarize(old),
  current: summarize(current),
  challenge: summarize(extra),
  matched: {
    baseline: summarize(
      old,
      old.rows.filter((r) => common.has(r.case_id)),
    ),
    current: summarize(
      current,
      current.rows.filter((r) => common.has(r.case_id)),
    ),
  },
  tested_commit: current.provenance.tested_commit,
  model: current.provenance.health.model,
  evaluated_at: current.finished_at,
  report: "remote-report-2.1.2.md",
};
publish(
  "src/data/evaluationSummary.json",
  JSON.stringify(summary, null, 2) + "\n",
);
const pct = (n) => (n === null ? "N/A" : (n * 100).toFixed(1) + "%");
const b = summary.baseline,
  n = summary.current,
  e = summary.challenge,
  m = summary.matched;
const failures = (result) =>
  result.rows
    .filter((r) => !r.complete || r.predicted_leakage !== r.expected_leakage)
    .map(
      (r) =>
        `- \`${r.case_id}\`: ${!r.complete ? "覆盖不完整" : r.expected_leakage ? "漏报" : "误报"}`,
    )
    .join("\n") ||
  "本次运行未观察到误报、漏报或覆盖失败；不等于真实场景零错误。";
const report = `# Agent 改进评测：audit-2.1.2

模型：\`${summary.model}\`；代码：\`${summary.tested_commit}\`。原 100 例运行于 ${current.provenance.executed_at} 至 ${current.finished_at}；补充 20 例运行于 ${extra.provenance.executed_at} 至 ${extra.finished_at}（UTC）。

[100 例原始结果](remote-live-results-2.1.2.json) · [20 例补充结果](challenge-live-results-2.1.2.json) · [旧版基线](remote-report-2.0.1.md) · [早期诊断与服务限流记录](pilot-notes-2.1.0.md)

## 同一冻结 100 例：完整性与正确性

| 指标 | audit-2.0.1 | audit-2.1.2 |
|---|---:|---:|
| 已请求 | ${b.total} | ${n.total} |
| 完整且判断正确 | ${b.correct} | ${n.correct} |
| 完整但判断错误 | ${b.wrong} | ${n.wrong} |
| 检查不完整 | ${b.incomplete} | ${n.incomplete} |
| 完整案例中的误报 / 漏报 | ${b.fp} / ${b.fn} | ${n.fp} / ${n.fn} |
| 完整案例准确率 | ${pct(b.accuracy)} (${b.correct}/${b.completed}) | ${pct(n.accuracy)} (${n.correct}/${n.completed}) |
| 完整案例精确率 | ${pct(b.precision)} | ${pct(n.precision)} |
| 完整案例召回率 | ${pct(b.recall)} | ${pct(n.recall)} |
| 完整案例误报率 | ${pct(b.false_positive_rate)} | ${pct(n.false_positive_rate)} |

正例完成：旧版 ${b.positive_completed}/${b.positive_total}，新版 ${n.positive_completed}/${n.positive_total}；负例完成：旧版 ${b.negative_completed}/${b.negative_total}，新版 ${n.negative_completed}/${n.negative_total}。

完整案例分母不同，不能直接将两列条件指标当成相同样本比较。以两版都完成的 ${m.current.total} 例为相同分母：旧版 TP/FP/TN/FN = ${m.baseline.tp}/${m.baseline.fp}/${m.baseline.tn}/${m.baseline.fn}；新版 = ${m.current.tp}/${m.current.fp}/${m.current.tn}/${m.current.fn}。该子集仍受到旧版完成情况的选择影响。

本轮原 100 例中，有 ${n.repaired_stages} 个阶段经一次修复重试后通过，最终 ${n.failed_stages} 个阶段失败。没有把校验失败当作正常无风险，也没有挑选有利的单例重跑替换失败。训练代码检查依然不在原 100 例范围内。

### 原 100 例剩余问题

${failures(current)}

其中，目标编码剩余误报需要重点复核：仅用训练集得到的映射处理测试集，本身不是测试集标签泄漏。不能仅因编码使用了训练标签就判断为泄漏；还需核对训练行的折外边界。复核对同一机制的保留与撤回可能不一致，仍需要人工核对。

第 19 和 100 例因服务限速而未完成。第 19 例初审中存在错误告警，未算作正确案例。第 19 例后降低请求频率，从下一个未尝试案例继续，未重跑替换失败。最后一例触发停止标记时，已请求全部 100 例；停止标记和失败状态均保留在原始记录中。续跑记录：${(current.continuations ?? []).map((c) => `${c.next_case_id} 起间隔 ${c.interval_ms / 1000}s，原始暂停快照 ${c.preserved_snapshot}`).join("；") || "无"}。

## 单独报告：20 个补充挑战案例

${e.completed}/${e.total} 检查完整，${e.correct} 例完整且判断正确；误报 ${e.fp}、漏报 ${e.fn}、检查不完整 ${e.incomplete}。TP/FP/TN/FN = ${e.tp}/${e.fp}/${e.tn}/${e.fn}；完整案例准确率 ${pct(e.accuracy)}。其中 ${e.training_checked} 个案例完成了训练代码检查。

覆盖时间位移、as-of 关联、派生字段、填补、模型/阈值选择、交叉验证预处理、特征选择、重采样、实体泛化。案例在首次 2.1.0 运行前冻结，由同一实现助手编写，不是独立盲测，也不能与原 100 例合并后宣称泛化准确率。

${failures(extra)}

补充案例 008 的全量中位数通过中间变量用于填补，初审未产生告警，说明手工统计变换仍可能漏检。补充案例 020 用测试标签选择阈值后又在同一测试集报告结果，也被漏检。两例初审都没有产生告警。这些问题与旧 100 例的“复核误撤标准变换告警”不同，不能用旧案例的零漏报覆盖这些新发现。

## 改动及边界

- 要求泄漏机制和实际使用路径，先记录输入、边界与反证事实，避免仅凭相关性、导入语句或方法名报警。
- 严格 JSON Schema 约束字段和引用 ID；引用由服务端映射回提交原文，继续校验内容。
- 支持从列赋值和 assign() 识别派生字段名称；这不是完整 Python 数据流分析。
- 撤回必须说明反证类别；阻止将有状态变换误当作无状态、用实体独立性反驳拟合范围问题。
- 校验和可恢复的服务端错误最多重试一次，保留尝试次数和最终失败；鉴权/配额错误不重试。

这些数据是单次合成开发评测。模型输出仍有随机性，案例模板相关，且提示词优化已经使用旧版失败分析。尚需外部业务数据、独立出题、重复运行、复杂跨文件流程与更大输入的检验；不宣称生产零误报/零漏报或业务收益。结构合法、引用真实，也不自动证明推理正确。

[OpenAI 结构化输出文档](https://developers.openai.com/api/docs/guides/structured-outputs)说明了 schema 约束的接口与限制；本项目效果结论只依据上述原始结果。
`;
publish("evals/remote-report-2.1.2.md", report);
console.log(JSON.stringify(summary, null, 2));
