import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowCounterClockwise, PaperPlaneRight, X } from "@phosphor-icons/react/dist/ssr";
import { MessageResponse } from "@/components/ai-elements/message";
import { deleteThread, getThread, newThreadId, saveThreadMessages } from "@/lib/chat-threads";
import { Button } from "@/components/ui/button";
import { signalAssistant } from "@/lib/assistant-events";

const THREAD_KEY = "foxgen-assistant-thread";
const SUGGESTIONS = ["What products do you have?", "Which items are in stock?", "How do I buy?"];

function storedThreadId() {
  try {
    const existing = window.localStorage.getItem(THREAD_KEY);
    if (existing) return existing;
    const id = newThreadId();
    window.localStorage.setItem(THREAD_KEY, id);
    return id;
  } catch {
    return newThreadId();
  }
}

/** Small chat pop-up above the robot. Replies come from the same store AI as before. */
export default function AssistantChatPopup({ onClose, side = "right" }: { onClose: () => void; side?: "left" | "right" }) {
  const [threadId, setThreadId] = useState(storedThreadId);
  const initial = useMemo(() => getThread(threadId)?.messages ?? [], [threadId]);

  const reset = () => {
    deleteThread(threadId);
    const id = newThreadId();
    try {
      window.localStorage.setItem(THREAD_KEY, id);
    } catch {
      /* private mode: keep the new chat in memory only */
    }
    setThreadId(id);
  };

  return (
    <div
      role="dialog"
      aria-label="Foxy, FOXGEN assistant chat"
      data-side={side}
      className={`assistant-pop fixed bottom-[86px] z-[60] ${side === "left" ? "left-4" : "right-4"} flex h-[min(400px,calc(100dvh-112px))] w-[min(320px,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border border-border bg-card text-foreground shadow-lift sm:bottom-[124px] sm:h-[min(520px,calc(100dvh-150px))] sm:w-[370px]`}
    >
      <div className="flex items-center gap-3 border-b border-border bg-accent/60 px-4 py-3">
        <span className="relative flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <span className="title-4 font-bold">AI</span>
          <span className="absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-card bg-success" />
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="title-4 block font-bold">Foxy</span>
          <span className="caption-4 block text-muted-foreground">Usually replies in seconds</span>
        </span>
        <Button type="button" variant="ghost" size="icon" onClick={reset} aria-label="Start a new chat" title="New chat" className="size-9 shrink-0 text-muted-foreground">
          <ArrowCounterClockwise size={18} weight="bold" />
        </Button>
        <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close chat" className="size-9 shrink-0 text-muted-foreground">
          <X size={18} weight="bold" />
        </Button>
      </div>
      <ChatBody key={threadId} threadId={threadId} initialMessages={initial} />
    </div>
  );
}

function ChatBody({ threadId, initialMessages }: { threadId: string; initialMessages: UIMessage[] }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/chat" }), []);
  const { messages, sendMessage, status } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
    onError: (e) => setError(friendly(e.message)),
  });
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (window.matchMedia("(min-width: 640px)").matches) inputRef.current?.focus();
  }, []);
  const wasBusy = useRef(false);
  useEffect(() => {
    if (busy && !wasBusy.current) signalAssistant("typing");
    if (!busy && wasBusy.current) signalAssistant("answered");
    wasBusy.current = busy;
  }, [busy]);
  useEffect(() => {
    if ((status === "ready" || status === "error") && messages.length > 0) saveThreadMessages(threadId, messages);
  }, [messages, status, threadId]);
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, status, error]);

  const send = (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    setError(null);
    sendMessage({ text: t });
    signalAssistant("love");
    setInput("");
  };
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(input);
  };

  return (
    <>
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
        <Bubble from="assistant">Hi, I'm Foxy! What can I help you with?</Bubble>
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {SUGGESTIONS.map((s) => (
              <Button variant="outline" key={s} type="button" onClick={() => send(s)} className="caption-3 h-auto whitespace-normal px-3 py-2">
                {s}
              </Button>
            ))}
          </div>
        )}
        {messages.map((m) => {
          const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
          if (!text) return null;
          return (
            <Bubble key={m.id} from={m.role === "user" ? "user" : "assistant"}>
              {m.role === "user" ? text : <MessageResponse>{text}</MessageResponse>}
            </Bubble>
          );
        })}
        {status === "submitted" && (
          <div className="flex w-fit items-center gap-1 rounded-2xl rounded-bl-md bg-muted px-3 py-3" aria-label="Foxgen AI is typing">
            <span className="assistant-dot size-1.5 rounded-full bg-muted-foreground" />
            <span className="assistant-dot size-1.5 rounded-full bg-muted-foreground [animation-delay:150ms]" />
            <span className="assistant-dot size-1.5 rounded-full bg-muted-foreground [animation-delay:300ms]" />
          </div>
        )}
        {error && <p className="body-6 rounded-xl bg-destructive/10 px-3 py-2 text-destructive">{error}</p>}
      </div>
      <form onSubmit={onSubmit} className="flex items-end gap-2 border-t border-border p-3">
        <textarea
          ref={inputRef}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder="Type your message..."
          aria-label="Type your message"
          maxLength={1000}
          className="body-3 sm:body-6 max-h-28 min-h-11 min-w-0 flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2.5 outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
        />
        <Button size="icon"
          type="submit"
          disabled={busy || !input.trim()}
          aria-label="Send message"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-soft transition hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <PaperPlaneRight size={18} weight="fill" />
        </Button>
      </form>
    </>
  );
}

function Bubble({ from, children }: { from: "user" | "assistant"; children: React.ReactNode }) {
  return from === "user" ? (
    <div className="body-6 ml-auto w-fit max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-primary-foreground">{children}</div>
  ) : (
    <div className="body-6 w-fit max-w-[90%] break-words rounded-2xl rounded-bl-md bg-muted px-3.5 py-2 text-foreground [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1">{children}</div>
  );
}

function friendly(raw?: string) {
  if (!raw) return "Something went wrong. Please try again.";
  if (raw.startsWith("{")) {
    try {
      return (JSON.parse(raw) as { error?: string }).error ?? "Something went wrong. Please try again.";
    } catch {
      return "Something went wrong. Please try again.";
    }
  }
  return raw;
}
