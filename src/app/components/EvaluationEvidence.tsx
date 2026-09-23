import { ArrowUpRight } from "lucide-react";
interface Counts {
  version: string;
  total: number;
  completed: number;
  correct: number;
  wrong: number;
  incomplete: number;
  fp: number;
  fn: number;
  training_checked: number;
  repaired_stages: number;
}
export interface EvaluationData {
  baseline: Counts;
  current: Counts;
  challenge: Counts;
  matched: { baseline: Counts; current: Counts };
  evaluated_at: string;
  model: string;
  tested_commit: string;
  report: string;
}
export function EvaluationEvidence({
  data,
  language,
}: {
  data: EvaluationData;
  language: "en" | "zh";
}) {
  const zh = language === "zh",
    old = data.baseline,
    now = data.current,
    extra = data.challenge;
  const labels = zh
    ? ["检查完整且判断正确", "检查完整但判断错误", "检查覆盖不完整"]
    : [
        "Complete and correctly classified",
        "Complete but misclassified",
        "Incomplete audits",
      ];
  const rows = [
    [zh ? "完成检查" : "Completed audits", old.completed, now.completed],
    [zh ? "完整且正确" : "Complete and correct", old.correct, now.correct],
    [
      zh ? "误报（完整案例）" : "False positives (complete cases)",
      old.fp,
      now.fp,
    ],
    [
      zh ? "漏报（完整案例）" : "False negatives (complete cases)",
      old.fn,
      now.fn,
    ],
    [zh ? "检查不完整" : "Incomplete audits", old.incomplete, now.incomplete],
  ];
  return (
    <>
      <p className="text-xs leading-6 text-slate-500 mt-2">
        {now.version} · {data.model} · {data.evaluated_at.slice(0, 10)} ·{" "}
        {zh ? "单次合成案例实测" : "One recorded synthetic-case run"}
      </p>
      <div className="grid grid-cols-3 gap-3 mt-6 mb-5">
        {[now.correct, now.wrong, now.incomplete].map((value, i) => (
          <div key={labels[i]} className="border-l-2 border-blue-200 pl-3">
            <p className="text-3xl sm:text-4xl font-serif text-slate-900">
              {value}
              <span className="text-sm text-slate-400"> / {now.total}</span>
            </p>
            <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-5">
              {labels[i]}
            </p>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse">
          <caption className="text-left font-medium text-slate-800 mb-3">
            {zh
              ? "相同冻结案例集：新旧版本对比"
              : "Same frozen case set: version comparison"}
          </caption>
          <thead>
            <tr className="border-b text-xs text-slate-500">
              <th className="py-3 pr-3">{zh ? "指标" : "Measure"}</th>
              <th className="py-3 px-2">{old.version}</th>
              <th className="py-3 pl-2">{now.version}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, before, after]) => (
              <tr key={label} className="border-b border-slate-100">
                <th scope="row" className="font-normal py-3 pr-3">
                  {label}
                </th>
                <td className="py-3 px-2">{before}</td>
                <td className="py-3 pl-2 font-medium">{after}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs leading-6 text-slate-500 mt-3">
        {zh
          ? `两版完整案例数不同。只比较两版均完成的 ${data.matched.current.total} 例时：误报 ${data.matched.baseline.fp} → ${data.matched.current.fp}，漏报 ${data.matched.baseline.fn} → ${data.matched.current.fn}。检查失败没有被当作正确负例。`
          : `Completion counts differ. On the ${data.matched.current.total} cases completed by both versions: false positives ${data.matched.baseline.fp} → ${data.matched.current.fp}; false negatives ${data.matched.baseline.fn} → ${data.matched.current.fn}. Failed checks were not counted as correct negatives.`}
      </p>
      <div className="rounded-xl bg-slate-50 p-4 mt-5">
        <h3 className="font-medium text-sm">
          {zh
            ? "另行评测：20 个补充挑战案例"
            : "Separate evaluation: 20 supplemental challenge cases"}
        </h3>
        <p className="text-sm leading-7 text-slate-600 mt-2">
          {zh
            ? `${extra.completed}/${extra.total} 例检查完整，${extra.correct} 例完整且正确；误报 ${extra.fp}、漏报 ${extra.fn}、未完成 ${extra.incomplete}。其中 ${extra.training_checked} 例完成训练代码检查，覆盖模型选择、交叉验证和阈值调优。`
            : `${extra.completed}/${extra.total} audits completed; ${extra.correct} were complete and correct. False positives: ${extra.fp}; false negatives: ${extra.fn}; incomplete: ${extra.incomplete}. Training-code checks completed in ${extra.training_checked} cases covering selection, cross-validation and threshold tuning.`}
        </p>
      </div>
      <p className="text-sm leading-7 text-slate-600 mt-4">
        {zh
          ? "这些是开发用合成案例，新增案例由同一实现助手编写，不是独立盲测。单次结果不能保证真实场景准确率；仍需外部案例、重复运行和人工复核。原 100 例不含训练代码，新增 20 例单独统计。"
          : "These are synthetic development cases, with supplemental cases authored by the same implementation assistant, not an independent blind benchmark. One run cannot establish real-world accuracy. External cases, repeated runs and human review remain necessary. The original 100 cases exclude training code; the additional 20 are reported separately."}
      </p>
      <p className="text-sm leading-7 text-amber-900 mt-3">
        {zh
          ? "已知弱点：正常目标编码仍可能误报；手工统计填补和用测试集选择阈值仍可能漏检。这些场景需重点人工复核。"
          : "Known weaknesses: valid target encoding can still trigger false alarms; hand-written imputation statistics and test-set threshold selection can be missed. Review these cases carefully."}
      </p>
      <a
        href={`https://github.com/Dennis-Sosa/Olarion/blob/main/evals/${data.report}`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 text-sm text-blue-700 mt-4 hover:underline"
      >
        {zh
          ? "查看原始结果、失败案例与评测口径"
          : "Read raw results, failures and methodology"}
        <ArrowUpRight size={16} />
      </a>
    </>
  );
}
