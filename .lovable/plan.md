# Store AI chat assistant (Gemini)

## What customers will see
- A floating "Ask FoxGEN AI" chat button on Home and Store (light white/cyan style).
- A dedicated chat page `/chat` with a list of past conversations, a "New chat" button, and each conversation at its own link `/chat/<id>` (reload keeps it).
- The assistant answers questions about store products: names, prices, stock, how to buy. It reads the live product list, so answers stay current.
- It never takes payments or confirms orders; it points customers to the Store / checkout.

## Saving chats
- Store customers don't log in, so chats are saved in the customer's own browser (multiple conversations, survive reload). Clearing browser data removes them.

## Technical details
- Model: `google/gemini-3-flash-preview` (resolve exact Gemini ID from the live model list) via Lovable AI Gateway Chat Completions, AI SDK `@ai-sdk/openai-compatible` + `ai`, streaming.
- Server route `src/routes/api/chat.ts` (streams `toUIMessageStreamResponse`); key stays server-side (`LOVABLE_API_KEY`, provision if missing). Product catalog (name, price, stock, active only) loaded server-side and injected into the system prompt. Basic input length limits.
- Routes: `src/routes/chat.tsx` (layout + thread list, Outlet), `chat.index.tsx` (creates/redirects to a thread), `chat.$threadId.tsx` (chat window keyed by thread id). localStorage records `{id,title,updatedAt,messages}`, idempotent bootstrap, no nested buttons.
- UI with AI Elements (Conversation, Message, MessageResponse, PromptInput, PromptInputSubmit), markdown rendering, focused textarea, errors (429/402) shown as friendly messages.
- Each route gets its own head() metadata. Verify with a live chat test in the browser.
