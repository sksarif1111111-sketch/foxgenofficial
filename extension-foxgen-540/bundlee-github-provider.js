(function () {
  "use strict";

  const DEFAULT_TIMEOUT_MS = 90000;

  function normalizeUsage(data) {
    const u = (data && (data.usage || data.usageMetadata)) || {};
    const input = Number(u.prompt_tokens || u.input_tokens || u.promptTokenCount || 0);
    const output = Number(u.completion_tokens || u.output_tokens || u.candidatesTokenCount || 0) + Number(u.thoughtsTokenCount || 0);
    const cached = Number((u.prompt_tokens_details && u.prompt_tokens_details.cached_tokens) || u.cached_tokens || u.cachedContentTokenCount || 0);
    return {
      input_tokens: input,
      output_tokens: output,
      cached_input_tokens: cached,
      total_tokens: Number(u.total_tokens || u.totalTokenCount || (input + output))
    };
  }

  function extractOpenAIText(data) {
    try {
      const choice = data && data.choices && data.choices[0];
      if (choice && choice.message) {
        if (typeof choice.message.content === "string") return choice.message.content.trim();
        if (Array.isArray(choice.message.content)) {
          return choice.message.content.map(part => {
            if (!part) return "";
            if (typeof part === "string") return part;
            return part.text || part.content || "";
          }).join("\n").trim();
        }
      }
      if (typeof data.output_text === "string") return data.output_text.trim();
      return "";
    } catch (_) {
      return "";
    }
  }

  function extractAnthropicText(data) {
    try {
      if (!Array.isArray(data && data.content)) return "";
      return data.content.map(part => (part && part.text) || "").join("\n").trim();
    } catch (_) {
      return "";
    }
  }

  function extractGoogleText(data) {
    try {
      const parts = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
      if (!Array.isArray(parts)) return "";
      return parts.map(part => (part && part.text) || "").join("\n").trim();
    } catch (_) {
      return "";
    }
  }

  function providerName(provider) {
    const names = {
      xkiro: "xKiro",
      atria: "Atria",
      google: "Google AI Studio",
      deepseek: "DeepSeek",
      groq: "Groq",
      openrouter: "OpenRouter",
      anyapi: "AnyAPI (Nemotron 3 Ultra)",
      openai: "OpenAI",
      anthropic: "Anthropic",
      mistral: "Mistral AI",
      xai: "xAI",
      together: "Together AI",
      custom: "Custom provider"
    };
    return names[provider] || "AI provider";
  }

  const XKIRO_MODELS_URL = "https://api.xkiro.com/v1/models";
  const XKIRO_CHAT_URL = "https://api.xkiro.com/v1/chat/completions";
  const XKIRO_USAGE_URL = "https://api.xkiro.com/v1/usage";
  const XKIRO_MODEL_CACHE_MS = 5 * 60 * 1000;
  const ANTHROPIC_MODELS_URL = "https://api.anthropic.com/v1/models?limit=100";
  const ANTHROPIC_MODEL_CACHE_MS = 5 * 60 * 1000;
  const anthropicModelCache = new Map();
  const XKIRO_MODEL_HEALTH_KEY = "lovasiri_xkiro_model_health_v1";
  const XKIRO_FAILURE_COOLDOWN_MS = 20 * 60 * 1000;
  let xKiroFreeModelCache = { expiresAt: 0, models: [] };

  async function loadXKiroModelHealth() {
    try {
      const result = await chrome.storage.local.get([XKIRO_MODEL_HEALTH_KEY]);
      const value = result && result[XKIRO_MODEL_HEALTH_KEY];
      return value && typeof value === "object" ? value : {};
    } catch (_) {
      return {};
    }
  }

  async function recordXKiroModelHealth(modelId, ok, latencyMs, errorCode) {
    const id = String(modelId || "").trim();
    if (!id) return;
    try {
      const health = await loadXKiroModelHealth();
      const prev = health[id] && typeof health[id] === "object" ? health[id] : {};
      const now = Date.now();
      const successes = Math.max(0, Number(prev.successes || 0)) + (ok ? 1 : 0);
      const failures = Math.max(0, Number(prev.failures || 0)) + (ok ? 0 : 1);
      let avgLatencyMs = Math.max(0, Number(prev.avgLatencyMs || 0));
      const latency = Math.max(0, Number(latencyMs || 0));
      if (ok && latency) avgLatencyMs = avgLatencyMs ? Math.round(avgLatencyMs * 0.7 + latency * 0.3) : Math.round(latency);
      health[id] = {
        successes,
        failures,
        consecutiveFailures: ok ? 0 : Math.max(0, Number(prev.consecutiveFailures || 0)) + 1,
        avgLatencyMs,
        lastSuccessAt: ok ? now : Number(prev.lastSuccessAt || 0),
        lastFailureAt: ok ? Number(prev.lastFailureAt || 0) : now,
        lastErrorCode: ok ? "" : String(errorCode || "unknown")
      };
      // Bound storage so a changing live catalog cannot grow this forever.
      const entries = Object.entries(health).sort((a, b) => Math.max(Number(b[1].lastSuccessAt || 0), Number(b[1].lastFailureAt || 0)) - Math.max(Number(a[1].lastSuccessAt || 0), Number(a[1].lastFailureAt || 0))).slice(0, 40);
      await chrome.storage.local.set({ [XKIRO_MODEL_HEALTH_KEY]: Object.fromEntries(entries) });
    } catch (_) {}
  }

  function xKiroHealthScore(modelId, health) {
    const h = health && health[String(modelId || "")];
    if (!h) return 0;
    const now = Date.now();
    const lastFailureAt = Number(h.lastFailureAt || 0);
    const lastSuccessAt = Number(h.lastSuccessAt || 0);
    const consecutiveFailures = Math.max(0, Number(h.consecutiveFailures || 0));
    let score = 0;
    if (lastFailureAt && now - lastFailureAt < XKIRO_FAILURE_COOLDOWN_MS) {
      score -= 220000 + Math.min(3, consecutiveFailures) * 90000;
    }
    if (lastSuccessAt && now - lastSuccessAt < 24 * 60 * 60 * 1000) score += 25000;
    const successes = Math.max(0, Number(h.successes || 0));
    const failures = Math.max(0, Number(h.failures || 0));
    if (successes + failures >= 2) score += Math.round((successes / (successes + failures)) * 30000);
    const avgLatency = Math.max(0, Number(h.avgLatencyMs || 0));
    if (avgLatency) score += Math.max(-15000, Math.min(15000, Math.round((90000 - avgLatency) / 6)));
    return score;
  }

  function cleanProviderDetail(detail) {
    const raw = String(detail || "").trim();
    if (!raw) return "";
    // Never surface an upstream proxy/load-balancer HTML page to the user.
    // Some ALB/nginx error pages begin with <head> or <title> instead of <html>.
    if (
      /<\/?(?:html|head|body|title|center|hr|script|style|!doctype)\b/i.test(raw) ||
      /(?:bad gateway|gateway time-?out|application load balancer|cloudflare|nginx|\balb\b)/i.test(raw) && /<[^>]+>/.test(raw)
    ) return "";
    return raw.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").slice(0, 320).trim();
  }

  function isTransientGatewayStatus(status) {
    return status === 502 || status === 503 || status === 504;
  }

  function atriaEmptyResponseMessage(data, isTest) {
    let finish = "";
    try {
      finish = String(data && data.choices && data.choices[0] && data.choices[0].finish_reason || "").trim();
    } catch (_) {}
    const suffix = finish ? ` (finish reason: ${finish})` : "";
    return isTest
      ? `Atria connection succeeded, but the model returned no text${suffix}. This may be a temporary Atria backend issue. Please retry.`
      : `Atria returned no generated text${suffix}. This may be a temporary Atria backend issue. Please retry.`;
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function providerCacheFingerprint(value) {
    const text = String(value || "");
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16);
  }

  function anthropicHeaders(apiKey, workspaceId, extra) {
    const headers = Object.assign({
      "Accept": "application/json",
      "x-api-key": String(apiKey || "").trim(),
      "anthropic-version": "2023-06-01"
    }, extra || {});
    const workspace = String(workspaceId || "").trim();
    if (workspace) headers["anthropic-workspace-id"] = workspace;
    return headers;
  }

  function friendlyAnthropicError(err) {
    const rawDetail = String(
      err && err.providerData && err.providerData.error && err.providerData.error.message ||
      err && err.providerData && err.providerData.message ||
      err && err.message || ""
    );
    if (/workspace.+not found|valid workspace id|workspace id.+invalid/i.test(rawDetail)) {
      const e = new Error("Anthropic Workspace ID is invalid or this API key cannot access it. Check Claude Console → Settings → Workspaces and try again.");
      e.status = err && err.status;
      e.code = "anthropic_workspace_invalid";
      return e;
    }
    if (/anthropic-workspace-id.+required|workspace.+required|not scoped to a workspace|identity-linked API key/i.test(rawDetail)) {
      const e = new Error("Anthropic workspace required. Enter the Workspace ID (starts with wrkspc_) in Settings, then test the connection again.");
      e.status = err && err.status;
      e.code = "anthropic_workspace_required";
      return e;
    }
    return err;
  }

  async function anthropicFetchJson(url, options, workspaceId, timeoutMs) {
    try {
      const base = options || {};
      return await fetchJson(url, Object.assign({}, base, {
        headers: anthropicHeaders(
          base.headers && base.headers["x-api-key"],
          workspaceId,
          base.headers
        )
      }), "anthropic", timeoutMs || DEFAULT_TIMEOUT_MS);
    } catch (err) {
      throw friendlyAnthropicError(err);
    }
  }

  function normalizeAnthropicModel(model) {
    if (!model || typeof model.id !== "string" || !model.id.trim()) return null;
    return {
      id: String(model.id),
      display_name: String(model.display_name || model.id),
      created_at: String(model.created_at || ""),
      max_input_tokens: Number(model.max_input_tokens || 0) || null,
      max_tokens: Number(model.max_tokens || 0) || null,
      capabilities: model.capabilities && typeof model.capabilities === "object" ? model.capabilities : null
    };
  }

  async function getAnthropicModels(apiKey, workspaceId, forceRefresh) {
    const key = providerCacheFingerprint(String(apiKey || "") + "|" + String(workspaceId || ""));
    const now = Date.now();
    const cached = anthropicModelCache.get(key);
    if (!forceRefresh && cached && cached.expiresAt > now && Array.isArray(cached.models) && cached.models.length) {
      return cached.models;
    }
    let response;
    try {
      response = await fetchJson(ANTHROPIC_MODELS_URL, {
        method: "GET",
        headers: anthropicHeaders(apiKey, workspaceId)
      }, "anthropic", 20000);
    } catch (err) {
      throw friendlyAnthropicError(err);
    }
    const models = (Array.isArray(response && response.data && response.data.data) ? response.data.data : [])
      .map(normalizeAnthropicModel)
      .filter(Boolean);
    if (!models.length) throw new Error("Anthropic connected, but no available Claude models were returned for this key/workspace.");
    anthropicModelCache.set(key, { expiresAt: now + ANTHROPIC_MODEL_CACHE_MS, models });
    return models;
  }

  function pickAnthropicModel(models, requestedModel) {
    const list = Array.isArray(models) ? models.filter(Boolean) : [];
    if (!list.length) return null;
    const requested = String(requestedModel || "").trim();
    if (requested && !/^auto(?:\b|[-_ ])/i.test(requested)) {
      const exact = list.find(m => String(m.id || "") === requested);
      if (exact) return exact;
    }
    // Anthropic documents /v1/models as the live catalog and lists newer
    // releases first. Auto prefers the newest Sonnet available to this key,
    // then another current Claude family model without relying on stale IDs.
    const sonnet = list.find(m => /claude-sonnet/i.test(String(m.id || "")));
    if (sonnet) return sonnet;
    const opus = list.find(m => /claude-opus/i.test(String(m.id || "")));
    if (opus) return opus;
    const haiku = list.find(m => /claude-haiku/i.test(String(m.id || "")));
    if (haiku) return haiku;
    return list[0];
  }

  async function getXKiroFreeModels(forceRefresh) {
    const now = Date.now();
    if (!forceRefresh && xKiroFreeModelCache.expiresAt > now && xKiroFreeModelCache.models.length) {
      return xKiroFreeModelCache.models;
    }

    // xKiro documents /v1/models as the live source of truth. It is public and
    // each model carries access_tier: free | paid | premium.
    const { data } = await fetchJson(XKIRO_MODELS_URL, {
      method: "GET",
      headers: { "Accept": "application/json" }
    }, "xkiro", 20000);

    const all = Array.isArray(data && data.data) ? data.data : [];
    const free = all.filter(model => {
      if (!model || typeof model.id !== "string" || !model.id.trim()) return false;
      if (String(model.access_tier || "").toLowerCase() !== "free") return false;
      const modality = String(model.modality || "chat").toLowerCase();
      return modality === "chat";
    });

    if (!free.length) {
      throw new Error("xKiro is reachable, but its live catalog currently lists no free chat models. Please try again later or check your xKiro plan.");
    }

    xKiroFreeModelCache = { expiresAt: now + XKIRO_MODEL_CACHE_MS, models: free };
    return free;
  }


  function publicXKiroModelInfo(model) {
    const caps = (model && model.capabilities) || {};
    return {
      id: String(model && model.id || ""),
      name: String(model && (model.name || model.display_name || model.id) || ""),
      context_length: Number(model && model.context_length || 0),
      max_output_tokens: Number(model && model.max_output_tokens || 0),
      reasoning: !!caps.reasoning,
      tools: !!caps.tools,
      vision: !!caps.vision
    };
  }


  function nextUtcMidnightIso() {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0)).toISOString();
  }

  async function getXKiroUsage(apiKey) {
    const key = String(apiKey || "").trim();
    if (!key) throw new Error("xKiro API key is required.");
    const { data } = await fetchJson(XKIRO_USAGE_URL, {
      method: "GET",
      headers: { "Accept": "application/json", "Authorization": `Bearer ${key}` }
    }, "xkiro", 20000);
    const free = (data && data.free_tokens) || {};
    const user = (data && data.user) || {};
    const limit = free.limit_per_day == null ? null : Number(free.limit_per_day);
    const remaining = free.remaining == null ? null : Math.max(0, Number(free.remaining));
    const used = free.used_today == null ? null : Math.max(0, Number(free.used_today));
    return {
      ok: true,
      plan: data && data.plan || null,
      user: { name: String(user.name || ""), email: String(user.email || "") },
      free_tokens: { used_today: used, limit_per_day: limit, remaining },
      reset_at: nextUtcMidnightIso()
    };
  }

  function formatCompactTokens(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "unlimited";
    if (n >= 1000000000) return (n / 1000000000).toFixed(n % 1000000000 ? 1 : 0) + "B";
    if (n >= 1000000) return (n / 1000000).toFixed(n % 1000000 ? 1 : 0) + "M";
    if (n >= 1000) return Math.round(n / 1000) + "K";
    return String(Math.round(n));
  }

  async function xKiroQuotaErrorIfExhausted(apiKey) {
    try {
      const usage = await getXKiroUsage(apiKey);
      const free = usage.free_tokens || {};
      if (free.limit_per_day != null && Number(free.remaining) <= 0) {
        const err = new Error(`Your xKiro free allowance is currently exhausted. Your work and prompt are safe. Add another saved xKiro API key, switch to Gemini/OpenAI, or retry after the daily reset. Free allowance: ${formatCompactTokens(free.used_today)} / ${formatCompactTokens(free.limit_per_day)} used.`);
        err.code = "xkiro_free_allowance_exhausted";
        err.usage = usage;
        return err;
      }
    } catch (_) {}
    return null;
  }

  function isXKiroAutoModel(value) {
    const v = String(value || "").trim().toLowerCase();
    return !v || v === "auto" || v === "auto free model" || v === "auto free model (live catalog)";
  }

  async function handleXKiroListFreeModels(msg) {
    const models = await getXKiroFreeModels(!!(msg && msg.forceRefresh));
    return {
      ok: true,
      models: models.map(publicXKiroModelInfo),
      cachedForMs: XKIRO_MODEL_CACHE_MS
    };
  }

  function xKiroLevelFromReasoning(reasoningEffort) {
    const effort = String(reasoningEffort || "").toLowerCase();
    if (effort === "high" || effort === "xhigh" || effort === "max") return "super";
    if (effort === "medium") return "medium";
    return "basic";
  }

  function pickXKiroFreeModel(models, level, excludedIds, requireVision, health) {
    const excluded = excludedIds || new Set();
    const candidates = (Array.isArray(models) ? models : []).filter(m => {
      if (excluded.has(String(m && m.id || ""))) return false;
      if (requireVision && !(m && m.capabilities && m.capabilities.vision)) return false;
      return true;
    });
    if (!candidates.length) return null;
    level = String(level || "basic").toLowerCase();

    // The catalog does not publish a quality ranking. Select only from the free
    // tier and use capability/context metadata to make the three public modes
    // deterministic without hard-coding a model that could later become paid.
    const scored = candidates.map((m, index) => {
      const caps = (m && m.capabilities) || {};
      const context = Number(m && m.context_length || 0);
      const output = Number(m && m.max_output_tokens || 0);
      let score = Math.min(context, 1000000) / 1000 + Math.min(output, 100000) / 100;
      // Auto selection is task-fit + observed reliability, not a hard-coded model name.
      // A recently failing/slow model is deprioritized so Auto does not keep choosing it.
      score += xKiroHealthScore(m && m.id, health);
      if (level === "super") {
        if (caps.reasoning) score += 100000;
        if (caps.tools) score += 25000;
        if (caps.vision) score += 5000;
      } else if (level === "medium") {
        if (caps.tools) score += 60000;
        if (caps.reasoning) score += 30000;
        if (caps.vision) score += 5000;
      } else {
        // Basic favors a straightforward non-reasoning chat model when one is available.
        if (!caps.reasoning) score += 60000;
        if (caps.tools) score += 5000;
      }
      return { model: m, score, index };
    });
    scored.sort((a, b) => b.score - a.score || a.index - b.index || String(a.model.id).localeCompare(String(b.model.id)));
    return scored[0].model;
  }

  function xKiroCompatibleReasoningEffort(model, desired) {
    const levels = model && model.reasoning_efforts && Array.isArray(model.reasoning_efforts.levels)
      ? model.reasoning_efforts.levels.map(v => String(v).toLowerCase())
      : [];
    if (!levels.length || !(model && model.capabilities && model.capabilities.reasoning)) return "";
    desired = String(desired || "").toLowerCase();
    if (levels.includes(desired)) return desired;
    const fallbackOrder = desired === "high" || desired === "xhigh" || desired === "max"
      ? ["high", "max", "xhigh", "medium", "low", "none"]
      : desired === "medium"
        ? ["medium", "high", "low", "max", "xhigh", "none"]
        : ["low", "none", "medium", "high", "max", "xhigh"];
    return fallbackOrder.find(v => levels.includes(v)) || "";
  }

  function readableHttpError(provider, status, detail) {
    const name = providerName(provider);
    const clean = cleanProviderDetail(detail);
    if (status === 401) return `${name}: invalid or missing API key (401). Check the key and try again.${clean ? " " + clean : ""}`;
    if (status === 403) return `${name}: access denied (403). The selected model or account tier is not allowed for this key.${clean ? " " + clean : ""}`;
    if (status === 404) return `${name}: endpoint or model not found (404). Check the selected provider/model.${clean ? " " + clean : ""}`;
    if (provider === "xkiro" && status === 409) return "xKiro is still processing an identical request (409). The extension will keep one request active at a time; please wait for the current job to finish.";
    if (status === 429) return `${name}: rate limit or quota reached (429). Wait a moment or check your provider quota.${clean ? " " + clean : ""}`;
    if (provider === "atria" && status === 502) return "Atria is temporarily unavailable (502 Bad Gateway). Its gateway could not get a valid response from the model server. Please try again shortly.";
    if (provider === "atria" && status === 503) return "Atria is temporarily unavailable (503 Service Unavailable). Please try again shortly.";
    if (provider === "atria" && status === 504) return "Atria took too long to respond (504 Gateway Timeout). Please try again shortly.";
    if (status >= 500) return `${name}: provider server error (${status}). Please try again later.${clean ? " " + clean : ""}`;
    return `${name}: request failed (HTTP ${status}).${clean ? " " + clean : ""}`;
  }

  function detailFromData(data) {
    if (!data || typeof data !== "object") return "";
    const err = data.error;
    if (typeof err === "string") return err;
    if (err && typeof err.message === "string") return err.message;
    if (typeof data.message === "string") return data.message;
    if (typeof data.detail === "string") return data.detail;
    return "";
  }

  async function fetchJson(url, options, provider, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(1000, Number(timeoutMs || DEFAULT_TIMEOUT_MS)));
    try {
      const res = await fetch(url, Object.assign({}, options || {}, { signal: controller.signal }));
      const raw = await res.text().catch(() => "");
      let data = {};
      let parsedJson = !raw;
      if (raw) {
        try { data = JSON.parse(raw); parsedJson = true; }
        catch (_) { data = { message: cleanProviderDetail(raw) }; }
      }
      if (!res.ok) {
        const httpError = new Error(readableHttpError(provider, res.status, detailFromData(data)));
        httpError.status = res.status;
        httpError.providerData = data;
        throw httpError;
      }
      if (!parsedJson && raw) {
        const invalid = new Error(`${providerName(provider)} returned a non-JSON server response. Please retry.`);
        invalid.status = res.status;
        throw invalid;
      }
      return { res, data };
    } catch (err) {
      if (err && err.name === "AbortError") {
        throw new Error(`${providerName(provider)}: request timed out. Please try again.`);
      }
      if (err instanceof TypeError) {
        throw new Error(`${providerName(provider)}: network connection failed. Check your internet connection and provider URL.`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  function customEndpoint(base) {
    let endpoint = String(base || "").trim().replace(/\/+$/, "");
    if (!endpoint) return "";
    if (/\/chat\/completions$/i.test(endpoint)) return endpoint;
    return endpoint + "/chat/completions";
  }

  function standardMessages(systemPrompt, messages) {
    return [{ role: "system", content: systemPrompt }, ...messages];
  }

  function messageContentParts(content) {
    return Array.isArray(content) ? content : [{ type: "text", text: String(content == null ? "" : content) }];
  }

  function messagesContainImages(messages) {
    return (Array.isArray(messages) ? messages : []).some(message =>
      messageContentParts(message && message.content).some(part =>
        part && (part.type === "image_url" || part.type === "image" || part.inlineData || part.inline_data)
      )
    );
  }

  function parseImageDataUrl(url) {
    const value = String(url || "");
    const match = value.match(/^data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)$/i);
    if (!match) return null;
    return { mimeType: String(match[1] || "image/jpeg").toLowerCase(), data: String(match[2] || "").replace(/\s+/g, "") };
  }

  async function remoteImageToInlineData(url) {
    const value = String(url || "").trim();
    const inline = parseImageDataUrl(value);
    if (inline) return inline;
    if (!/^https?:\/\//i.test(value)) throw new Error("The attached image could not be read. Please attach the image again.");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(value, { method: "GET", redirect: "follow", cache: "no-store", signal: controller.signal });
      if (!res.ok) throw new Error(`Image download failed (${res.status}).`);
      const type = String(res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
      if (type && !type.startsWith("image/")) throw new Error("The attachment URL did not return an image.");
      const buffer = new Uint8Array(await res.arrayBuffer());
      if (buffer.byteLength > 8 * 1024 * 1024) throw new Error("The attached image is too large after download (max 8 MB).");
      let raw = "";
      const chunk = 0x8000;
      for (let i = 0; i < buffer.length; i += chunk) raw += String.fromCharCode(...buffer.subarray(i, i + chunk));
      return { mimeType: type || "image/jpeg", data: btoa(raw) };
    } finally {
      clearTimeout(timer);
    }
  }

  async function anthropicMessageParts(content) {
    const out = [];
    for (const part of messageContentParts(content)) {
      if (!part) continue;
      if (part.type === "text") {
        if (String(part.text || "").trim()) out.push({ type: "text", text: String(part.text || "") });
        continue;
      }
      if (part.type === "image_url") {
        const imageUrl = typeof part.image_url === "string" ? part.image_url : part.image_url && part.image_url.url;
        if (!imageUrl) continue;
        const inline = await remoteImageToInlineData(imageUrl);
        out.push({
          type: "image",
          source: { type: "base64", media_type: inline.mimeType || "image/jpeg", data: inline.data }
        });
      }
    }
    return out.length ? out : [{ type: "text", text: "" }];
  }

  async function googleMessageParts(content) {
    const out = [];
    for (const part of messageContentParts(content)) {
      if (!part) continue;
      if (part.type === "text") {
        if (String(part.text || "").trim()) out.push({ text: String(part.text || "") });
        continue;
      }
      if (part.type === "image_url") {
        const imageUrl = typeof part.image_url === "string" ? part.image_url : part.image_url && part.image_url.url;
        if (!imageUrl) continue;
        const inline = await remoteImageToInlineData(imageUrl);
        out.push({ inlineData: { mimeType: inline.mimeType, data: inline.data } });
      }
    }
    return out.length ? out : [{ text: "" }];
  }

  async function validateRemoteImageUrls(urls) {
    const unique = Array.from(new Set((Array.isArray(urls) ? urls : []).map(v => String(v || "").trim()).filter(v => /^https?:\/\//i.test(v)))).slice(0, 16);
    const results = await Promise.all(unique.map(async url => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      try {
        const res = await fetch(url, { method: "GET", redirect: "follow", cache: "no-store", signal: controller.signal });
        const contentType = String(res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
        const ok = !!res.ok && (!contentType || contentType.startsWith("image/"));
        try { if (res.body && typeof res.body.cancel === "function") await res.body.cancel(); } catch (_) {}
        return {
          url,
          ok,
          status: Number(res.status || 0),
          contentType,
          reason: ok ? "" : (!res.ok ? `HTTP ${res.status}` : `Expected image content but received ${contentType || "unknown content"}`)
        };
      } catch (err) {
        return { url, ok: false, status: 0, contentType: "", reason: err && err.name === "AbortError" ? "Timed out" : String(err && err.message || err) };
      } finally {
        clearTimeout(timer);
      }
    }));
    return { ok: true, results };
  }

  async function openAICompatible(provider, url, apiKey, model, systemPrompt, messages, maxOutputTokens, extras, headers) {
    const body = Object.assign({
      model,
      messages: standardMessages(systemPrompt, messages),
      max_tokens: maxOutputTokens
    }, extras || {});
    const requestHeaders = Object.assign({
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    }, headers || {});
    const { data } = await fetchJson(url, {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify(body)
    }, provider, DEFAULT_TIMEOUT_MS);
    const text = extractOpenAIText(data);
    if (!text) throw new Error(`${providerName(provider)} returned an empty AI response.`);
    return { text, data };
  }


  async function openAICompatibleStream(provider, url, apiKey, model, systemPrompt, messages, maxOutputTokens, extras, headers, timing) {
    const extraBody = Object.assign({}, extras || {});
    const useMaxCompletionTokens = !!extraBody.__useMaxCompletionTokens;
    delete extraBody.__useMaxCompletionTokens;
    const body = {
      model,
      messages: standardMessages(systemPrompt, messages),
      stream: true,
      stream_options: { include_usage: true }
    };
    if (useMaxCompletionTokens) body.max_completion_tokens = maxOutputTokens;
    else body.max_tokens = maxOutputTokens;
    Object.assign(body, extraBody);
    const requestHeaders = Object.assign({
      "Content-Type": "application/json",
      "Accept": "text/event-stream",
      "Authorization": `Bearer ${apiKey}`
    }, headers || {});
    const controller = new AbortController();
    const headerTimeoutMs = Math.max(10000, Number(timing && timing.headerTimeoutMs || 30000));
    const firstChunkTimeoutMs = Math.max(15000, Number(timing && timing.firstChunkTimeoutMs || 45000));
    const idleTimeoutMs = Math.max(20000, Number(timing && timing.idleTimeoutMs || 75000));
    const hardTimeoutMs = Math.max(30000, Number(timing && timing.hardTimeoutMs || 270000));
    let abortReason = "";
    const headerTimer = setTimeout(() => { abortReason = "header"; try { controller.abort(); } catch (_) {} }, headerTimeoutMs);
    let res;
    try {
      res = await fetch(url, { method: "POST", headers: requestHeaders, body: JSON.stringify(body), signal: controller.signal });
    } catch (err) {
      if (err && err.name === "AbortError") {
        const e = new Error(`${providerName(provider)}: connection timed out before streaming started. Trying another available model may help.`);
        e.code = "xkiro_stream_start_timeout";
        throw e;
      }
      if (err instanceof TypeError) {
        const e = new Error(`${providerName(provider)}: network connection failed. Check your internet connection.`);
        e.code = "xkiro_network_error";
        throw e;
      }
      throw err;
    } finally {
      clearTimeout(headerTimer);
    }
    if (!res.ok) {
      const raw = await res.text().catch(() => "");
      let data = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch (_) { data = { message: cleanProviderDetail(raw) }; }
      const httpError = new Error(readableHttpError(provider, res.status, detailFromData(data)));
      httpError.status = res.status;
      httpError.providerData = data;
      throw httpError;
    }
    if (!res.body || typeof res.body.getReader !== "function") {
      const e = new Error(`${providerName(provider)} did not provide a readable stream. Please retry.`);
      e.code = "xkiro_stream_unreadable";
      throw e;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    let usage = null;
    let finishReason = "";
    let gotAnyChunk = false;
    let idleTimer = null;
    let keepAliveTimer = null;
    const resetIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      const timeout = gotAnyChunk ? idleTimeoutMs : firstChunkTimeoutMs;
      idleTimer = setTimeout(() => {
        abortReason = gotAnyChunk ? "idle" : "first_chunk";
        try { controller.abort(); } catch (_) {}
      }, timeout);
    };
    const hardTimer = setTimeout(() => {
      abortReason = "hard";
      try { controller.abort(); } catch (_) {}
    }, hardTimeoutMs);
    // Long streamed coding jobs are exceptional but legitimate. A lightweight
    // extension API call periodically refreshes the MV3 worker idle clock while
    // the fetch is actively producing/awaiting stream data.
    keepAliveTimer = setInterval(() => {
      try { chrome.runtime.getPlatformInfo(() => void chrome.runtime.lastError); } catch (_) {}
    }, 20000);
    resetIdleTimer();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        gotAnyChunk = true;
        resetIdleTimer();
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          let chunk;
          try { chunk = JSON.parse(payload); } catch (_) { continue; }
          if (chunk && chunk.error) {
            const e = new Error(cleanProviderDetail(chunk.error.message || chunk.error) || `${providerName(provider)} stream returned an error.`);
            e.code = "xkiro_stream_provider_error";
            throw e;
          }
          const choice = chunk && chunk.choices && chunk.choices[0];
          const delta = choice && choice.delta && choice.delta.content;
          if (typeof delta === "string") text += delta;
          else if (Array.isArray(delta)) text += delta.map(part => part && (part.text || part.content) || "").join("");
          if (choice && choice.finish_reason) finishReason = String(choice.finish_reason);
          if (chunk && chunk.usage) usage = chunk.usage;
        }
      }
    } catch (err) {
      if (err && err.name === "AbortError") {
        let message = `${providerName(provider)}: generation stopped safely.`;
        let code = "xkiro_stream_timeout";
        if (abortReason === "first_chunk") {
          message = `${providerName(provider)}: this model did not begin streaming in time. The extension can switch to another free model.`;
          code = "xkiro_stream_first_chunk_timeout";
        } else if (abortReason === "idle") {
          message = `${providerName(provider)}: this model stopped sending output for too long. The extension can switch to another free model.`;
          code = "xkiro_stream_idle_timeout";
        } else if (abortReason === "hard") {
          message = `${providerName(provider)}: this generation reached the safe browser limit. Your prompt is safe; another free model can be tried.`;
          code = "xkiro_stream_hard_timeout";
        }
        const e = new Error(message);
        e.code = code;
        throw e;
      }
      throw err;
    } finally {
      clearTimeout(hardTimer);
      if (idleTimer) clearTimeout(idleTimer);
      if (keepAliveTimer) clearInterval(keepAliveTimer);
      try { reader.releaseLock(); } catch (_) {}
    }
    text = String(text || "").trim();
    if (!text) {
      const e = new Error(`${providerName(provider)} returned an empty streamed response.`);
      e.code = "xkiro_empty_stream";
      throw e;
    }
    if (finishReason === "length") {
      const err = new Error(`${providerName(provider)} stopped because the output limit was reached. The extension will not apply a potentially truncated result.`);
      err.code = "output_truncated";
      throw err;
    }
    return { text, data: { choices: [{ message: { content: text }, finish_reason: finishReason || "stop" }], usage: usage || {} } };
  }


  function extractOpenAIResponsesText(data) {
    try {
      if (typeof (data && data.output_text) === "string" && data.output_text.trim()) return data.output_text.trim();
      const chunks = [];
      for (const item of (data && Array.isArray(data.output) ? data.output : [])) {
        if (!item || item.type !== "message" || !Array.isArray(item.content)) continue;
        for (const part of item.content) {
          if (!part) continue;
          if (part.type === "output_text" && typeof part.text === "string") chunks.push(part.text);
          else if (typeof part.text === "string") chunks.push(part.text);
        }
      }
      return chunks.join("\n").trim();
    } catch (_) {
      return "";
    }
  }

  function openAIResponsesInput(messages) {
    const out = [];
    for (const message of (Array.isArray(messages) ? messages : [])) {
      if (!message || message.role === "system") continue;
      const role = message.role === "assistant" ? "assistant" : "user";
      const content = message.content;
      if (!Array.isArray(content)) {
        out.push({ role, content: String(content == null ? "" : content) });
        continue;
      }
      const parts = [];
      for (const part of content) {
        if (!part) continue;
        if (part.type === "text") {
          const text = String(part.text || "");
          if (text) parts.push({ type: "input_text", text });
          continue;
        }
        if (part.type === "image_url") {
          const imageUrl = typeof part.image_url === "string" ? part.image_url : part.image_url && part.image_url.url;
          if (imageUrl) parts.push({ type: "input_image", image_url: imageUrl });
          continue;
        }
      }
      out.push({ role, content: parts.length ? parts : [{ type: "input_text", text: "" }] });
    }
    return out.length ? out : [{ role: "user", content: "" }];
  }

  async function openAIResponsesBackground(apiKey, model, systemPrompt, messages, maxOutputTokens, reasoningEffort, timing) {
    const createTimeoutMs = Math.max(10000, Number(timing && timing.createTimeoutMs || 20000));
    const pollTimeoutMs = Math.max(10000, Number(timing && timing.pollTimeoutMs || 18000));
    const pollEveryMs = Math.max(1200, Number(timing && timing.pollEveryMs || 2500));
    const hardTimeoutMs = Math.max(30000, Number(timing && timing.hardTimeoutMs || 270000));
    const body = {
      model,
      instructions: systemPrompt,
      input: openAIResponsesInput(messages),
      background: true,
      store: false,
      max_output_tokens: maxOutputTokens
    };
    if (reasoningEffort) body.reasoning = { effort: reasoningEffort };

    const launched = await fetchJson("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    }, "openai", createTimeoutMs);

    let data = launched && launched.data || null;
    const responseId = String(data && data.id || "");
    if (!responseId) throw new Error("OpenAI did not return a background response ID. Please retry.");

    const deadline = Date.now() + hardTimeoutMs;
    let keepAliveTimer = null;
    try {
      keepAliveTimer = setInterval(() => {
        try { chrome.runtime.getPlatformInfo(() => void chrome.runtime.lastError); } catch (_) {}
      }, 20000);

      let consecutivePollErrors = 0;
      while (data && (data.status === "queued" || data.status === "in_progress")) {
        if (Date.now() >= deadline) {
          try {
            await fetchJson(`https://api.openai.com/v1/responses/${encodeURIComponent(responseId)}/cancel`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
              },
              body: "{}"
            }, "openai", 12000);
          } catch (_) {}
          const e = new Error("OpenAI: generation is still running after the safe browser window and was cancelled safely. Your prompt is saved; retry when ready.");
          e.code = "openai_background_hard_timeout";
          throw e;
        }
        await new Promise(resolve => setTimeout(resolve, pollEveryMs));
        try {
          const polled = await fetchJson(`https://api.openai.com/v1/responses/${encodeURIComponent(responseId)}`, {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${apiKey}`
            }
          }, "openai", pollTimeoutMs);
          data = polled && polled.data || data;
          consecutivePollErrors = 0;
        } catch (pollErr) {
          consecutivePollErrors += 1;
          // The OpenAI job is still running server-side. A brief failed poll must
          // not throw away a healthy paid generation. Retry polling a few times.
          if (consecutivePollErrors <= 3 && Date.now() < deadline) continue;
          try {
            await fetchJson(`https://api.openai.com/v1/responses/${encodeURIComponent(responseId)}/cancel`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
              },
              body: "{}"
            }, "openai", 12000);
          } catch (_) {}
          throw pollErr;
        }
      }
    } finally {
      if (keepAliveTimer) clearInterval(keepAliveTimer);
    }

    const status = String(data && data.status || "");
    if (status === "incomplete") {
      const reason = String(data && data.incomplete_details && data.incomplete_details.reason || "");
      if (reason === "max_output_tokens") {
        const e = new Error("OpenAI stopped because the output limit was reached. The extension will not apply a potentially truncated result.");
        e.code = "output_truncated";
        throw e;
      }
      throw new Error(`OpenAI background response was incomplete${reason ? ` (${reason})` : ""}. Your prompt is safe.`);
    }
    if (status && status !== "completed") {
      const detail = cleanProviderDetail(data && data.error && (data.error.message || data.error) || "");
      throw new Error(detail ? `OpenAI: ${detail}` : `OpenAI background response ended with status ${status}.`);
    }
    const text = extractOpenAIResponsesText(data);
    if (!text) throw new Error("OpenAI returned an empty background response.");
    return { text, data };
  }

  async function handlePublicByokInternal(msg) {
    const provider = String(msg.provider || "xkiro").toLowerCase();
    const apiKey = String(msg.apiKey || "").trim();
    const requestedModel = String(msg.model || "").trim();
    const apiBase = String(msg.apiBase || "").trim();
    const messages = Array.isArray(msg.messages) ? msg.messages : [];
    const systemPrompt = String(msg.systemPrompt || "You are an expert software engineer.");
    const maxOutputTokens = Math.max(32, Math.min(32768, Number(msg.maxOutputTokens || 2200)));
    const reasoningEffort = String(msg.reasoningEffort || "").trim().toLowerCase();
    if (!apiKey) throw new Error("API key is required.");

    let usedModel = requestedModel;
    let text = "";
    let data = null;

    if (provider === "xkiro") {
      const level = xKiroLevelFromReasoning(reasoningEffort);
      const excluded = new Set();
      const manualSelection = !isXKiroAutoModel(requestedModel);
      const requireVision = messagesContainImages(messages);
      const attemptedModels = [];
      let fallbackFrom = "";
      let lastError = null;
      let health = await loadXKiroModelHealth();
      // Keep the entire background request below Chrome's long-event ceiling.
      // Fast/stalled models are replaced early; healthy streams may run longer.
      const generationDeadline = Date.now() + 270000;
      const maxAttempts = 3;

      function isFallbackWorthy(err) {
        if (!err) return false;
        if ([408, 429, 500, 502, 503, 504].includes(Number(err.status || 0))) return true;
        return [
          "xkiro_stream_start_timeout", "xkiro_stream_first_chunk_timeout",
          "xkiro_stream_idle_timeout", "xkiro_stream_hard_timeout",
          "xkiro_network_error", "xkiro_stream_unreadable", "xkiro_empty_stream",
          "xkiro_stream_provider_error"
        ].includes(String(err.code || ""));
      }

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const remainingMs = generationDeadline - Date.now();
        if (remainingMs < 30000) break;
        const freeModels = await getXKiroFreeModels(attempt > 0);
        let selected = null;
        if (manualSelection && attempt === 0) {
          selected = freeModels.find(m => String(m && m.id || "") === requestedModel) || null;
          if (!selected) {
            // A model removed from the free catalog is automatically replaced by
            // the healthiest compatible free option rather than killing the job.
            fallbackFrom = requestedModel;
            selected = pickXKiroFreeModel(freeModels, level, excluded, requireVision, health);
          }
          if (selected && requireVision && !(selected.capabilities && selected.capabilities.vision)) {
            fallbackFrom = String(selected.id || requestedModel);
            excluded.add(String(selected.id || requestedModel));
            selected = pickXKiroFreeModel(freeModels, level, excluded, true, health);
          }
        } else {
          selected = pickXKiroFreeModel(freeModels, level, excluded, requireVision, health);
        }
        if (!selected) {
          if (requireVision) throw new Error("xKiro currently lists no free vision-capable chat model. Your prompt is safe; remove the image, choose another provider, or try again later.");
          break;
        }
        usedModel = String(selected.id);
        attemptedModels.push(usedModel);
        const extras = { temperature: 0.2 };
        const compatibleEffort = xKiroCompatibleReasoningEffort(selected, reasoningEffort);
        if (compatibleEffort) extras.reasoning_effort = compatibleEffort;
        const startedAt = Date.now();
        try {
          const advertisedOutputCap = Number(selected && selected.max_output_tokens || 0);
          const xkiroMaxOutputTokens = advertisedOutputCap > 0
            ? Math.max(32, Math.min(maxOutputTokens, advertisedOutputCap))
            : maxOutputTokens;
          const out = await openAICompatibleStream(
            provider, XKIRO_CHAT_URL, apiKey, usedModel, systemPrompt, messages,
            xkiroMaxOutputTokens, extras, undefined,
            { hardTimeoutMs: Math.max(30000, Math.min(240000, generationDeadline - Date.now() - 5000)), firstChunkTimeoutMs: 45000, idleTimeoutMs: 75000 }
          );
          text = out.text; data = out.data;
          await recordXKiroModelHealth(usedModel, true, Date.now() - startedAt, "");
          lastError = null;
          break;
        } catch (err) {
          lastError = err;
          await recordXKiroModelHealth(usedModel, false, Date.now() - startedAt, err && (err.code || err.status || "unknown"));
          health = await loadXKiroModelHealth();
          if (err && err.status === 429) {
            const exhausted = await xKiroQuotaErrorIfExhausted(apiKey);
            if (exhausted) throw exhausted;
          }
          if (isFallbackWorthy(err) || (err && (err.status === 403 || err.status === 404))) {
            if (!fallbackFrom) fallbackFrom = usedModel;
            excluded.add(usedModel);
            if (err && (err.status === 403 || err.status === 404)) xKiroFreeModelCache = { expiresAt: 0, models: [] };
            if (attempt < maxAttempts - 1 && generationDeadline - Date.now() >= 30000) {
              await delay(err && err.status === 429 ? 1800 : 500);
              continue;
            }
          }
          throw err;
        }
      }
      if (!text) throw lastError || new Error("xKiro did not return a usable response from the available free models.");
      // Expose selection/fallback details to the page UI without exposing secrets.
      data = Object.assign({}, data || {}, {
        __lovasiri_xkiro: {
          attemptedModels,
          fallbackUsed: attemptedModels.length > 1 || (!!fallbackFrom && fallbackFrom !== usedModel),
          fallbackFrom: fallbackFrom || "",
          selectedModel: usedModel
        }
      });
    } else if (provider === "atria") {
      usedModel = "Atria-Dawn-Preview";
      const { data: responseData } = await fetchJson("https://api.atria-asi.ai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: usedModel,
          messages: standardMessages(systemPrompt, messages),
          max_completion_tokens: maxOutputTokens
        })
      }, provider, DEFAULT_TIMEOUT_MS);
      data = responseData; text = extractOpenAIText(data);
      if (!text) throw new Error(atriaEmptyResponseMessage(data, false));
    } else if (provider === "google") {
      usedModel = requestedModel || "gemini-2.5-flash";
      const contents = [];
      for (const m of messages) {
        contents.push({
          role: m && m.role === "assistant" ? "model" : "user",
          parts: await googleMessageParts(m && m.content)
        });
      }
      const { data: responseData } = await fetchJson(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(usedModel)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: { maxOutputTokens }
        })
      }, provider, DEFAULT_TIMEOUT_MS);
      data = responseData; text = extractGoogleText(data);
      if (!text) throw new Error("Google AI Studio returned an empty AI response.");
    } else if (provider === "anthropic") {
      const workspaceId = String(msg.workspaceId || "").trim();
      const models = await getAnthropicModels(apiKey, workspaceId, false);
      const selected = pickAnthropicModel(models, requestedModel);
      if (!selected) throw new Error("Anthropic returned no usable Claude model for this key/workspace.");
      usedModel = String(selected.id);
      const requestedWasUnavailable = !!(requestedModel && !/^auto(?:\b|[-_ ])/i.test(requestedModel) && requestedModel !== usedModel);
      const anthropicMessages = [];
      for (const m of messages.filter(m => m && m.role !== "system")) {
        anthropicMessages.push({
          role: m.role === "assistant" ? "assistant" : "user",
          content: await anthropicMessageParts(m.content)
        });
      }
      let response;
      try {
        response = await fetchJson("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: anthropicHeaders(apiKey, workspaceId, { "Content-Type": "application/json" }),
          body: JSON.stringify({
            model: usedModel,
            system: systemPrompt,
            messages: anthropicMessages,
            max_tokens: Math.min(maxOutputTokens, Number(selected.max_tokens || maxOutputTokens) || maxOutputTokens)
          })
        }, provider, DEFAULT_TIMEOUT_MS);
      } catch (err) {
        throw friendlyAnthropicError(err);
      }
      data = Object.assign({}, response.data || {}, {
        __lovasiri_anthropic: {
          selectedModel: usedModel,
          requestedModel: requestedModel || "auto",
          fallbackUsed: requestedWasUnavailable
        }
      });
      text = extractAnthropicText(data);
      if (!text) throw new Error("Anthropic returned an empty AI response.");
    } else {
      if (messagesContainImages(messages) && !["openai", "custom", "openrouter", "mistral", "xai", "groq"].includes(provider)) {
        throw new Error(`${providerName(provider)} image input is not enabled in this extension yet. Use xKiro, Gemini, or OpenAI for screenshot/image prompts.`);
      }
      const presets = {
        deepseek: { url: "https://api.deepseek.com/chat/completions", model: "deepseek-flash", extras: { temperature: 0.1 } },
        groq: { url: "https://api.groq.com/openai/v1/chat/completions", model: "openai/gpt-oss-120b", extras: { temperature: 0.2 } },
        openrouter: { url: "https://openrouter.ai/api/v1/chat/completions", model: "openrouter/auto", extras: { temperature: 0.2 }, headers: { "HTTP-Referer": "https://lovable.dev", "X-Title": "Lovable AI Assistant" } },
        anyapi: { url: "https://api.anyapi.ai/v1/chat/completions", model: "nvidia/nemotron-3-ultra-550b-a55b:free", extras: {} },
        openai: { url: "https://api.openai.com/v1/chat/completions", model: "gpt-5.6-luna", extras: {} },
        mistral: { url: "https://api.mistral.ai/v1/chat/completions", model: "mistral-small-latest", extras: { temperature: 0.2 } },
        xai: { url: "https://api.x.ai/v1/chat/completions", model: "latest", extras: { temperature: 0.2 } },
        together: { url: "https://api.together.xyz/v1/chat/completions", model: "meta-llama/Llama-3.3-70B-Instruct-Turbo", extras: { temperature: 0.2 } }
      };
      let preset = presets[provider];
      if (provider === "custom") {
        const url = customEndpoint(apiBase);
        if (!url) throw new Error("Custom API Base URL is required.");
        if (!requestedModel) throw new Error("Custom model ID is required.");
        preset = { url, model: requestedModel, extras: { temperature: 0.2 } };
      }
      if (!preset) throw new Error("Unsupported BYOK provider.");
      usedModel = requestedModel || preset.model;

      if (provider === "openai" && (/^o\d/i.test(usedModel) || /^gpt-[56]/i.test(usedModel))) {
        // Long reasoning requests can spend >30s before emitting the first SSE
        // byte. MV3 service-worker fetches are not a safe place to hold such a
        // connection open. Use the Responses API background mode instead: launch
        // quickly, then poll with short requests until the response completes.
        const out = await openAIResponsesBackground(
          apiKey, usedModel, systemPrompt, messages, maxOutputTokens, reasoningEffort,
          { createTimeoutMs: 20000, pollTimeoutMs: 18000, pollEveryMs: 2500, hardTimeoutMs: 270000 }
        );
        text = out.text; data = out.data;
      } else {
        const extras = Object.assign({}, preset.extras || {});
        const out = await openAICompatible(provider, preset.url, apiKey, usedModel, systemPrompt, messages, maxOutputTokens, extras, preset.headers);
        text = out.text; data = out.data;
      }
    }

    const xkiroMeta = data && data.__lovasiri_xkiro || null;
    const anthropicMeta = data && data.__lovasiri_anthropic || null;
    return {
      ok: true, text, provider, model: usedModel, usage: normalizeUsage(data),
      attemptedModels: xkiroMeta && Array.isArray(xkiroMeta.attemptedModels) ? xkiroMeta.attemptedModels : undefined,
      fallbackUsed: !!((xkiroMeta && xkiroMeta.fallbackUsed) || (anthropicMeta && anthropicMeta.fallbackUsed)),
      fallbackFrom: xkiroMeta && xkiroMeta.fallbackFrom || (anthropicMeta && anthropicMeta.fallbackUsed ? String(anthropicMeta.requestedModel || "") : "")
    };
  }

  const xKiroInFlightRequests = new Map();

  function xKiroInFlightKey(msg) {
    const material = JSON.stringify({
      apiKey: String(msg && msg.apiKey || ""),
      model: String(msg && msg.model || ""),
      systemPrompt: String(msg && msg.systemPrompt || ""),
      messages: Array.isArray(msg && msg.messages) ? msg.messages : [],
      maxOutputTokens: Number(msg && msg.maxOutputTokens || 0),
      reasoningEffort: String(msg && msg.reasoningEffort || ""),
      forceJson: !!(msg && msg.forceJson)
    });
    let h = 2166136261;
    for (let i = 0; i < material.length; i++) {
      h ^= material.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16);
  }

  async function handlePublicByok(msg) {
    const provider = String(msg && msg.provider || "xkiro").toLowerCase();
    if (provider !== "xkiro") return handlePublicByokInternal(msg);

    const key = xKiroInFlightKey(msg);
    const existing = xKiroInFlightRequests.get(key);
    if (existing) return existing;

    const task = handlePublicByokInternal(msg);
    xKiroInFlightRequests.set(key, task);
    try {
      return await task;
    } finally {
      if (xKiroInFlightRequests.get(key) === task) xKiroInFlightRequests.delete(key);
    }
  }

  async function handlePublicByokTest(msg) {
    const provider = String(msg.provider || "xkiro").toLowerCase();
    const apiKey = String(msg.apiKey || "").trim();
    if (!apiKey) throw new Error("API key is required.");

    // xKiro /v1/models is public, so use it to discover the live free tier and
    // then make one tiny chat completion to actually validate the user's key.
    if (provider === "xkiro") {
      const freeModels = await getXKiroFreeModels(true);
      const level = xKiroLevelFromReasoning(msg.reasoningEffort);
      const requested = String(msg.model || "").trim();
      const health = await loadXKiroModelHealth();
      const selected = isXKiroAutoModel(requested)
        ? pickXKiroFreeModel(freeModels, level, new Set(), false, health)
        : (freeModels.find(m => String(m && m.id || "") === requested) || null);
      if (!selected) {
        if (!isXKiroAutoModel(requested)) throw new Error(`xKiro model ${requested} is not currently listed as a free chat model. Refresh the list and choose another model.`);
        throw new Error("xKiro currently lists no usable free chat model.");
      }
      const extras = { temperature: 0 };
      const compatibleEffort = xKiroCompatibleReasoningEffort(selected, msg.reasoningEffort);
      if (compatibleEffort) extras.reasoning_effort = compatibleEffort;
      const out = await openAICompatible(
        provider,
        XKIRO_CHAT_URL,
        apiKey,
        selected.id,
        "Connection test. Reply with pong only.",
        [{ role: "user", content: "Reply with pong only." }],
        16,
        extras
      );
      if (!out.text) throw new Error("xKiro connected but returned an empty test response.");
      const accountUsage = await getXKiroUsage(apiKey).catch(() => null);
      return {
        ok: true,
        provider,
        model: selected.id,
        freeModelCount: freeModels.length,
        usageStatus: accountUsage,
        message: `Connected with free model ${selected.id}. ${freeModels.length} free chat model${freeModels.length === 1 ? "" : "s"} currently listed.`
      };
    }

    // Atria does not document a /models smoke test; validate with a tiny chat request.
    // Retry the tiny test once on a transient gateway failure or a successful-but-empty
    // response. Generation requests themselves are not automatically duplicated.
    if (provider === "atria") {
      let lastError = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const { data } = await fetchJson("https://api.atria-asi.ai/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
            body: JSON.stringify({
              model: "Atria-Dawn-Preview",
              messages: [{ role: "user", content: "hi" }]
            })
          }, provider, 30000);
          if (extractOpenAIText(data)) {
            return { ok: true, provider, message: attempt ? "Connected to Atria after one retry." : "Connected to Atria." };
          }
          lastError = new Error(atriaEmptyResponseMessage(data, true));
        } catch (err) {
          lastError = err;
          if (!(attempt === 0 && err && isTransientGatewayStatus(err.status))) throw err;
        }
        if (attempt === 0) await delay(1200);
      }
      throw lastError || new Error("Atria connection test did not return usable text. Please retry.");
    }

    const testModel = String(msg.model || "").trim();
    const result = await handlePublicByok(Object.assign({}, msg, {
      messages: [{ role: "user", content: "Reply with pong only." }],
      systemPrompt: "Connection test. Reply with pong only.",
      // Reasoning models can spend a tiny budget entirely on hidden reasoning.
      // Give the smoke test enough room and disable reasoning for current GPT-5/6.
      maxOutputTokens: provider === "openai" ? 64 : 16,
      reasoningEffort: provider === "openai" && /^gpt-[56]/i.test(testModel) ? "none" : msg.reasoningEffort
    }));
    return { ok: true, provider, model: result.model, message: `Connected to ${providerName(provider)}.` };
  }

  async function handleAnthropicListModels(msg) {
    const apiKey = String(msg && msg.apiKey || "").trim();
    const workspaceId = String(msg && msg.workspaceId || "").trim();
    if (!apiKey) throw new Error("Anthropic API key is required.");
    const models = await getAnthropicModels(apiKey, workspaceId, !!(msg && msg.forceRefresh));
    return {
      ok: true,
      provider: "anthropic",
      models,
      selectedModel: String((pickAnthropicModel(models, msg && msg.model) || {}).id || "")
    };
  }

  function validateSourceSyntaxWithTypeScript(path, source) {
    const filePath = String(path || "generated.tsx");
    const text = String(source || "");
    let parser = globalThis.ts;
    if (!parser) {
      try { if (typeof ts !== "undefined" && ts && typeof ts.createSourceFile === "function") parser = ts; } catch (_) {}
    }
    if (!parser) {
      try { if (globalThis.ts && typeof globalThis.ts.createSourceFile === "function") parser = globalThis.ts; } catch (_) {}
    }
    if (!parser) return { ok: true, validatorUnavailable: true };

    const lower = filePath.toLowerCase();
    let scriptKind = parser.ScriptKind.TSX;
    if (lower.endsWith(".ts")) scriptKind = parser.ScriptKind.TS;
    else if (lower.endsWith(".jsx")) scriptKind = parser.ScriptKind.JSX;
    else if (lower.endsWith(".js") || lower.endsWith(".mjs") || lower.endsWith(".cjs")) scriptKind = parser.ScriptKind.JS;

    try {
      let diagnostics = [];
      let sourceFile = null;
      if (typeof parser.transpileModule === "function") {
        const jsx = scriptKind === parser.ScriptKind.TSX || scriptKind === parser.ScriptKind.JSX;
        const result = parser.transpileModule(text, {
          fileName: filePath,
          reportDiagnostics: true,
          compilerOptions: {
            target: parser.ScriptTarget.ES2020,
            module: parser.ModuleKind.ESNext,
            jsx: jsx ? parser.JsxEmit.ReactJSX : parser.JsxEmit.None
          }
        });
        diagnostics = Array.isArray(result && result.diagnostics) ? result.diagnostics : Array.from(result && result.diagnostics || []);
      } else {
        sourceFile = parser.createSourceFile(filePath, text, parser.ScriptTarget.Latest, true, scriptKind);
        diagnostics = Array.isArray(sourceFile.parseDiagnostics) ? sourceFile.parseDiagnostics : Array.from(sourceFile.parseDiagnostics || []);
      }
      if (!diagnostics.length) return { ok: true };
      const diagnostic = diagnostics[0];
      const message = parser.flattenDiagnosticMessageText(diagnostic.messageText, " ");
      let line = null, column = null;
      try {
        const sf = sourceFile || parser.createSourceFile(filePath, text, parser.ScriptTarget.Latest, true, scriptKind);
        if (typeof diagnostic.start === "number") {
          const pos = sf.getLineAndCharacterOfPosition(diagnostic.start);
          line = pos.line + 1; column = pos.character + 1;
        }
      } catch (_) {}
      return { ok: false, error: message || "Generated source contains a syntax error.", code: diagnostic.code || null, line, column };
    } catch (_) {
      return { ok: true, validatorUnavailable: true };
    }
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg) return false;

    if (msg.action === "bundlee_git_lovable_validate_source") {
      sendResponse(validateSourceSyntaxWithTypeScript(msg.path, msg.source));
      return false;
    }

    if (msg.action === "bundlee_git_lovable_validate_image_urls") {
      validateRemoteImageUrls(msg.urls).then(sendResponse).catch(err => sendResponse({ ok: false, error: (err && err.message) || String(err) }));
      return true;
    }

    if (msg.action !== "bundlee_git_lovable_public_byok_chat" && msg.action !== "bundlee_git_lovable_public_byok_test" && msg.action !== "bundlee_git_lovable_xkiro_list_free_models" && msg.action !== "bundlee_git_lovable_xkiro_usage" && msg.action !== "bundlee_git_lovable_anthropic_list_models") return false;
    const task = msg.action === "bundlee_git_lovable_public_byok_test"
      ? handlePublicByokTest(msg)
      : (msg.action === "bundlee_git_lovable_xkiro_list_free_models"
        ? handleXKiroListFreeModels(msg)
        : (msg.action === "bundlee_git_lovable_xkiro_usage"
          ? getXKiroUsage(msg.apiKey)
          : (msg.action === "bundlee_git_lovable_anthropic_list_models" ? handleAnthropicListModels(msg) : handlePublicByok(msg))));
    task.then(sendResponse).catch(err => sendResponse({ ok: false, error: (err && err.message) || String(err) }));
    return true;
  });
})();
