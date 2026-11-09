import type { UIMessage } from "ai";

export type ChatThread = { id: string; title: string; updatedAt: number; messages: UIMessage[] };

const KEY = "foxgen-chat-threads";
const EVENT = "foxgen-chat-threads";

export function loadThreads(): ChatThread[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(threads: ChatThread[]) {
  window.localStorage.setItem(KEY, JSON.stringify(threads));
  window.dispatchEvent(new Event(EVENT));
}

export function subscribeThreads(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function newThreadId() {
  return crypto.randomUUID().slice(0, 12);
}

export function getThread(id: string) {
  return loadThreads().find((t) => t.id === id);
}

export function saveThreadMessages(id: string, messages: UIMessage[]) {
  const threads = loadThreads();
  const firstUser = messages.find((m) => m.role === "user");
  const firstText = firstUser?.parts.map((p) => (p.type === "text" ? p.text : "")).join(" ").trim();
  const title = firstText ? firstText.slice(0, 40) : "New chat";
  const existing = threads.find((t) => t.id === id);
  const updated: ChatThread = { id, title, updatedAt: Date.now(), messages };
  save(existing ? threads.map((t) => (t.id === id ? updated : t)) : [updated, ...threads]);
}

export function deleteThread(id: string) {
  save(loadThreads().filter((t) => t.id !== id));
}
