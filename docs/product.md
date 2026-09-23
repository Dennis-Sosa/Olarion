# Olarion v0.2 产品设计与能力边界

## 定位与用户任务

面向需要验证机器学习评估可信度的数据分析师、算法工程师及模型评审人员，将“这条流水线有没有偷看答案”拆解为可执行的审计任务。核心产物是可核查的问题、证据、修复建议和未完成检查清单。

这是 AI 辅助的数据质量与分析流程审计产品，不是已具备数据库查询、自动建模、完整业务归因的通用数据分析平台。

## 任务链

上传前可阅读 [中英文指南](https://olarion-zeta.vercel.app/guide?lang=zh)，了解材料要求、任务描述示例和审计结果的含义。表头在浏览器内即时校验；多脚本 ZIP 由用户选择预处理与训练文件，其他脚本不会默认送入审计。字段缺失、超长代码等问题在跳转结果页前提示。

1. **需求结构化：**预测目标、标签列、CSV 字段、预处理代码；补充预测时点、实际使用字段、字段可用性、实体及其重复情况。
2. **规则检查：**识别直接标签副本、预处理拟合顺序、全量聚合、重复处理与实体边界。区分代码观察和需要用户确认的假设。
3. **并行模型检查：**proxy、temporal、code；提供训练代码时加入 model 检查。各检查有独立状态和耗时。
4. **结果校验：**校验 JSON 结构、类型、字段范围、枚举值、引用原文是否存在。无效结果记为检查失败，不记为“没有问题”。
5. **复核：**对初始 finding ID 做 keep/update/retract；完整验证后一次性应用。撤回的告警及其理由仍可追溯。复核失败保留初审，并标记覆盖不完整。
6. **报告：**由已校验的结构化结果渲染说明，风险严重性与判断置信度分别展示；空报告遇到检查失败时显示 Inconclusive。
7. **反馈与回归：**用户确认、标注误报或要求更多上下文，必须补充依据。本地保存，导出待审核案例；经人工复核和去敏后再转成回归标签。

## 质量与边界管理

- 规则是轻量静态启发式，非 Python AST/完整数据流分析；支持有限的字面量 X 选择与明显变换顺序。多分支、别名、函数封装、跨文件变量及历史回填可能无法判断。
- 预测时点和实体重复情况来自用户声明，没有通过 CSV 行值验证。冲突或缺少上下文需要人工确认。
- 模型的引用原文通过字符串匹配校验，只能验证引用存在，不能自动证明推理或因果判断正确。
- 未执行代码、未检查行级数据、未训练模型；不得输出实测相关性、精度膨胀、业务收益或自动修复成功率。
- `quality.status=complete` 只表示配置的检查正常返回且格式、引用通过校验，不等于结论正确或不存在泄漏。
- 单个有效告警仍可表示风险；若任一检查失败，报告同时保留 degraded 状态。服务故障与泄漏指标分开统计。
- 复核使用一次受约束的 JSON 决策调用，替换旧版最多三轮的追加式工具调用；以可撤回、可验证和可追溯为目标，没有声称完全自主研究能力。

## 评测标准

冻结 100 个合成案例：10 个领域 × 5 类机制 × 正反配对。50 个正例、50 个负例。按案例级是否触发泄漏告警统计混淆矩阵，并按机制分组。原始标签和 SHA256 保留；修复后对这套回归集的提升不代表未见场景泛化提升。

- 检测质量：precision、recall、false-positive rate，逐类分析，保留全部失败案例。
- 运行可靠性：有效完整报告数 / 计划案例数；degraded 原因和阶段耗时；未完成案例不能当作真阴性。
- 可核查性：引用存在、真实字段约束、复核 ID 完整性和撤回记录。
- 安全边界：不执行用户代码；用户输入不得提升为 system 指令；chat 限制角色与长度；输入和调用有大小及时间限制。
- 反馈治理：用户反馈是候选信息，不直接视为正确标签或自动训练数据。

## 已实现与下一阶段

| 方向 | v0.2 已实现 | 后续验收要求 |
|---|---|---|
| 能力边界 | 特征/时点/实体上下文、未知项提示 | AST 或数据流分析；跨文件用例通过独立评测 |
| 稳定性 | 校验、超时、取消、SSE 错误、降级报告；真实部署模型调用已验证 | 负载验证与多次重复运行 |
| 评测 | 冻结回归集、规则基线、原始结果、CI；100 例真实部署评测，85 例完整、15 例降级 | 修复字段契约与语义误判；增加独立盲测和重复运行 |
| 反馈资产 | 本地逐项反馈、带版本导出、人工待审标记 | 经授权的共享存储、审核队列和版本化知识库 |
| 生产治理 | 有界请求、进程内冷却、不记录原始模型内容 | 分布式配额、身份认证、租户隔离、保留与删除策略 |

生产模型鉴权已恢复，并已完成 100 例请求和失败分析。[真实模型评测](../evals/remote-report-2.0.1.md) 中，85 例报告完整，65 例同时完整且判断正确；Agent 在相同完整子集上提高召回率，但降低精确率和准确率。优先级：先修复字段契约、将预测力误当泄漏及复核误撤回的问题；再扩展独立样本和语义时间边界；最后根据实际多人使用需求建设共享知识库。当前反馈机制是可审核的数据回流起点，没有“越用越准”的线上效果证据。

## 与 AI 数据产品经理能力的对应

本次迭代展示需求拆解、模型能力边界、规则与模型分工、评测设计、错误案例分析和反馈闭环。项目贡献应按实际职责描述；需求与产品设计、Agent 流程及 Prompt 属于已确认的个人工作范围。不得把仓库全部工程实现都写成个人独立完成，也不把合成测试结果写成客户业务指标。

## 部署与数据处理

CSV 行留在浏览器；代码、表头、任务上下文和问答上下文会发送到 API 与 OpenAI。历史和反馈留在浏览器 localStorage，可在 Past Audits 清除。反馈导出含提交代码和上下文，分享前需检查。没有服务端持久化数据库，但不承诺基础设施或供应商“零留存”。

现有 Vercel 配置 API 最长 60 秒，应用审计截止 48 秒。模型单次 15 秒，SDK retries=0，避免多层重试突破预算。模型错误按鉴权、额度/限流、服务不可用、超时和格式问题记录，响应不包含凭证或原始 provider 错误。

错误处理参考 [OpenAI API error codes](https://developers.openai.com/api/docs/guides/error-codes)。模型调用配置需与实际部署账号和模型权限一致。健康接口仅报告配置存在，不能证明凭证有效。

开发依赖升级至 Vite 7 / Vitest 4，开发服务器默认仅绑定本机；qs 通过 override 使用 6.16.0 及兼容补丁版本，避免 Express 的旧版精确依赖。版本修复依据包括 [Vitest 安全公告](https://github.com/advisories/GHSA-82fw-gwwq-j7x9)。提交锁文件并用 CI 验证。

部署配置已迁移为 Vite preset、显式 build/output 配置和 `/api/index` rewrite，移除与 functions 冲突的旧版 builds。依据 [Vercel 配置说明](https://vercel.com/docs/project-configuration/vercel-json)，两者不能混用。

后端使用显式 `.js` ESM import 路径；构建分别检查浏览器与 NodeNext 解析模式。`npm run test:runtime` 会编译服务端、以原生 Node 导入 API 入口、请求健康接口并清理临时文件，防止仅在 serverless 启动时才暴露模块解析问题。

## Agent reliability iteration — audit-2.1.0

Specialists must describe a concrete forbidden information path and actual usage. Structured Outputs constrain field names and evidence IDs; the server resolves IDs to exact submitted text. Lexical recognition of Python column assignments and `assign()` extends the allowed feature catalog to derived fields. It does not execute Python or prove full lineage.

Review decisions require a retraction basis and cited counterevidence. Narrow validation guards reject treating known stateful transforms as stateless or using entity independence to dismiss fit-scope concerns. Contract/validation errors and temporary provider failures receive at most one stage retry within the audit deadline. Failed repairs remain failed coverage; successful recovery records attempts and error codes. No retry on authentication/quota errors.

Keep the audit-2.0.1 baseline. Evaluate the frozen 100 cases and the separately labeled 20 supplemental challenge cases before claiming measured improvement. The supplemental cases are authored by the implementation assistant, not an independent blind benchmark.

API implementation reference: [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs). Schema conformance does not establish factual correctness; evidence validation and empirical evaluation are still required.
