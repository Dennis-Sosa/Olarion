# 在自己的 Vercel 工作空间部署

个人代码仓库：<https://github.com/Dennis-Sosa/Olarion>，生产分支为 `main`。

当前个人网站：<https://olarion-zeta.vercel.app/>。

管理后台：<https://vercel.com/sosadennis39-debugs-projects/olarion>。该项目已从个人仓库导入，构建、页面和 API 检查通过；首次验收时模型密钥尚未配置，审计报告会明确显示覆盖不完整。原始结果见 [个人部署验收记录](../evals/personal-production-smoke.json)。

## 当前项目配置密钥

打开[环境变量页面](https://vercel.com/sosadennis39-debugs-projects/olarion/settings/environment-variables)，添加 `OPENAI_API_KEY`，类型选 **Secret**，环境选 **Production**，填入有效密钥并保存。`OPENAI_MODEL=gpt-4o` 已配置。保存后，在 **Deployments** 对最新的 `main` 生产部署执行 **Redeploy**，再进行下面的验收。

GitHub 存放代码，Vercel 托管运行中的网站。把代码发布到个人 GitHub，不会自动迁移原团队的 Vercel 项目、域名或环境变量。`olarion.vercel.app` 属于此前的团队部署；本仓库中的生产冒烟记录是历史证据。

## 新建部署

1. 登录自己的 Vercel 账号，选择自己的工作空间。
2. 点击 **Add New → Project**，导入 **Dennis-Sosa/Olarion**。
3. 确认仓库所有者为 `Dennis-Sosa`，生产分支为 `main`，Root Directory 为仓库根目录。
4. 保留仓库 `vercel.json` 中的构建配置：Vite、`npm ci`、`npm run build`、输出目录 `dist`。使用 Node.js 22。
5. 在 **Environment Variables** 添加下列变量，并选择 **Production**；需要分支预览时再添加到 **Preview**。

| 名称 | 值 | 用途 |
|---|---|---|
| `OPENAI_API_KEY` | 自己的有效 OpenAI API 密钥 | 服务端调用模型，启用 AI 检查所必需 |
| `OPENAI_MODEL` | `gpt-4o` | 可选，代码默认值 |

密钥只填在 Vercel 的环境变量界面，不写入 GitHub、README 或 `VITE_*` 变量。Vercel 不需要设置 `PORT`。

6. 点击 **Deploy**。如果在部署后才添加或修改环境变量，进入 **Deployments**，重新部署 `main` 的 Production 部署。
7. 将新项目生成的域名作为个人演示地址；完成下面的验收后再将其添加到 README 和简历。

## 验收

- 打开新域名的 `/setup`，确认页面正常加载。
- 打开 `/api/health`，确认 `prompt_version` 为 `audit-2.0.0`，且 `model_configured` 为 `true`。这只证明配置存在，不能证明凭证有效。
- 分别运行一个 clean 和一个 leaky 示例，检查报告中的各阶段状态、证据和覆盖提示。HTTP 200 不等于所有 AI 检查成功。
- 使用有效模型凭证执行 `npm run eval:live`，保留逐例原始结果。已有 100 例规则回归不能替代真实模型评测。

环境变量修改和重新部署规则参见 [Vercel 官方文档](https://vercel.com/docs/environment-variables/managing-environment-variables)。
