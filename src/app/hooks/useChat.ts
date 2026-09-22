import React, { useState } from "react";
import type { AuditReport, AuditRequest } from "../../types";
import { chatWithLLM } from "../../lib/llmEngine";

export type ChatMessage = { role: "user" | "assistant"; text: string };

export type ChatContext = "landing" | "setup" | "results";

export const contextualPrompts: Record<ChatContext, string[]> = {
  landing: [
    "What counts as feature leakage?",
    "How does temporal leakage occur?",
    "When should I run an audit?",
  ],
  setup: [
    "What should I enter for prediction time point?",
    "How do I define the observation window?",
    "What split method is safest?",
  ],
  results: [
    "Why is this finding marked as critical?",
    "What should I fix first?",
    "What can this audit verify?",
  ],
};

export interface SharedChatState {
  conversation: ChatMessage[];
  setConversation: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  isThinking: boolean;
  setIsThinking: React.Dispatch<React.SetStateAction<boolean>>;
}

interface UseChatOptions {
  context: ChatContext;
  auditContext?: { request: AuditRequest; report: AuditReport };
  shared?: SharedChatState;
}

export function useChat({ context, auditContext, shared }: UseChatOptions) {
  const [message, setMessage] = useState("");
  const [localIsThinking, setLocalIsThinking] = useState(false);
  const [localConversation, setLocalConversation] = useState<ChatMessage[]>([]);

  const conversation = shared ? shared.conversation : localConversation;
  const setConversation = shared
    ? shared.setConversation
    : setLocalConversation;
  const isThinking = shared ? shared.isThinking : localIsThinking;
  const setIsThinking = shared ? shared.setIsThinking : setLocalIsThinking;

  const prompts = contextualPrompts[context];

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setMessage("");
    setIsThinking(true);

    const historyForApi = conversation.map((m) => ({
      role: m.role,
      content: m.text,
    }));
    setConversation((prev) => [...prev, { role: "user", text: trimmed }]);

    if (context === "results" && auditContext) {
      try {
        const answer = await chatWithLLM(
          trimmed,
          auditContext.report,
          auditContext.request,
          historyForApi.slice(-20),
        );
        setConversation((prev) => [
          ...prev,
          { role: "assistant", text: answer || "(No response.)" },
        ]);
      } catch {
        setConversation((prev) => [
          ...prev,
          {
            role: "assistant",
            text: "The AI assistant is currently unavailable. Please try again later.",
          },
        ]);
      }
      setIsThinking(false);
      return;
    }

    setTimeout(() => {
      setConversation((prev) => [
        ...prev,
        {
          role: "assistant",
          text:
            "General guidance (not a live audit): " +
            getGuidanceResponse(trimmed, context),
        },
      ]);
      setIsThinking(false);
    }, 1200);
  };

  const handleSend = () => send(message);
  const handlePromptClick = (promptText: string) => send(promptText);

  return {
    message,
    setMessage,
    isThinking,
    conversation,
    prompts,
    handleSend,
    handlePromptClick,
  };
}

function getGuidanceResponse(message: string, context: string): string {
  const lowerMsg = message.toLowerCase();

  if (context === "landing") {
    if (
      lowerMsg.includes("feature leakage") ||
      lowerMsg.includes("what counts")
    )
      return "Feature leakage occurs when a feature contains information derived from the target variable or future events. This can happen through direct calculation, proxy variables, or data collection artifacts that wouldn't be available at true prediction time.";
    if (lowerMsg.includes("temporal"))
      return "Temporal leakage happens when your model uses information from the future—data that wouldn't be available at the time you need to make a prediction. Olarion reviews declared timing, column names and code; it does not inspect timestamp values.";
    if (lowerMsg.includes("when"))
      return "Run an audit before trusting model results, before deployment, when validating external models, or periodically for production systems. It's especially important for high-stakes decisions in healthcare, finance, or compliance contexts.";
  }

  if (context === "setup") {
    if (lowerMsg.includes("prediction time"))
      return 'The prediction time point is the exact moment when your model would make a prediction in production. For example, "at hospital discharge" or "end of business day." All features must use only data available before this point.';
    if (lowerMsg.includes("observation window"))
      return "The feature observation window covers data available before prediction time. The outcome window is the period after that point used to define the label, such as 30 days post-discharge for readmission.";
    if (lowerMsg.includes("split"))
      return "Your split method should match production deployment. Temporal splits are often safest for time-series data. Random splits can leak if temporal dependencies exist. Group-based splits prevent entity-level leakage.";
  }

  if (context === "results") {
    if (lowerMsg.includes("critical") || lowerMsg.includes("risky"))
      return "Critical findings indicate severe leakage that fundamentally invalidates model metrics. They typically involve future information, target derivatives, or pipeline errors that would cause dramatic performance drops in production.";
    if (lowerMsg.includes("fix first") || lowerMsg.includes("priority"))
      return "Address critical temporal and target leakage first, as these have the highest impact. Then fix pipeline issues. Lower-severity findings can be monitored or addressed in future iterations.";
    if (
      lowerMsg.includes("metric inflation") ||
      lowerMsg.includes("calculated")
    )
      return "Olarion does not calculate metric inflation, correlations or feature importance. It analyzes headers, code and declared context. Measuring impact requires retraining and evaluation outside this tool.";
  }

  return "I can help explain audit concepts, findings, and remediation steps. Try asking about specific terms or concepts you'd like to understand better.";
}
