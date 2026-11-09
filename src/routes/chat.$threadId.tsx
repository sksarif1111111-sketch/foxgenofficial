import { createFileRoute, Link } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea } from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { getThread, newThreadId, saveThreadMessages } from "@/lib/chat-threads";

export const Route = createFileRoute("/chat/$threadId")({
  head: () => ({
    meta: [
      { title: "Chat — FoxGEN AI Assistant" },
      { name: "description", content: "Your conversation with the FoxGEN AI shopping assistant." },
      { property: "og:title", content: "Chat with FoxGEN AI" },
      { property: "og:description", content: "Ask about FoxGEN products, prices and stock." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ThreadPage,
});

function ThreadPage() {
  const { threadId } = Route.useParams();
  const [initial, setInitial] = useState<UIMessage[] | null>(null);
  useEffect(() => {
    setInitial(getThread(threadId)?.messages ?? []);
  }, [threadId]);
  if (!initial) return null;
  return <ChatWindow key={threadId} threadId={threadId} initialMessages={initial} />;
}

const SUGGESTIONS = ["What products do you have?", "Which items are in stock?", "How do I buy?"];

function ChatWindow({ threadId, initialMessages }: { threadId: string; initialMessages: UIMessage[] }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/chat" }), []);
  const { messages, sendMessage, status, stop } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
    onError: (e) => setError(e.message?.startsWith("{") ? safeMsg(e.message) : e.message || "Something went wrong."),
  });

  useEffect(() => {
    if (status === "ready" || status === "error") {
      if (messages.length > 0) saveThreadMessages(threadId, messages);
    }
  }, [messages, status, threadId]);

  const busy = status === "submitted" || status === "streaming";
  const send = (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    setError(null);
    sendMessage({ text: t });
    setInput("");
  };

  return (
    <>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <img src="/foxgen-logo.png" alt="" className="h-7 w-7 rounded-md" />
          <span className="text-sm font-bold">FoxGEN AI</span>
        </div>
        <Link
          to="/chat/$threadId"
          params={{ threadId: newThreadId() }}
          className="flex items-center gap-1 text-xs font-semibold text-primary md:hidden"
        >
          <MessageSquarePlus className="h-4 w-4" /> New chat
        </Link>
      </div>
      <Conversation className="flex-1">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState
              icon={<img src="/foxgen-logo.png" alt="" className="h-12 w-12 rounded-xl" />}
              title="Hi! I'm FoxGEN AI"
              description="Ask me about products, prices and stock."
            >
              <div className="flex flex-col items-center gap-3">
                <img src="/foxgen-logo.png" alt="" className="h-12 w-12 rounded-xl" />
                <p className="text-sm font-semibold">Hi! I'm FoxGEN AI — ask me about products, prices and stock.</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} type="button" onClick={() => send(s)} className="rounded-full border border-border px-3 py-1.5 text-xs hover:bg-muted">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </ConversationEmptyState>
          ) : (
            messages.map((m) => (
              <Message key={m.id} from={m.role}>
                <MessageContent>
                  {m.parts.map((p, i) => (p.type === "text" ? <MessageResponse key={i}>{p.text}</MessageResponse> : null))}
                </MessageContent>
              </Message>
            ))
          )}
          {status === "submitted" && <Shimmer>Thinking...</Shimmer>}
          {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="border-t border-border p-3">
        <PromptInput onSubmit={(msg) => send(msg.text ?? "")}>
          <PromptInputTextarea autoFocus value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about any product..." />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={status} onStop={stop} disabled={!busy && !input.trim()} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </>
  );
}

function safeMsg(raw: string) {
  try {
    return (JSON.parse(raw) as { error?: string }).error ?? "Something went wrong.";
  } catch {
    return "Something went wrong.";
  }
}
