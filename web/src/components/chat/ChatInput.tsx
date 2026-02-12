"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ChatInput({
  onSend,
  isLoading,
  disabled,
}: {
  onSend: (message: string) => void;
  isLoading: boolean;
  disabled: boolean;
}) {
  const [input, setInput] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading || disabled) return;
    onSend(trimmed);
    setInput("");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-2 px-4 py-3 border-t"
    >
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={
          disabled ? "Question limit reached" : "Ask a question..."
        }
        disabled={disabled || isLoading}
        className="text-sm"
      />
      <Button
        type="submit"
        size="icon"
        disabled={!input.trim() || isLoading || disabled}
      >
        <Send className="h-4 w-4" />
      </Button>
    </form>
  );
}
