import cors from "cors";
import express from "express";
import { runAudit } from "./orchestrator.js";
import { answerQuestion } from "./tools/llm/chatAgent.js";
import {
  callOpenAIJson,
  modelErrorCode,
  PROMPT_VERSION,
  MODEL,
} from "./openaiClient.js";
import { validateRequest, validateChat } from "./validation.js";
const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
const recent = new Map<string, number>();
function allow(ip: string): boolean {
  const now = Date.now();
  for (const [key, until] of recent) if (until <= now) recent.delete(key);
  if (recent.has(ip) || recent.size > 10000) return false;
  recent.set(ip, now + 10000);
  return true;
}
app.get("/api/health", (_req, res) =>
  res.json({
    service: "olarion",
    prompt_version: PROMPT_VERSION,
    model: MODEL,
    model_configured: !!process.env.OPENAI_API_KEY?.trim(),
  }),
);
for (const route of ["/api/audit", "/api/audit-stream"]) {
  app.post(route, async (req, res) => {
    if (!validateRequest(req.body?.request)) {
      res
        .status(400)
        .json({
          error:
            "Provide a goal, CSV columns, a valid target, preprocessing code, and valid optional context (300 columns / 60,000 characters per code file maximum).",
        });
      return;
    }
    if (!allow(req.ip ?? "unknown")) {
      res.setHeader("Retry-After", "10");
      res
        .status(429)
        .json({ error: "Please wait 10 seconds before another request." });
      return;
    }
    const controller = new AbortController();
    res.on("close", () => {
      if (!res.writableEnded) controller.abort();
    });
    const streaming = route.endsWith("stream");
    if (streaming) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();
    }
    const send = (data: unknown) => {
      if (!res.destroyed) res.write(`data: ${JSON.stringify(data)}\n\n`);
    };
    const heartbeat = streaming
      ? setInterval(() => {
          if (!res.destroyed) res.write(": heartbeat\n\n");
        }, 10000)
      : null;
    try {
      const report = await runAudit(
        req.body.request,
        streaming ? send : undefined,
        controller.signal,
      );
      if (!res.destroyed) {
        if (streaming) send({ type: "complete", report });
        else res.json({ report });
      }
    } catch {
      if (!res.destroyed) {
        if (streaming)
          send({
            type: "error",
            message: "Audit unavailable. Please try again.",
          });
        else
          res
            .status(503)
            .json({ error: "Audit unavailable. Please try again." });
      }
    } finally {
      if (heartbeat) clearInterval(heartbeat);
      if (streaming && !res.destroyed) res.end();
    }
  });
}
app.post("/api/chat", async (req, res) => {
  if (!validateChat(req.body)) {
    res
      .status(400)
      .json({
        error:
          "A valid question, audit request, report and chat history are required.",
      });
    return;
  }
  if (!allow(`chat:${req.ip}`)) {
    res
      .status(429)
      .json({ error: "Please wait 10 seconds before another question." });
    return;
  }
  try {
    const { question, report, request, history } = req.body;
    res.json({
      answer: await answerQuestion(question, report, request, history ?? []),
    });
  } catch (error) {
    res
      .status(503)
      .json({
        error:
          "The AI assistant is currently unavailable. Your audit is still available.",
        code: modelErrorCode(error),
      });
  }
});
app.post("/api/classify-code", async (req, res) => {
  const files = req.body?.files;
  if (
    !Array.isArray(files) ||
    !files.length ||
    files.length > 10 ||
    !files.every(
      (f) =>
        f &&
        typeof f.filename === "string" &&
        f.filename.length <= 300 &&
        typeof f.content === "string" &&
        f.content.length <= 60000,
    )
  ) {
    res
      .status(400)
      .json({
        error: "Upload 1–10 Python files of at most 60,000 characters each.",
      });
    return;
  }
  if (!allow(`classify:${req.ip}`)) {
    res.status(429).json({ error: "Please wait before uploading again." });
    return;
  }
  if (files.length === 1) {
    res.json({
      preprocessing_code: files[0].content,
      model_training_code: null,
    });
    return;
  }
  try {
    const result = await callOpenAIJson(
      'Classify ML files. Return JSON {"preprocessing_index": integer|null, "training_index": integer|null}. Indices are zero-based. Preprocessing contains dataset loading and transforms; training contains model fitting and evaluation. If uncertain use null. Never silently choose a default.',
      JSON.stringify(
        files.map((f) => ({
          filename: f.filename,
          content: f.content.slice(0, 3000),
        })),
      ),
    );
    const pre = result.preprocessing_index,
      train = result.training_index;
    if (
      !Number.isInteger(pre) ||
      Number(pre) < 0 ||
      Number(pre) >= files.length ||
      (train !== null &&
        (!Number.isInteger(train) ||
          Number(train) < 0 ||
          Number(train) >= files.length ||
          train === pre))
    ) {
      res
        .status(422)
        .json({
          error:
            "Could not identify the files reliably. Paste the preprocessing and training code separately.",
        });
      return;
    }
    res.json({
      preprocessing_code: files[Number(pre)].content,
      model_training_code: train === null ? null : files[Number(train)].content,
    });
  } catch {
    res
      .status(503)
      .json({
        error:
          "Code classification unavailable. Paste the two code files separately.",
      });
  }
});
app.use(
  (
    error: { type?: string },
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    res
      .status(error.type === "entity.too.large" ? 413 : 400)
      .json({ error: "Invalid or oversized JSON request." });
  },
);
export default app;
