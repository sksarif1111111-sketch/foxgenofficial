import { createFileRoute, Link, Outlet, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MessageSquarePlus, Trash2 } from "lucide-react";
import { SiteNav } from "@/components/site/site-nav";
import { deleteThread, loadThreads, newThreadId, subscribeThreads, type ChatThread } from "@/lib/chat-threads";

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "FoxGEN AI Assistant — Ask about products" },
      { name: "description", content: "Chat with FoxGEN AI to find digital products, prices and stock in the FoxGEN store." },
      { property: "og:title", content: "FoxGEN AI Assistant" },
      { property: "og:description", content: "Ask FoxGEN AI about products, prices and how to buy." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChatLayout,
});

function ChatLayout() {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const params = useParams({ strict: false }) as { threadId?: string };
  const navigate = useNavigate();

  useEffect(() => {
    const refresh = () => setThreads(loadThreads().sort((a, b) => b.updatedAt - a.updatedAt));
    refresh();
    return subscribeThreads(refresh);
  }, []);

  return (
    <div className="flex h-dvh flex-col bg-background">
      <SiteNav />
      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-4 overflow-hidden px-4 py-4 sm:px-6">
        <aside className="hidden w-64 shrink-0 flex-col gap-2 md:flex">
          <button
            type="button"
            onClick={() => navigate({ to: "/chat/$threadId", params: { threadId: newThreadId() } })}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft"
          >
            <MessageSquarePlus className="h-4 w-4" /> New chat
          </button>
          <div className="flex-1 space-y-1 overflow-y-auto">
            {threads.map((t) => (
              <div
                key={t.id}
                className={`group flex items-center gap-1 rounded-lg px-2 ${t.id === params.threadId ? "bg-accent" : "hover:bg-muted"}`}
              >
                <Link to="/chat/$threadId" params={{ threadId: t.id }} className="flex-1 truncate py-2 text-sm">
                  {t.title}
                </Link>
                <button
                  type="button"
                  aria-label="Delete chat"
                  onClick={() => {
                    deleteThread(t.id);
                    if (t.id === params.threadId) navigate({ to: "/chat" });
                  }}
                  className="p-1 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </aside>
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
