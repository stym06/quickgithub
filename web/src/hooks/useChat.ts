"use client";

import { useState, useCallback, useRef } from "react";
import { MAX_CHAT_QUESTIONS } from "@/lib/constants";
import type { ChatMessage } from "@/types";

function getSessionToken(): string {
  if (typeof window === "undefined") return "";
  let token = localStorage.getItem("qg_session");
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem("qg_session", token);
  }
  return token;
}

export function useChat(owner: string, repo: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [questionsUsed, setQuestionsUsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const remainingQuestions = MAX_CHAT_QUESTIONS - questionsUsed;

  const sendMessage = useCallback(
    async (content: string) => {
      if (remainingQuestions <= 0) {
        setError("Question limit reached for this session.");
        return;
      }

      setError(null);
      setIsLoading(true);

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "USER",
        content,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMessage]);

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "ASSISTANT",
        content: "",
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      try {
        abortRef.current = new AbortController();
        const res = await fetch(`/api/repos/${owner}/${repo}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: content,
            sessionToken: getSessionToken(),
          }),
          signal: abortRef.current.signal,
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Error: ${res.status}`);
        }

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();

        if (reader) {
          let fullContent = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const text = decoder.decode(value, { stream: true });
            fullContent += text;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMessage.id
                  ? { ...m, content: fullContent }
                  : m
              )
            );
          }
        }

        setQuestionsUsed((prev) => prev + 1);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        const errorMsg =
          err instanceof Error ? err.message : "Failed to send message";
        setError(errorMsg);
        // Remove empty assistant message on error
        setMessages((prev) =>
          prev.filter((m) => m.id !== assistantMessage.id)
        );
      } finally {
        setIsLoading(false);
      }
    },
    [owner, repo, remainingQuestions]
  );

  return {
    messages,
    isLoading,
    questionsUsed,
    remainingQuestions,
    error,
    sendMessage,
  };
}
