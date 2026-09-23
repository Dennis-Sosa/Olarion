import { afterEach, describe, expect, it, vi } from "vitest";
import OpenAI from "openai";
import { callOpenAIJson, client, modelErrorCode, rateLimitDelay, abortableDelay } from "./openaiClient";
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
describe("provider contract and failures", () => {
  it("sends strict JSON Schema for audit calls", async () => {
    vi.stubEnv("OPENAI_API_KEY", "unit-test-not-a-real-key");
    const create = vi.spyOn(client.chat.completions, "create").mockResolvedValue({
      choices:[{finish_reason:"stop", message:{content:'{"findings":[]}',refusal:null}}],
    } as never);
    const schema = { type:"object", properties:{findings:{type:"array",items:{type:"string"}}},required:["findings"],additionalProperties:false };
    await expect(callOpenAIJson("Review supplied code.","test",undefined,{name:"audit_test",schema})).resolves.toEqual({findings:[]});
    expect(create.mock.calls[0][0].response_format).toEqual({type:"json_schema",json_schema:{name:"audit_test",strict:true,schema}});
  });
  it("distinguishes rate limits, exhausted quota and unknown 429 responses", () => {
    const error=(code:string)=>new OpenAI.APIError(429,{code},"provider limited",new Headers({"retry-after":"3"}));
    expect(modelErrorCode(error("rate_limit_exceeded"))).toBe("rate_limited");
    expect(modelErrorCode(error("insufficient_quota"))).toBe("quota_exhausted");
    expect(modelErrorCode(error("unknown"))).toBe("rate_or_quota_limit");
    expect(rateLimitDelay(error("rate_limit_exceeded"))).toBe(3000);
  });
  it("cancels backoff immediately when the client disconnects", async () => {
    const controller=new AbortController();
    const waiting=abortableDelay(10000,controller.signal);
    controller.abort();
    await expect(waiting).rejects.toThrow("timeout_or_cancelled");
  });
});
