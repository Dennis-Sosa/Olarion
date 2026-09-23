# 个人部署：100 例真实模型评测（audit-2.0.1）

执行时间：`2026-09-23T02:12:40.696Z` 至 `2026-09-23T02:30:20.850Z`（UTC）。

部署：[Vercel](https://vercel.com/sosadennis39-debugs-projects/olarion/4DpvQJmhia2h1FGu7AyyC3PcfNiQ)；代码：`41840f3a56add001d8092e489f94c1b7807bd797`；模型：`gpt-4o`。

[逐例原始结果](remote-live-results-2.0.1.json) · [冻结案例](cases.json) · [复现方式](README.md#evaluate-the-deployed-api)

## 结论

100 个案例均已请求：85 个完成所有适用检查，15 个覆盖不完整。完整报告率为 **85.0%**。生产模型鉴权成功，但仍存在误报、漏报及输出校验失败。

100 例中，65 例同时完整且判断正确，20 例完整但判断错误，15 例覆盖不完整。

仅在 85 个完整案例上，Agent 案例级准确率为 **76.5%**；精确率 **66.7%**；召回率 **88.9%**；误报率 **32.7%**。失败案例没有被当作正确的负例。

完整子集受到阶段失败的选择影响，尤其不能将其召回率外推到全部案例。

正例完整 36/50；负例完整 49/50。

这 100 例为依据原规则设计的合成配对回归集，包含 50 个正例、50 个负例；不是独立盲测或真实用户数据。单次运行不证明稳定性，也不衡量证据推理、定位或严重性评级的准确性。未提供训练代码，因此训练检查跳过；不能据此宣称训练代码审计能力已经验证。

## 同一完整案例子集的比较

| 指标 | 规则层，同一子集 | 规则 + Agent 复核 |
|---|---:|---:|
| 案例数 | 85 | 85 |
| TP | 26 | 32 |
| FP | 0 | 16 |
| TN | 49 | 33 |
| FN | 10 | 4 |
| 准确率 | 88.2% | 76.5% |
| 精确率 | 100.0% | 66.7% |
| 召回率 | 72.2% | 88.9% |
| 误报率 | 0.0% | 32.7% |

完整 100 例的规则层结果为 90% 准确率、80% 召回率、0% 误报率。上表缩小到 Agent 完成的同一子集，避免比较不同样本分母。该比较仍仅是这套开发回归集上的描述。

同一完整子集中，复核前误报 46 例、漏报 0 例；复核后误报 16 例、漏报 4 例。复核前结果由已保留的告警和撤回记录重建，说明复核效果也需要独立衡量。

## 按机制分组

| 机制 | 已请求 | 完整报告 | TP / FP / TN / FN（完整报告） |
|---|---:|---:|---|
| temporal | 20 | 20 | 10 / 6 / 4 / 0 |
| target_proxy | 20 | 20 | 10 / 0 / 10 / 0 |
| preprocessing | 20 | 20 | 6 / 0 / 10 / 4 |
| entity_split | 20 | 15 | 6 / 6 / 3 / 0 |
| target_aggregation | 20 | 10 | 0 / 4 / 6 / 0 |

## 覆盖失败

| 阶段 | 原因 | 次数 |
|---|---|---:|
| proxy | `unknown_feature` | 10 |
| proxy | `unused_or_unknown_feature` | 1 |
| review | `invalid_review_evidence` | 2 |
| temporal | `unknown_feature` | 10 |
| temporal | `unused_or_unknown_feature` | 3 |

同一案例可以有多个阶段失败，因此阶段次数之和不等于失败案例数。校验失败意味着没有可信的该阶段结果，不代表没有泄漏。

## 需要改进的行为

- **预测力被误当成泄漏：**案例 `007`、`011` 等，把预测前可用的历史特征当作标签代理。引用原文存在，却没有证明禁止的信息流。
- **复核撤回正确告警：**案例 `016`，复核以样本独立为由撤回全量拟合 MinMaxScaler 的告警；样本独立不能消除测试集参与拟合的事实。
- **未识别正确的目标编码边界：**案例 `009` 等，对训练内折外编码、仅用训练映射处理测试集的流程产生误报。
- **字段契约失败：**10 个目标聚合正例均触发 `unknown_feature`。这些输入包含派生字段，可能与字段沿袭和输出契约不一致有关；当前响应只保留错误码，未保留被拒绝的原始模型输出，尚不能确认具体无效字段。需在去敏诊断下定位，并保留严格校验。
- **复核引用无效：**失败的复核保持初审结果并提示覆盖不完整；不能把这一状态作为完整模型评测。

下一轮应分别评测语义约束、字段沿袭与复核决策。保留本轮结果，使用新版本和新结果文件；再补充独立编写的未见案例及重复运行，避免只对这套模板调参。

## 可复核案例索引

- 完整报告中的误报：`007_commerce_entity_split_clean`, `009_commerce_target_aggregation_clean`, `011_subscription_temporal_clean`, `021_rental_temporal_clean`, `027_rental_entity_split_clean`, `029_rental_target_aggregation_clean`, `031_credit_temporal_clean`, `037_credit_entity_split_clean`, `039_credit_target_aggregation_clean`, `041_equipment_temporal_clean`, `047_equipment_entity_split_clean`, `051_delivery_temporal_clean`, `057_delivery_entity_split_clean`, `059_delivery_target_aggregation_clean`, `077_support_entity_split_clean`, `091_content_temporal_clean`
- 完整报告中的漏报：`016_subscription_preprocessing_leaky`, `056_delivery_preprocessing_leaky`, `076_support_preprocessing_leaky`, `086_education_preprocessing_leaky`
- 覆盖不完整：`008_commerce_entity_split_leaky`, `010_commerce_target_aggregation_leaky`, `018_subscription_entity_split_leaky`, `020_subscription_target_aggregation_leaky`, `030_rental_target_aggregation_leaky`, `040_credit_target_aggregation_leaky`, `048_equipment_entity_split_leaky`, `050_equipment_target_aggregation_leaky`, `060_delivery_target_aggregation_leaky`, `070_retail_target_aggregation_leaky`, `080_support_target_aggregation_leaky`, `087_education_entity_split_clean`, `090_education_target_aggregation_leaky`, `098_content_entity_split_leaky`, `100_content_target_aggregation_leaky`

100 个 API 请求的客户端响应耗时中位数为 4.47 秒，P95 为 7.86 秒（nearest-rank；包括网络和服务端处理，不包括请求间的冷却等待）。这是单次顺序运行的观测值，不是并发性能或 SLA。

## 简历可用表述

> 负责 Olarion AI 辅助数据泄漏审计产品的需求与产品设计、Agent 任务链和 Prompt；将预测目标、特征时点与代码上下文拆解为规则检查、并行模型分析、证据校验和可撤回复核，推动个人站点上线。建立 100 例合成配对回归与真实模型评测，分开衡量完成率、精确率、召回率及误报率，并设计逐项反馈和待审核案例导出机制。

不把规则层的 90% 写成 Agent 准确率，不写“100 例全部通过”“线上越用越准”或未经验证的业务收益。工程实现与协作贡献按实际分工说明。
