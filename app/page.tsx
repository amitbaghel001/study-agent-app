"use client";

import { useEffect, useRef, useState } from "react";

type UserMessage = {
  id: string;
  role: "user";
  content: string;
};

type AssistantMessage = {
  id: string;
  role: "assistant";
  content: string;
  saveData?: SaveData;
  saveStatus?: "idle" | "saving" | "saved" | "error";
  saveError?: string;
};

type Message = UserMessage | AssistantMessage;

type SaveData = {
  subject: string;
  concept: string;
  masteryLevel: string;
  overviewGist: string;
  deepDiveGist: string[];
  strongAreas: string[];
  weakAreas: string[];
  nextSteps: string[];
  notes: string;
};

const SAVE_PROGRESS_REGEX = /\[\[SAVE_PROGRESS\]\][\s\S]*?\[\[\/SAVE_PROGRESS\]\]/;

function parseSaveProgress(
  content: string,
): Omit<SaveData, "subject" | "concept"> | null {
  const match = content.match(SAVE_PROGRESS_REGEX);
  if (!match) return null;

  const inner = match[0]
    .replace(/\[\[SAVE_PROGRESS\]\]/, "")
    .replace(/\[\[\/SAVE_PROGRESS\]\]/, "")
    .trim();

  try {
    const parsed = JSON.parse(inner);
    return {
      masteryLevel: typeof parsed.masteryLevel === "string" ? parsed.masteryLevel : "",
      overviewGist: typeof parsed.overviewGist === "string" ? parsed.overviewGist : "",
      deepDiveGist: Array.isArray(parsed.deepDiveGist)
        ? parsed.deepDiveGist.filter((v: unknown): v is string => typeof v === "string")
        : [],
      strongAreas: Array.isArray(parsed.strongAreas)
        ? parsed.strongAreas.filter((v: unknown): v is string => typeof v === "string")
        : [],
      weakAreas: Array.isArray(parsed.weakAreas)
        ? parsed.weakAreas.filter((v: unknown): v is string => typeof v === "string")
        : [],
      nextSteps: Array.isArray(parsed.nextSteps)
        ? parsed.nextSteps.filter((v: unknown): v is string => typeof v === "string")
        : [],
      notes: typeof parsed.notes === "string" ? parsed.notes : "",
    };
  } catch {
    return null;
  }
}

function stripSaveProgress(content: string): string {
  return content.replace(SAVE_PROGRESS_REGEX, "").trimEnd();
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    const userMsg: UserMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsSending(true);

    let subject = "";
    let concept = "";

    // Step 1: detect subject + concept. Failure here is non-fatal — the chat
    // route falls back to Mode A and we skip the Save button later.
    try {
      const detectRes = await fetch("/api/detect-concept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userMessage: trimmed }),
      });
      if (detectRes.ok) {
        const data = await detectRes.json();
        subject = typeof data.subject === "string" ? data.subject : "";
        concept = typeof data.concept === "string" ? data.concept : "";
      }
    } catch (err) {
      console.warn("detect-concept failed:", err);
    }

    // Step 2: stream chat response.
    const assistantId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "" },
    ]);

    let fullContent = "";
    let streamingFailed = false;

    try {
      const chatRes = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userMessage: trimmed, subject, concept }),
      });

      if (!chatRes.ok || !chatRes.body) {
        throw new Error(`Chat request failed (${chatRes.status})`);
      }

      const reader = chatRes.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        fullContent += chunk;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: fullContent } : m,
          ),
        );
      }
      // Flush any trailing bytes the decoder is still holding.
      fullContent += decoder.decode();
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: fullContent } : m,
        ),
      );
    } catch (err) {
      streamingFailed = true;
      const errorMsg = err instanceof Error ? err.message : "Failed to get response.";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: fullContent || `Error: ${errorMsg}` }
            : m,
        ),
      );
    }

    // Step 3: parse the trailing SAVE_PROGRESS block and attach save metadata
    // so the Save button can render with the correct fields.
    if (!streamingFailed) {
      const saveFields = parseSaveProgress(fullContent);
      if (saveFields && subject && concept) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, saveData: { ...saveFields, subject, concept } }
              : m,
          ),
        );
      }
    }

    setIsSending(false);
  }

  async function handleSave(messageId: string) {
    const msg = messages.find((m) => m.id === messageId);
    if (!msg || msg.role !== "assistant" || !msg.saveData) return;

    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? { ...m, saveStatus: "saving", saveError: undefined }
          : m,
      ),
    );

    try {
      const res = await fetch("/api/save-concept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(msg.saveData),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Save failed (${res.status})`);
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, saveStatus: "saved" } : m,
        ),
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Save failed.";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, saveStatus: "error", saveError: errorMsg }
            : m,
        ),
      );
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-950 text-gray-100">
      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-3xl space-y-4">
          {messages.length === 0 && (
            <div className="mt-16 text-center text-gray-500">
              <p className="text-lg">Start a conversation</p>
              <p className="mt-1 text-sm">
                Try &ldquo;Explain how photosynthesis works&rdquo; or
                &ldquo;What is recursion in programming?&rdquo;
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} onSave={handleSave} />
          ))}

          <div ref={messagesEndRef} />
        </div>
      </main>

      <footer className="border-t border-gray-800 bg-gray-950 px-4 py-4">
        <form
          onSubmit={handleSend}
          className="mx-auto flex max-w-3xl gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about any concept…"
            disabled={isSending}
            className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-gray-100 placeholder-gray-500 transition-colors focus:border-blue-500 focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isSending || !input.trim()}
            className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSending ? "Sending…" : "Send"}
          </button>
        </form>
      </footer>
    </div>
  );
}

function MessageBubble({
  message,
  onSave,
}: {
  message: Message;
  onSave: (id: string) => void;
}) {
  const isUser = message.role === "user";
  const displayContent = isUser
    ? message.content
    : stripSaveProgress(message.content);

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 sm:max-w-[75%] ${
          isUser
            ? "bg-blue-900 text-blue-50"
            : "bg-gray-800 text-gray-100"
        }`}
      >
        <div className="whitespace-pre-wrap break-words leading-relaxed">
          {displayContent}
          {!isUser && displayContent.length === 0 && (
            <span className="text-gray-500">Thinking…</span>
          )}
        </div>

        {!isUser && message.saveData && (
          <SaveButton message={message as AssistantMessage} onSave={onSave} />
        )}
      </div>
    </div>
  );
}

function SaveButton({
  message,
  onSave,
}: {
  message: AssistantMessage;
  onSave: (id: string) => void;
}) {
  if (message.saveStatus === "saved") {
    return (
      <div className="mt-3 flex items-center gap-2 text-xs text-green-400">
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
          />
        </svg>
        <span>Progress saved</span>
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => onSave(message.id)}
        disabled={message.saveStatus === "saving"}
        className="rounded-md bg-gray-700 px-3 py-1.5 text-xs text-gray-100 transition-colors hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {message.saveStatus === "saving" ? "Saving…" : "Save progress"}
      </button>
      {message.saveStatus === "error" && message.saveError && (
        <span className="text-xs text-red-400">{message.saveError}</span>
      )}
    </div>
  );
}
