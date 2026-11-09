import { createFileRoute } from "@tanstack/react-router";
import { handleStoreChat } from "@/lib/ai/store-chat.server";

export const Route = createFileRoute("/api/chat")({
  server: { handlers: { POST: ({ request }) => handleStoreChat(request) } },
});
