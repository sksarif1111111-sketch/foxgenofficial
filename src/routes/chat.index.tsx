import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { loadThreads, newThreadId } from "@/lib/chat-threads";

export const Route = createFileRoute("/chat/")({
  component: ChatIndex,
});

function ChatIndex() {
  const navigate = useNavigate();
  useEffect(() => {
    const latest = loadThreads().sort((a, b) => b.updatedAt - a.updatedAt)[0];
    navigate({ to: "/chat/$threadId", params: { threadId: latest?.id ?? newThreadId() }, replace: true });
  }, [navigate]);
  return null;
}
