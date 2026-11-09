import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createLovableAiGatewayProvider, getLovableAiGatewayRunId, withLovableAiGatewayRunIdHeader } from "./gateway.server";
import { shopProductRows } from "@/lib/shop.server";

const MODEL = "google/gemini-3-flash-preview";
const MAX_MESSAGES = 40;
const MAX_CHARS = 4000;

function json(status: number, error: string) {
  return Response.json({ error }, { status });
}

export async function handleStoreChat(request: Request) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return json(500, "AI is not configured.");

  let messages: UIMessage[];
  try {
    const body = (await request.json()) as { messages?: UIMessage[] };
    if (!Array.isArray(body.messages) || body.messages.length === 0) return json(400, "No messages.");
    messages = body.messages.slice(-MAX_MESSAGES);
  } catch {
    return json(400, "Invalid request.");
  }
  for (const m of messages) {
    if (m.role !== "user" && m.role !== "assistant") return json(400, "Invalid message.");
    const text = (m.parts ?? []).map((p) => (p.type === "text" ? p.text : "")).join("");
    if (text.length > MAX_CHARS) return json(400, "Message is too long.");
  }
  if (messages[messages.length - 1]?.role !== "user") return json(400, "Last message must be from you.");

  let catalog = "";
  try {
    const products = await shopProductRows("website");
    catalog = products
      .map((p) => `- ${p.name} | price: ${p.price_label} | stock: ${p.stock_label}${p.short_description ? ` | ${p.short_description}` : ""}`)
      .join("\n");
  } catch {
    catalog = "(product list unavailable right now)";
  }

  const system = `You are FoxGEN AI, the friendly shopping assistant for the FoxGEN digital store.
Answer in the customer's language (Bengali, Hindi, English, etc.). Keep answers short and clear, use markdown.
Only use the product list below for names, prices and stock. If something isn't listed, say so honestly.
You cannot take payments, confirm orders, or issue licenses. To buy, tell customers to open the Store page and use checkout.
Never invent discounts, payment confirmations or delivery promises.

Current products:
${catalog || "(no products published)"}`;

  const gateway = createLovableAiGatewayProvider(apiKey, getLovableAiGatewayRunId(request), {
    baseURL: "https://ai.gateway.lovable.dev/v1",
  });

  const result = streamText({
    model: gateway(MODEL),
    system,
    messages: await convertToModelMessages(messages),
    maxRetries: 0,
    abortSignal: request.signal,
  });

  const response = result.toUIMessageStreamResponse({
    originalMessages: messages,
    onError: (err) => {
      const status = (err as { statusCode?: number })?.statusCode;
      if (status === 429) return "Too many requests right now — please try again in a moment.";
      if (status === 402) return "The store assistant is temporarily unavailable.";
      return "Sorry, something went wrong. Please try again.";
    },
  });
  return withLovableAiGatewayRunIdHeader(response, gateway);
}
