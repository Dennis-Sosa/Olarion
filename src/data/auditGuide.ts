export const AUDIT_TASK_TEMPLATE = {
  en: `Prediction goal: Predict whether a user will churn in the next 30 days.
Prediction time: 00:00 on the first day of each month.
Target column: churn_next_30d
Actual model inputs: logins_prior_30d, spend_prior_30d, tenure_days
Feature window: The 30 days before prediction; all inputs are available then.
Post-prediction columns: active_days_next_30d, churn_next_30d
Entity: user_id; the same user can have multiple monthly records.
Split and evaluation: Train on earlier months, test on later months; deployment includes returning users. Explain how label windows stay within the training cutoff.
Derived fields: List each new field, its source columns, calculation and availability time.`,
  zh: `预测目标：预测用户未来 30 天是否流失。
预测时点：每月 1 日零点。
目标列：churn_next_30d
实际模型输入：logins_prior_30d、spend_prior_30d、tenure_days
特征窗口：预测前 30 天；所有输入在预测时已可获得。
预测后字段：active_days_next_30d、churn_next_30d
实体：user_id；同一用户可能有多个月度记录。
切分与评估：用较早月份训练、较晚月份测试；上线预测包含老用户。说明如何确保训练标签的观察窗口不越过训练截止时点。
派生字段：逐项说明新字段的来源、计算方法，以及何时可获得。`,
};

export const AUDIT_GUIDE = {
  en: {
    eyebrow: "PREPARE YOUR AUDIT",
    title: "Better context. Clearer findings.",
    intro:
      "Prepare the files, explain the prediction boundary, and understand what an Olarion audit can establish.",
    start: "Set up an audit",
    download: "Download task example",
    scopeTitle: "A review of your ML workflow",
    scope:
      "Olarion reviews CSV headers, Python code and your declared context. CSV row values stay in your browser and Python is not executed. More CSV rows do not make this version more accurate.",
    scopeDetail:
      "Headers, submitted code and context are sent to our API and OpenAI. Actual correlations, entity overlap and performance changes need separate checks on your data.",
    materialsTitle: "What to provide",
    required: "Required",
    recommended: "Recommended",
    materials: [
      {
        title: "CSV field structure",
        required: true,
        text: "Use a UTF-8, comma-separated .csv with a single header line. Names must be nonempty and unique; the target column must be present.",
        detail:
          "Up to 300 columns · 200 characters per name · 64 KB header. A header-only CSV is sufficient for this static review; no minimum row count.",
      },
      {
        title: "Prediction task",
        required: true,
        text: "Describe the outcome, the exact moment of prediction, and how far into the future the label is observed.",
        detail:
          "Up to 12,000 characters. A precise goal helps distinguish a valid historical feature from future information.",
      },
      {
        title: "Preprocessing code",
        required: true,
        text: "Include feature creation, joins, missing-value handling, scaling, encoding and data splitting. Keep the code you actually want audited.",
        detail:
          "Up to 60,000 characters. Show which data is used to fit each transform and which columns reach the model.",
      },
      {
        title: "Training & evaluation code",
        required: false,
        text: "Include model fitting, parameter selection, validation and test evaluation to extend the audit scope.",
        detail:
          "Up to 60,000 characters. Without it, training-code checks are skipped. A completed report only covers the inputs supplied.",
      },
    ],
    zipTitle: "Using a ZIP? Review the file roles.",
    zipText:
      "Upload one ZIP of at most 10 MB containing exactly one CSV and 1–10 Python files. For multiple scripts, choose one preprocessing file and an optional training file. Other scripts are not automatically audited; copy relevant helper logic into the selected code inputs.",
    contextTitle: "Four details that help reduce ambiguity",
    contextIntro:
      "These fields are optional in the form, but strongly recommended. Accurate context helps; it does not guarantee a correct finding.",
    context: [
      [
        "Actual model inputs",
        "Separate fields stored in the raw table from fields actually passed to the model. A suspicious column that is excluded is not itself a leak.",
      ],
      [
        "When information is available",
        "State the prediction time, feature windows and fields only known afterwards. Predictiveness alone is not evidence of leakage.",
      ],
      [
        "Entities and evaluation population",
        "Identify users, orders or other entities, whether they repeat, and whether deployment predicts new entities or returning ones.",
      ],
      [
        "Splits and fitting order",
        "Show the split method and when scaling, imputation and encoding are fitted. Explain fold boundaries and how labels are used.",
      ],
    ],
    derivedTitle: "Code-generated fields need an explanation",
    derived:
      "The form’s feature lists currently accept CSV column names only. Describe new fields, their source columns and creation logic in the task description and code. Leave the explicit feature list blank if it cannot represent all actual inputs; an incomplete list can mislead the audit. Do not invent CSV headers just to pass validation.",
    templateTitle: "An example of useful task context",
    templateIntro:
      "Adapt the fields, timing and evaluation setup to your own project. This example is not a certification that a pipeline is safe.",
    resultsTitle: "Read coverage before conclusions",
    results: [
      [
        "Completed checks",
        "The applicable checks returned validated outputs. Evidence and reasoning still need verification; completion is not proof of correctness.",
      ],
      [
        "Incomplete coverage",
        "One or more checks failed. An empty report or low risk score cannot establish safety. Inspect the failed checks before relying on the result.",
      ],
      [
        "A concern or retraction",
        "Check the source quote, whether the field is used, and when the information is available. Review withdrawn findings too; report a false positive with supporting evidence.",
      ],
    ],
    evidenceTitle: "What our current evaluation shows",
    evidenceIntro:
      "Recorded baseline · prompt audit-2.0.1 · 100 synthetic paired cases · September 2026",
    stats: [
      "Complete and correctly classified",
      "Complete but misclassified",
      "Incomplete audits",
    ],
    evidenceDetail:
      "85 reports completed; among those, 16 were false positives and 4 were false negatives. These synthetic development cases are not an independent benchmark or a promise of real-world accuracy. Training-code checks were outside this run’s scope.",
    evidenceLink: "Read all results and failure cases",
    nextTitle: "Improvements still to validate",
    nextIntro:
      "This guide and upload checks improve input clarity. They do not establish improved model accuracy. The next model iteration needs to:",
    next: [
      "Require a specific leakage mechanism, rather than treating predictive features as suspicious.",
      "Require counterevidence before retracting a supported finding; surface unresolved disagreements.",
      "Improve derived-field tracking and structured outputs while preserving evidence checks.",
      "Rerun regression tests and independently authored unseen cases, measuring missed risks, false alarms and completion separately.",
    ],
    closing: "Ready to explain your prediction boundary?",
  },
  zh: {
    eyebrow: "上传与审计指南",
    title: "说明业务边界，让审计有据可查。",
    intro:
      "准备所需材料，补充预测时点与实际输入，并了解 Olarion 能检查到什么范围。",
    start: "开始填写审计",
    download: "下载任务描述示例",
    scopeTitle: "审查你的机器学习流程",
    scope:
      "Olarion 分析 CSV 表头、Python 代码和你提供的业务上下文。CSV 行级数值留在浏览器，Python 代码不会执行。增加 CSV 行数不会直接提高当前版本的准确率。",
    scopeDetail:
      "表头、提交的代码和业务描述会发送给我们的 API 与 OpenAI。实际相关性、实体重叠和模型表现变化，需要另外用真实数据验证。",
    materialsTitle: "需要准备的材料",
    required: "必填",
    recommended: "建议提供",
    materials: [
      {
        title: "CSV 字段结构",
        required: true,
        text: "使用 UTF-8 编码、逗号分隔的 .csv，第一行是表头。字段名必须非空且唯一，目标列必须存在。",
        detail:
          "最多 300 列，每个字段名最多 200 字符，表头不超过 64 KB。当前静态审查可使用仅含表头的 CSV，没有最低行数要求。",
      },
      {
        title: "预测任务描述",
        required: true,
        text: "说明预测什么、在什么时点预测，以及标签对应未来多长时间的结果。",
        detail:
          "最多 12,000 字符。明确的预测任务有助于区分正常历史特征与预测后信息。",
      },
      {
        title: "预处理代码",
        required: true,
        text: "保留实际待审计的特征生成、关联、缺失值填补、标准化、编码和数据切分步骤。",
        detail:
          "最多 60,000 字符。说明每个变换用哪些数据拟合，以及哪些字段最终进入模型。",
      },
      {
        title: "训练与评估代码",
        required: false,
        text: "提供模型拟合、参数选择、验证和测试评估代码，可扩展审计范围。",
        detail:
          "最多 60,000 字符。不提供时，训练代码检查会跳过；报告完整只表示已提供材料范围内的适用检查完成。",
      },
    ],
    zipTitle: "使用 ZIP 时，请核对代码角色。",
    zipText:
      "ZIP 不超过 10 MB，包含且仅包含一个 CSV，以及 1–10 个 Python 文件。多脚本时请选择一个预处理文件和可选的训练文件；其他脚本不会自动参与审计。请将有关的辅助逻辑补入对应代码框。",
    contextTitle: "减少歧义的四项上下文",
    contextIntro:
      "这些信息在表单中为选填，但强烈建议补充。完整、准确的上下文有帮助，不能保证模型结论正确。",
    context: [
      [
        "实际使用的特征",
        "区分原始表中保存的字段与真正进入模型的字段。可疑字段若被明确排除，本身不构成泄漏。",
      ],
      [
        "信息何时可获得",
        "说明预测时点、特征窗口和预测后才获得的字段。特征有预测力，本身不是泄漏证据。",
      ],
      [
        "实体与评估对象",
        "说明用户、订单等实体标识，实体是否重复，以及上线后预测新实体还是已有实体。",
      ],
      [
        "切分方式与拟合顺序",
        "保留数据切分和标准化、填补、编码的拟合顺序；说明交叉验证的折间边界与标签使用方式。",
      ],
    ],
    derivedTitle: "代码生成的新字段，需要说明来源",
    derived:
      "目前表单的特征列表只接受 CSV 中已有的列。请在任务描述和代码中说明派生字段的来源与生成逻辑。如果列表无法表达全部实际输入，请留空并详细描述，避免不完整的声明误导审计。无需为通过校验而编造 CSV 表头。",
    templateTitle: "一份有用的任务描述示例",
    templateIntro:
      "请根据实际项目调整字段、时点和评估设置。该示例不代表流程已经被证明安全。",
    resultsTitle: "先看检查覆盖，再看审计结论",
    results: [
      [
        "检查完成",
        "适用的检查返回了通过校验的结果，仍需核对证据和判断。完成不等于结论正确。",
      ],
      [
        "覆盖不完整",
        "一个或多个检查失败。即使没有告警或风险分数较低，也不能据此判断安全。请先查看未完成的检查。",
      ],
      [
        "存在告警或撤回",
        "核对引用原文、字段是否使用及信息可用时点；也要复查被撤回的告警。反馈误报时，请补充依据。",
      ],
    ],
    evidenceTitle: "当前评测告诉我们什么",
    evidenceIntro:
      "已记录基线 · Prompt audit-2.0.1 · 100 个合成配对案例 · 2026 年 9 月",
    stats: ["检查完整且判断正确", "检查完整但判断错误", "检查覆盖不完整"],
    evidenceDetail:
      "85 例报告完整，其中包含 16 例误报和 4 例漏报。这是开发用合成回归集，不是独立盲测或真实场景准确率承诺。本轮未覆盖训练代码审计。",
    evidenceLink: "查看完整结果与失败案例",
    nextTitle: "仍需验证的改进方向",
    nextIntro:
      "本次指南与上传校验帮助澄清输入，不代表模型准确率已提高。下一轮模型迭代需要：",
    next: [
      "要求具体的泄漏机制，避免将有预测力的正常特征当作风险。",
      "撤回有依据的告警前提供反证；存在分歧时保留待确认事项。",
      "完善派生字段识别与结构化输出，同时保留证据校验。",
      "重跑回归案例，并补充独立编写的未见案例，分别衡量漏报、误报和完成率。",
    ],
    closing: "准备好说明你的预测边界了吗？",
  },
};
