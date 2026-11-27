/**
 * LOVABLE AI — GitHub Mode Engine (gitMode.js)
 * Enables zero-credit Lovable development by preparing code diffs and committing
 * directly to the connected GitHub repository for auto-sync.
 * 
 * Features:
 * - UltraX Backend Protocol (x-extension-id, x-extension-name, x-extension-version)
 * - Strict Consistent Device ID Binding
 * - Automatic 10-Minute Trial Key Provisioning & Background Renewal
 * - Self-Healing: Auto-regenerates credentials on "Key expirada" or "Key vinculada a outro dispositivo"
 */
(function () {
  "use strict";

  const LOVASIRI_BUILD_VERSION = "32.1.8";

  if (window.self !== window.top) {
    // Only run Git Mode UI and interception in top Lovable window, never inside preview sandboxes
    return;
  }

  if (window.__127hubGitModeInstalled) return;
  window.__127hubGitModeInstalled = true;

  console.log("%c[LOVABLE AI] Git Mode engine active (BYOK + Direct GitHub Engine)", "color:#00f2fe;font-weight:bold;");

  // Public release profiles: intentionally simple.
  const RELEASE_LEVEL_PROFILES = {
    basic:  { label: "Basic",  maxPromptChars: 16000, maxOutputTokens: 5000,  maxContextFiles: 7,  maxContextChars: 32000 },
    medium: { label: "Medium", maxPromptChars: 36000, maxOutputTokens: 8000,  maxContextFiles: 12, maxContextChars: 70000 },
    super:  { label: "Super",  maxPromptChars: 80000, maxOutputTokens: 14000, maxContextFiles: 18, maxContextChars: 130000 }
  };

  function releaseLevelProfile(level) {
    const normalized = String(level || "basic").toLowerCase();
    return RELEASE_LEVEL_PROFILES[normalized] || RELEASE_LEVEL_PROFILES.basic;
  }

  function releaseModelFor(provider, level, customModel, xkiroModel, anthropicModel) {
    provider = String(provider || "xkiro").toLowerCase();
    level = String(level || "basic").toLowerCase();
    if (provider === "xkiro") {
      const chosen = String(xkiroModel || "").trim();
      return chosen && chosen.toLowerCase() !== "auto" ? chosen : "Auto free model";
    }
    if (provider === "atria") return "Atria-Dawn-Preview";
    if (provider === "google") return level === "super" ? "gemini-2.5-pro" : "gemini-2.5-flash";
    if (provider === "deepseek") return level === "super" ? "deepseek-v4-pro" : "deepseek-flash";
    if (provider === "groq") return "openai/gpt-oss-120b";
    if (provider === "openrouter") return "openrouter/auto";
    if (provider === "anyapi") return "nvidia/nemotron-3-ultra-550b-a55b:free";
    if (provider === "openai") {
      // Current OpenAI coding defaults: Luna for cost-sensitive work, Terra for
      // stronger medium/super jobs. Both support text+image input and streaming.
      if (level === "super") return "gpt-5.6-terra";
      return "gpt-5.6-luna";
    }
    if (provider === "anthropic") {
      const chosen = String(anthropicModel || "").trim();
      return chosen && chosen.toLowerCase() !== "auto" ? chosen : "auto";
    }
    if (provider === "mistral") return level === "super" ? "mistral-large-latest" : (level === "medium" ? "codestral-latest" : "mistral-small-latest");
    if (provider === "xai") return "latest";
    if (provider === "together") return "meta-llama/Llama-3.3-70B-Instruct-Turbo";
    return String(customModel || "").trim();
  }

  function releaseReasoningFor(provider, level) {
    provider = String(provider || "").toLowerCase();
    level = String(level || "basic").toLowerCase();
    if (provider !== "xkiro" && provider !== "openai") return undefined;
    // OpenAI: medium is the balanced quality/latency target for full builds.
    // High reasoning was causing long pre-output waits on Terra and unnecessary
    // token burn. Small edits use none/low; full Super builds use medium.
    if (provider === "openai") {
      if (level === "super") return "medium";
      if (level === "medium") return "low";
      return "none";
    }
    if (level === "super") return "high";
    if (level === "medium") return "medium";
    return "low";
  }

  function releaseProviderLabel(provider) {
    const labels = {
      xkiro: "xKiro",
      atria: "Atria Dawn Preview",
      google: "Google AI Studio",
      deepseek: "DeepSeek",
      groq: "Groq",
      openrouter: "OpenRouter",
      anyapi: "AnyAPI — Nemotron 3 Ultra (Free)",
      openai: "OpenAI",
      anthropic: "Anthropic",
      mistral: "Mistral AI",
      xai: "xAI",
      together: "Together AI",
      custom: "Custom / 3rd-Party"
    };
    return labels[String(provider || "").toLowerCase()] || "Custom BYOK";
  }

  function releaseModelDisplay(provider, model) {
    const p = String(provider || "").toLowerCase();
    const value = String(model || "").trim();
    if (p === "xkiro") return !value || /^auto(?: free model)?/i.test(value) ? "Auto — best available free model" : value;
    if (p === "anthropic") return !value || /^auto(?:\b|[-_ ])/i.test(value) ? "Auto — current Claude model" : value;
    return value;
  }


  function isReadOnlyQuestionPrompt(prompt) {
    const text = String(prompt || "").trim();
    if (!text) return false;
    const q = text.toLowerCase();
    const questionLead = /^(?:where|what|why|how|which|who|when|is|are|was|were|does|do|did|tell me|explain|show me where)\b/.test(q);
    const explicitRequest = /^(?:please\s+)?(?:add|create|build|implement|develop|make|generate|fix|repair|change|update|remove|delete|replace|convert|move|set|enable|disable|refactor|redesign|edit)\b/.test(q) ||
      /\b(?:please|can you|could you|i want you to|i need you to)\s+(?:add|create|build|implement|develop|make|generate|fix|repair|change|update|remove|delete|replace|convert|move|set|enable|disable|refactor|redesign|edit)\b/.test(q);
    if (explicitRequest) return false;
    if (questionLead) return true;
    if (/\?\s*$/.test(text) && !/\b(?:add|create|build|implement|fix|repair|change|update|remove|delete|replace|convert|edit)\b/.test(q)) return true;
    return false;
  }

  function isBroadAppCreationPrompt(prompt) {
    const q = String(prompt || "").toLowerCase();
    // Tiny follow-up edits often contain words such as "create sale" and "dashboard".
    // They are not requests to create an entire dashboard/application.
    if (q.length < 420 && /\b(remove|delete|hide|rename|change|edit|fix|move|convert)\b/.test(q) &&
        !/\b(rebuild|redesign|build|develop|implement|generate)\b[\s\S]{0,50}\b(crm|web\s*app|application|website|dashboard|admin\s*panel|portal|platform|saas|store|shop|marketplace)\b/.test(q)) {
      return false;
    }
    const appNoun = /\b(crm|web\s*app|application|website|dashboard|admin\s*panel|portal|platform|management\s*system|saas|store|shop|marketplace)\b/.test(q);
    const explicitBuild = /\b(?:build|develop|implement|generate|rebuild|design)\b[\s\S]{0,55}\b(crm|web\s*app|application|website|dashboard|admin\s*panel|portal|platform|management\s*system|saas|store|shop|marketplace)\b/.test(q) ||
      /\bcreate\b[\s\S]{0,35}\b(crm|web\s*app|application|website|dashboard|admin\s*panel|portal|platform|management\s*system|saas|store|shop|marketplace)\b/.test(q) ||
      /\bmake\s+(?:a|an|the|new|complete|full)\s+(?:crm|web\s*app|application|website|dashboard|admin\s*panel|portal|platform|management\s*system|saas|store|shop|marketplace)\b/.test(q);
    const completeness = /\b(complete|full|end[- ]?to[- ]?end|all\s+(?:relevant|necessary|needed)|everything|all\s+pages|all\s+features)\b/.test(q);
    return explicitBuild || (appNoun && completeness);
  }

  function inferEffectiveReleaseLevel(prompt, configuredLevel) {
    const order = { basic: 0, medium: 1, super: 2 };
    const selected = String(configuredLevel || "auto").toLowerCase();
    const text = String(prompt || "");
    const lower = text.toLowerCase();
    if (isReadOnlyQuestionPrompt(text)) return selected === "super" ? "super" : "basic";
    const explicitCompilerRepair = /(?:\[parse_error\]|transform failed with|syntaxerror|unexpected token|failed to resolve import|cannot find module)/i.test(text) &&
      /\b(error|fix|repair|resolve)\b/i.test(text);
    let inferred = explicitCompilerRepair ? "medium" : "basic";
    const featureWords = (lower.match(/\b(add|build|create|implement|integrate|fix|redesign|responsive|auth|dashboard|admin|profile|checkout|payment|database|api|route|page|component|feature|products?|migration|refactor)\b/g) || []).length;
    const conjunctions = (lower.match(/\b(and|also|plus|then|with|while|across|every|each|all)\b/g) || []).length;
    if (!explicitCompilerRepair && (text.length > 1400 || featureWords >= 4 || conjunctions >= 5)) inferred = "medium";
    if (!explicitCompilerRepair && (text.length > 5000 || featureWords >= 9 || conjunctions >= 11 || /\b(entire|whole|complete|full|all pages|every page|architecture|refactor)\b/.test(lower) || isBroadAppCreationPrompt(text))) inferred = "super";
    if (selected === "auto") return inferred;
    return order[selected] >= order[inferred] ? selected : inferred;
  }

  const CHANGE_SCOPE_LABELS = {
    auto: "Auto — understand intent",
    content: "Content only",
    style: "Style/UI only",
    image: "Images only",
    data: "Data only",
    bugfix: "Bug fix only",
    feature: "Feature change",
    architecture: "Architecture / refactor",
    full: "Full redesign allowed"
  };

  function inferChangeScope(prompt, configuredScope) {
    const configured = String(configuredScope || "auto").toLowerCase();
    if (configured !== "auto") return configured;
    const q = String(prompt || "").toLowerCase();

    // A request to create/build an application is never a "data-only" edit merely
    // because it mentions products, clients, transactions, etc. This guard prevents
    // broad app requests from being routed into tiny utility/data files.
    if (isBroadAppCreationPrompt(q)) return "feature";

    // Classify narrow edits first so tiny requests do not accidentally enter the
    // expensive "feature" pipeline. These categories are intentionally conservative.
    if (/\b(image|images|photo|photos|picture|thumbnail|hero image|broken image)\b/.test(q) &&
        !/\b(add|create|build|page|route|feature|redesign|section)\b/.test(q)) return "image";

    // Functional UI requests are FEATURE work even when they also mention words
    // such as price/status/text. "Make status/orders/pricing editable" must never
    // be constrained by the CONTENT ONLY system prompt.
    const functionalEdit = /\b(editable|edit option|edit action|edit button|working edit|workable|functional|clickable|modal|dialog|submit|save changes?|form fields?|workflow)\b/.test(q) ||
      (/\b(add|show|create|make|give)\b[\s\S]{0,45}\b(button|action|option|modal|dialog|form)\b/.test(q) && !/\bbutton text\b/.test(q));
    if (functionalEdit) return "feature";

    if (/\b(text|copy|wording|description|title|heading|price|pricing|currency|rupees?|inr|usd|dollars?|label|placeholder text|button text)\b/.test(q) &&
        !/\b(add|create|build|route|feature|redesign|new page|new section)\b/.test(q)) return "content";

    if (/\b(color|spacing|font|style|css|responsive|mobile|design|sticky|fixed|position|align|alignment|width|height|padding|margin|gap|sidebar position|navbar position)\b/.test(q) &&
        !/\b(database|api|auth|new route|new page|feature)\b/.test(q)) return "style";

    if (/\b(fix|bug|broken|error|not found|doesn['’]?t work|not working|repair|regression)\b/.test(q)) return "bugfix";
    if (/\b(refactor|architecture|single source|shared data|central data|restructure|re-architect)\b/.test(q)) return "architecture";
    if (/\b(data|products?|items?|records?|catalog|clients?|transactions?|invoices?)\b/.test(q) &&
        /\b(add|update|change|remove|edit|delete)\b/.test(q) &&
        !/\b(page|screen|route|form|workflow)\b/.test(q)) return "data";
    if (/\b(redesign|rebuild entire|start over|complete redesign|whole website|entire website|full redesign)\b/.test(q)) return "full";
    return "feature";
  }

  function changeScopeInstruction(scope) {
    const s = String(scope || "feature").toLowerCase();
    if (s === "content") return "CHANGE SCOPE = CONTENT ONLY. Do not alter layout, routes, styling, images, component structure, or unrelated data. Change only the requested text/content values.";
    if (s === "style") return "CHANGE SCOPE = STYLE/UI ONLY. Preserve data, routes, business logic, images and behavior. Modify only the minimum markup/classes/styles needed for the requested visual result.";
    if (s === "image") return "CHANGE SCOPE = IMAGES ONLY. Preserve layout, routes, text, pricing, product data and behavior. Modify only requested image references/assets plus minimal alt text when necessary.";
    if (s === "data") return "CHANGE SCOPE = DATA ONLY. Preserve existing layout/component architecture. Update the shared data source and every dependent mapping needed to keep existing features consistent.";
    if (s === "bugfix") return "CHANGE SCOPE = BUG FIX. Make the smallest root-cause repair. Do not redesign or rewrite unrelated working code.";
    if (s === "architecture") return "CHANGE SCOPE = ARCHITECTURE/REFACTOR. Structural changes are allowed only when they reduce duplication or enforce the requested invariant; preserve external behavior and UI unless explicitly requested.";
    if (s === "full") return "CHANGE SCOPE = FULL REDESIGN ALLOWED. You may restructure the requested area, but preserve explicitly requested functionality, valid data, and working integrations.";
    return "CHANGE SCOPE = FEATURE. Implement the requested behavior with minimal targeted edits and preserve unrelated working functionality.";
  }

  function isNavigationFeaturePrompt(prompt) {
    return /\b(sidebar|side\s*menu(?:\s*bar)?|navigation|nav\s*bar|navbar|menu\s*bar|navigation\s*menu)\b/i.test(String(prompt || ""));
  }

  function buildFeatureDefinitionOfDone(prompt, repoFiles) {
    const q = String(prompt || "").toLowerCase();
    const rules = [];
    if (/\b(dark|light)\s*(?:and|&|\/)?\s*(?:light|dark)?\s*(?:mode|theme)|theme\s*(?:toggle|switch)|dark\s*mode|light\s*mode\b/.test(q)) {
      rules.push("Theme mode: add a VISIBLE user control, wire it to real theme state/DOM styling, apply the theme to the actual app, and persist the preference when the project already uses local storage or a theme provider.");
    }
    if (isNavigationFeaturePrompt(q)) {
      rules.push("Navigation/sidebar: render a visible responsive navigation UI, preserve the current page and <Outlet />/router shell, and use ONLY routes that actually exist in this repository unless the same change creates the missing route.");
      rules.push("Navigation/sidebar: for a simple sidebar request, prefer existing/plain JSX + CSS/Tailwind. Do not introduce a new root-level SidebarProvider/useIsMobile framework or duplicate a sidebar in both root and page unless the user explicitly requests a global provider architecture.");
    }
    if (/\b(edit|editable|edit option|edit button|update)\b/.test(q) && !/\b(remove|delete)\b/.test(q)) {
      rules.push("Edit workflow: expose a visible edit action, preload existing values, allow the requested fields to change, provide Save/Cancel behavior, and update the existing app state/data instead of only opening a cosmetic dialog.");
    }
    if (/\bsearch\b/.test(q)) {
      rules.push("Search: the input must actually filter/search the relevant data, handle no-results, and preserve existing records and navigation.");
    }
    if (/\bcreate\s+sale|add\s+sale|sale\s+(?:dialog|form|workflow)\b/.test(q)) {
      rules.push("Create Sale: opening a dialog is not enough; capture the required values, validate them, add/update the sale in the app state/data, update dependent totals/lists where applicable, then close/reset the form.");
    }
    if (/\bproducts?\b/.test(q)) {
      rules.push("Products: keep shared data, stable id/slug, listing/card behavior, detail lookup/route and image references consistent with the project's existing product architecture.");
    }
    return rules.length ? `DEFINITION OF DONE FOR THIS REQUEST:\n- ${rules.join("\n- ")}` : "";
  }

  function normalizeContractText(value) {
    return String(value || "").split(/\r?\n/).map(v => v.trim()).filter(Boolean).slice(0, 40).join("\n").slice(0, 8000);
  }

  function projectRepoKey(config, repository) {
    return String(repository || (config && config.repository) || "").trim().toLowerCase();
  }

  function getProjectContract(config, repository) {
    const key = projectRepoKey(config, repository);
    const all = config && config.project_contracts_by_repo && typeof config.project_contracts_by_repo === "object" ? config.project_contracts_by_repo : {};
    return normalizeContractText(key && all[key] || "");
  }

  function mergeContractRules(existing, rules) {
    const lines = normalizeContractText(existing).split(/\n/).filter(Boolean);
    const seen = new Set(lines.map(v => v.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()));
    (rules || []).forEach(rule => {
      const clean = String(rule || "").trim();
      const sig = clean.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (clean && sig && !seen.has(sig)) { lines.push(clean); seen.add(sig); }
    });
    return lines.slice(-40).join("\n").slice(0, 8000);
  }

  function saveProjectContractRules(config, repository, rules) {
    const key = projectRepoKey(config, repository);
    if (!key || !(rules || []).length) return;
    const all = Object.assign({}, config && config.project_contracts_by_repo || {});
    all[key] = mergeContractRules(all[key] || "", rules);
    saveGitConfig({ project_contracts_by_repo: all });
    if (config && typeof config === "object") config.project_contracts_by_repo = all;
  }

  function extractPersistentRulesFromPrompt(prompt) {
    const q = String(prompt || "").toLowerCase();
    const rules = [];
    if (/\b(every|each|all)\s+(?:new\s+)?products?\b[\s\S]{0,80}\b(detail|details|product)\s+pages?\b|\bseparate\s+product\s+page\b[\s\S]{0,60}\b(all|every|each)\b/.test(q)) {
      rules.push("Every product displayed anywhere must be clickable and resolve to a working product detail page.");
      rules.push("New products must be added to the same product data/detail lookup used by existing products; never create listing-only products that resolve to Product Not Found.");
    }
    if (/\b(every|each|all)\s+products?\b[\s\S]{0,60}\b(click|clickable|link|open)\b/.test(q)) {
      rules.push("Every displayed product card must be navigable to its matching product detail route.");
    }
    if (/\b(product images?|images?)\b[\s\S]{0,80}\b(relevant|match|appropriate|correct product)\b/.test(q)) {
      rules.push("Product images must semantically match the product they represent; preserve validated relevant images and never substitute unrelated stock photos.");
    }
    if (/\b(never|do not|don['’]?t)\b[\s\S]{0,70}\b(broken image|broken url|old image|unrelated image)\b/.test(q)) {
      rules.push("Never restore a previously confirmed broken image URL or an unrelated image while repairing another image.");
    }
    if (/\b(single source of truth|shared product data|central product data|one product data)\b/.test(q)) {
      rules.push("Use one shared source of truth for product/list/detail data so later additions automatically remain consistent.");
    }
    if (/\b(preserve|keep)\b[\s\S]{0,60}\b(header|footer|navigation|navbar|branding|design)\b/.test(q)) {
      rules.push("Preserve the project's established navigation, branding and layout unless the user explicitly requests changing them.");
    }
    return rules;
  }

  function inferArchitectureRules(repoFiles, contextFiles, prompt) {
    const files = Array.isArray(repoFiles) ? repoFiles : [];
    const source = (contextFiles || []).map(f => `${f.path}\n${f.content || ""}`).join("\n");
    const q = String(prompt || "").toLowerCase();
    const rules = [];
    const hasProductFiles = files.some(p => /product/i.test(String(p))) || /\bproducts?\b/i.test(source);
    const hasProductDetailArchitecture = files.some(p => /product.*(detail|\[|\$|slug|id)/i.test(String(p))) || /Product Not Found|\/products\/|useParams\s*\(|params\.(?:slug|id)|product.*slug/i.test(source);
    if (hasProductFiles && hasProductDetailArchitecture && /\bproducts?\b/.test(q)) {
      rules.push("This project already has product-detail behavior: every newly displayed product must participate in that same detail-page system and must not resolve to Product Not Found.");
      rules.push("Prefer one shared product dataset for listings and details; adding a product must update the shared source rather than duplicating independent product lists.");
      rules.push("Every product card/link must use the same stable slug/id that the detail-page lookup resolves.");
    }
    return rules;
  }

  function buildProjectContractContext(config, repository, promptRules, architectureRules) {
    const remembered = config && config.project_memory !== false ? getProjectContract(config, repository) : "";
    const combined = mergeContractRules(remembered, [...(promptRules || []), ...(architectureRules || [])]);
    if (!combined) return "";
    return `PROJECT CONTRACT / PERSISTENT INVARIANTS:\n${combined.split(/\n/).map(v => `- ${v.replace(/^[-*]\s*/, "")}`).join("\n")}\nTreat these as acceptance criteria for this project unless the current user explicitly overrides one of them.`;
  }

  function getProjectHistory(config, repository) {
    const key = projectRepoKey(config, repository);
    const all = config && config.project_history_by_repo && typeof config.project_history_by_repo === "object" ? config.project_history_by_repo : {};
    return Array.isArray(all[key]) ? all[key].slice(-5) : [];
  }

  function recordProjectHistory(config, repository, prompt, summary, changes) {
    const key = projectRepoKey(config, repository);
    if (!key) return;
    const all = Object.assign({}, config && config.project_history_by_repo || {});
    const arr = Array.isArray(all[key]) ? all[key].slice(-4) : [];
    arr.push({
      ts: Date.now(),
      prompt: String(prompt || "").replace(/\s+/g, " ").trim().slice(0, 220),
      summary: String(summary || "").replace(/\s+/g, " ").trim().slice(0, 180),
      paths: (changes || []).map(c => String(c && c.path || "")).filter(Boolean).slice(0, 12)
    });
    all[key] = arr;
    saveGitConfig({ project_history_by_repo: all });
    if (config && typeof config === "object") config.project_history_by_repo = all;
  }

  function buildProjectHistoryContext(config, repository) {
    const rows = getProjectHistory(config, repository);
    if (!rows.length) return "";
    return "RECENT SUCCESSFUL PROJECT CHANGES (context only; do not undo them):\n" + rows.map((r, i) => `${i + 1}. ${r.summary || r.prompt}${r.paths && r.paths.length ? ` [${r.paths.join(", ")}]` : ""}`).join("\n");
  }

  function normalizeXKiroAccounts(config) {
    const raw = Array.isArray(config && config.xkiro_accounts) ? config.xkiro_accounts : [];
    const accounts = raw.map((a, index) => ({
      id: String(a && a.id || `xk_${index}_${Date.now()}`),
      label: String(a && a.label || (index === 0 ? "Primary" : index === 1 ? "Secondary" : `Account ${index + 1}`)),
      apiKey: String(a && (a.apiKey || a.api_key) || "").trim(),
      email: String(a && a.email || "").trim(),
      name: String(a && a.name || "").trim()
    })).filter(a => a.apiKey);
    if (!accounts.length && String(config && config.byok_key || "").trim() && String(config && config.byok_provider || "xkiro") === "xkiro") {
      accounts.push({ id: "xk_primary", label: "Primary", apiKey: String(config.byok_key).trim(), email: "", name: "" });
    }
    return accounts;
  }

  function getActiveXKiroAccount(config) {
    const accounts = normalizeXKiroAccounts(config || {});
    if (!accounts.length) return null;
    const wanted = String(config && config.xkiro_active_account_id || "");
    return accounts.find(a => a.id === wanted) || accounts[0];
  }

  function normalizeProviderKeys(config) {
    const out = {};
    const raw = config && config.provider_keys && typeof config.provider_keys === "object" ? config.provider_keys : {};
    Object.keys(raw || {}).forEach(provider => {
      const value = String(raw[provider] || "").trim();
      if (value) out[String(provider).toLowerCase()] = value;
    });
    const legacyProvider = String(config && config.byok_provider || "").toLowerCase();
    const legacyKey = String(config && config.byok_key || "").trim();
    if (legacyProvider && legacyProvider !== "xkiro" && legacyKey && !out[legacyProvider]) out[legacyProvider] = legacyKey;
    return out;
  }

  function resolveProviderApiKey(config, providerOverride) {
    const provider = String(providerOverride || (config && config.byok_provider) || "xkiro").toLowerCase();
    if (provider === "xkiro") {
      const active = getActiveXKiroAccount(config || {});
      if (active && active.apiKey) return active.apiKey;
    }
    const keys = normalizeProviderKeys(config || {});
    if (keys[provider]) return keys[provider];
    return String(config && config.byok_key || "").trim();
  }

  function maskApiKey(key) {
    const value = String(key || "").trim();
    if (!value) return "Not configured";
    const prefix = value.slice(0, Math.min(5, value.length));
    const suffix = value.length > 10 ? value.slice(-4) : "";
    return prefix + "-••••••••" + (suffix ? suffix : "");
  }

  function compactTokenCount(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "∞";
    if (n >= 1e9) return (n / 1e9).toFixed(n % 1e9 ? 1 : 0) + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(n % 1e6 ? 1 : 0) + "M";
    if (n >= 1e3) return Math.round(n / 1e3) + "K";
    return String(Math.round(n));
  }

  // Client-facing single-job guard. Keep the next prompt locked until the full
  // provider -> GitHub -> Lovable preview cycle has actually finished.
  const LOVASIRI_JOB_STATE = { running: false, startedAt: 0, stage: "", stageStartedAt: 0, stageTimeoutMs: 0, timer: null, readyTimer: null };
  // v32.0.1: interrupted jobs are scoped to the Lovable project/repository.
  // The old v31 key is kept only for conservative one-time migration.
  const LOVASIRI_RECOVERY_JOB_KEY = "__lovasiri_recovery_job_v31";
  const LOVASIRI_RECOVERY_JOBS_KEY = "__lovasiri_recovery_jobs_v32";
  let LOVASIRI_ACTIVE_RECOVERY_SCOPE_KEY = "";

  function normalizeRecoveryScopePart(value) {
    return String(value || "").trim().toLowerCase().replace(/[^a-z0-9._@/:-]+/g, "_").slice(0, 240);
  }

  function getRecoveryScope(configOverride) {
    const config = configOverride || getGitConfig() || {};
    const projectId = String(getActiveProjectId() || "").trim();
    const repository = String(config.repository || "").trim();
    const branch = String(config.branch || "main").trim() || "main";
    if (projectId) {
      return { key: "project:" + normalizeRecoveryScopePart(projectId), projectId, repository, branch };
    }
    if (repository) {
      return { key: "repo:" + normalizeRecoveryScopePart(repository) + "#" + normalizeRecoveryScopePart(branch), projectId: "", repository, branch };
    }
    const path = String((window.location && window.location.pathname) || "/").split(/[?#]/)[0];
    return { key: "page:" + normalizeRecoveryScopePart(path || "/"), projectId: "", repository: "", branch };
  }

  function readRecoveryJobsMap() {
    try {
      const parsed = JSON.parse(localStorage.getItem(LOVASIRI_RECOVERY_JOBS_KEY) || "{}");
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (_) { return {}; }
  }

  function writeRecoveryJobsMap(map) {
    const safeMap = map && typeof map === "object" ? map : {};
    try { localStorage.setItem(LOVASIRI_RECOVERY_JOBS_KEY, JSON.stringify(safeMap)); } catch (_) {}
    try {
      window.postMessage({
        source: "LOVABLE_GIT_PAGE_PAYLOAD",
        id: "jobs_save_" + Date.now(),
        type: "storage.set",
        items: { [LOVASIRI_RECOVERY_JOBS_KEY]: safeMap }
      }, "*");
    } catch (_) {}
  }

  function legacyRecoveryMatchesScope(job, scope) {
    if (!job || !scope) return false;
    const jobProject = String(job.projectId || job.project_id || "").trim();
    if (jobProject && scope.projectId) return jobProject === scope.projectId;
    const jobRepo = normalizeRecoveryScopePart(job.repository || "");
    const scopeRepo = normalizeRecoveryScopePart(scope.repository || "");
    if (!jobRepo || !scopeRepo || jobRepo !== scopeRepo) return false;
    const jobBranch = normalizeRecoveryScopePart(job.branch || "main");
    const scopeBranch = normalizeRecoveryScopePart(scope.branch || "main");
    return !jobBranch || !scopeBranch || jobBranch === scopeBranch;
  }

  function migrateLegacyRecoveryJobIfSafe(map, scope) {
    let legacy = null;
    try { legacy = JSON.parse(localStorage.getItem(LOVASIRI_RECOVERY_JOB_KEY) || "null"); } catch (_) {}
    if (!legacy || !legacy.prompt || !legacyRecoveryMatchesScope(legacy, scope)) return map;
    const nextMap = Object.assign({}, map || {});
    if (!nextMap[scope.key]) {
      nextMap[scope.key] = Object.assign({}, legacy, {
        scopeKey: scope.key,
        projectId: scope.projectId || String(legacy.projectId || legacy.project_id || ""),
        repository: scope.repository || String(legacy.repository || ""),
        branch: scope.branch || String(legacy.branch || "main"),
        migratedFromLegacy: true,
        updatedAt: Date.now()
      });
      writeRecoveryJobsMap(nextMap);
    }
    try { localStorage.removeItem(LOVASIRI_RECOVERY_JOB_KEY); } catch (_) {}
    try {
      window.postMessage({ source: "LOVABLE_GIT_PAGE_PAYLOAD", id: "job_legacy_clear_" + Date.now(), type: "storage.remove", keys: [LOVASIRI_RECOVERY_JOB_KEY] }, "*");
    } catch (_) {}
    return nextMap;
  }

  function persistRecoveryJob(patch) {
    try {
      const currentScope = getRecoveryScope();
      const requestedScopeKey = String((patch && patch.scopeKey) || LOVASIRI_ACTIVE_RECOVERY_SCOPE_KEY || currentScope.key);
      let map = readRecoveryJobsMap();
      map = migrateLegacyRecoveryJobIfSafe(map, currentScope);
      const current = map[requestedScopeKey] && typeof map[requestedScopeKey] === "object" ? map[requestedScopeKey] : {};
      const isCurrentScope = requestedScopeKey === currentScope.key;
      const next = Object.assign({}, current, {
        scopeKey: requestedScopeKey,
        projectId: current.projectId || (isCurrentScope ? currentScope.projectId : ""),
        repository: current.repository || (isCurrentScope ? currentScope.repository : ""),
        branch: current.branch || (isCurrentScope ? currentScope.branch : "main")
      }, patch || {}, { updatedAt: Date.now() });
      map[requestedScopeKey] = next;
      writeRecoveryJobsMap(map);
      return next;
    } catch (_) { return null; }
  }

  function clearRecoveryJob(scopeKey) {
    try {
      const currentScope = getRecoveryScope();
      const key = String(scopeKey || LOVASIRI_ACTIVE_RECOVERY_SCOPE_KEY || currentScope.key);
      const map = readRecoveryJobsMap();
      if (map[key]) {
        delete map[key];
        writeRecoveryJobsMap(map);
      }
      // Clear a matching legacy job only when it demonstrably belongs here.
      let legacy = null;
      try { legacy = JSON.parse(localStorage.getItem(LOVASIRI_RECOVERY_JOB_KEY) || "null"); } catch (_) {}
      if (legacy && legacyRecoveryMatchesScope(legacy, currentScope)) {
        try { localStorage.removeItem(LOVASIRI_RECOVERY_JOB_KEY); } catch (_) {}
        try { window.postMessage({ source: "LOVABLE_GIT_PAGE_PAYLOAD", id: "job_clear_old_" + Date.now(), type: "storage.remove", keys: [LOVASIRI_RECOVERY_JOB_KEY] }, "*"); } catch (_) {}
      }
    } catch (_) {}
  }

  function getRecoveryJob() {
    try {
      const scope = getRecoveryScope();
      let map = readRecoveryJobsMap();
      map = migrateLegacyRecoveryJobIfSafe(map, scope);
      const job = map[scope.key];
      if (!job || typeof job !== "object" || !job.prompt) return null;
      // Defense in depth: even a malformed/stale map entry must match the current
      // project ID when both sides have one, otherwise it cannot be retried here.
      const jobProject = String(job.projectId || job.project_id || "").trim();
      if (jobProject && scope.projectId && jobProject !== scope.projectId) return null;
      const jobRepo = normalizeRecoveryScopePart(job.repository || "");
      const scopeRepo = normalizeRecoveryScopePart(scope.repository || "");
      if (!jobProject && jobRepo && scopeRepo && jobRepo !== scopeRepo) return null;
      return job;
    } catch (_) { return null; }
  }

  function getForeignRecoveryJobs() {
    try {
      const scope = getRecoveryScope();
      const map = readRecoveryJobsMap();
      const foreign = Object.keys(map).filter(key => key !== scope.key).map(key => map[key]).filter(job => job && job.prompt);
      let legacy = null;
      try { legacy = JSON.parse(localStorage.getItem(LOVASIRI_RECOVERY_JOB_KEY) || "null"); } catch (_) {}
      if (legacy && legacy.prompt && !legacyRecoveryMatchesScope(legacy, scope)) foreign.push(Object.assign({ legacy: true }, legacy));
      return foreign;
    } catch (_) { return []; }
  }


  function formatJobElapsed(ms) {
    const total = Math.max(0, Math.floor(Number(ms || 0) / 1000));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");
  }

  function getComposerFormForJobUi() {
    try {
      const doc = (window.top && window.top.document) || document;
      return doc.querySelector('form#chat-input, [data-testid*="chat-input" i] form, [data-testid*="chat-input" i]') || null;
    } catch (_) {
      return null;
    }
  }

  function getOrCreateJobStatusPill() {
    const doc = (window.top && window.top.document) || document;
    let pill = doc.getElementById("lovasiri-job-status");
    if (pill) return pill;
    pill = doc.createElement("div");
    pill.id = "lovasiri-job-status";
    pill.style.cssText = `
      position: fixed; z-index: 2147483646; display: none; align-items: center; gap: 8px;
      max-width: 340px; padding: 7px 11px; border-radius: 999px;
      background: rgba(9, 18, 35, 0.96); border: 1px solid rgba(0, 242, 254, 0.45);
      color: #e2e8f0; box-shadow: 0 8px 24px rgba(0,0,0,.35), 0 0 18px rgba(0,242,254,.12);
      font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; font-size: 11.5px; font-weight: 650;
      pointer-events: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    `;
    (doc.body || doc.documentElement).appendChild(pill);
    return pill;
  }

  function positionJobStatusPill(pill) {
    if (!pill) return;
    try {
      const form = getComposerFormForJobUi();
      if (form) {
        const r = form.getBoundingClientRect();
        const left = Math.max(8, Math.min(window.innerWidth - Math.min(340, Math.max(180, r.width)) - 8, r.left + 8));
        pill.style.left = left + "px";
        pill.style.top = Math.max(8, r.top - 38) + "px";
        pill.style.bottom = "auto";
      } else {
        pill.style.left = "16px";
        pill.style.bottom = "86px";
        pill.style.top = "auto";
      }
    } catch (_) {}
  }

  function setComposerBusyState(busy) {
    try {
      const doc = (window.top && window.top.document) || document;
      const form = getComposerFormForJobUi();
      const buttons = form ? form.querySelectorAll('button[type="submit"], button[aria-label*="send" i], button[data-testid*="send" i]') : [];
      buttons.forEach(btn => {
        if (busy) {
          if (!btn.dataset.lovasiriPrevDisabled) btn.dataset.lovasiriPrevDisabled = btn.disabled ? "1" : "0";
          btn.disabled = true;
          btn.setAttribute("aria-disabled", "true");
          btn.style.opacity = "0.55";
          btn.style.cursor = "not-allowed";
        } else {
          const wasDisabled = btn.dataset.lovasiriPrevDisabled === "1";
          if (!wasDisabled) btn.disabled = false;
          btn.removeAttribute("aria-disabled");
          btn.style.opacity = "";
          btn.style.cursor = "";
          delete btn.dataset.lovasiriPrevDisabled;
        }
      });
      if (form) form.setAttribute("data-lovasiri-job-running", busy ? "true" : "false");
    } catch (_) {}
  }

  function renderJobStatusPill() {
    const pill = getOrCreateJobStatusPill();
    if (!LOVASIRI_JOB_STATE.running) return;
    const now = Date.now();
    const elapsed = formatJobElapsed(now - LOVASIRI_JOB_STATE.startedAt);
    let stage = LOVASIRI_JOB_STATE.stage || "Working on your request";
    if (LOVASIRI_JOB_STATE.stageTimeoutMs > 0 && LOVASIRI_JOB_STATE.stageStartedAt > 0) {
      const stageElapsedMs = Math.min(LOVASIRI_JOB_STATE.stageTimeoutMs, Math.max(0, now - LOVASIRI_JOB_STATE.stageStartedAt));
      stage += ` ${formatJobElapsed(stageElapsedMs)}/${formatJobElapsed(LOVASIRI_JOB_STATE.stageTimeoutMs)}`;
    }
    pill.innerHTML = `<span style="width:9px;height:9px;border-radius:50%;background:#22d3ee;box-shadow:0 0 10px #22d3ee;display:inline-block;animation:hubPulseGlow 1.5s infinite;"></span><strong style="color:#67e8f9;">Working ${elapsed}</strong><span style="color:#cbd5e1;overflow:hidden;text-overflow:ellipsis;">· ${escapeHtml(stage)}</span>`;
    pill.style.display = "flex";
    positionJobStatusPill(pill);
    setComposerBusyState(true);
  }

  function startJobStatus(stage) {
    if (LOVASIRI_JOB_STATE.readyTimer) { clearTimeout(LOVASIRI_JOB_STATE.readyTimer); LOVASIRI_JOB_STATE.readyTimer = null; }
    const now = Date.now();
    LOVASIRI_JOB_STATE.running = true;
    LOVASIRI_JOB_STATE.startedAt = now;
    LOVASIRI_JOB_STATE.stageStartedAt = now;
    LOVASIRI_JOB_STATE.stageTimeoutMs = 0;
    LOVASIRI_JOB_STATE.stage = stage || "Preparing request";
    window.__lovasiriJobStartedAt = LOVASIRI_JOB_STATE.startedAt;
    if (LOVASIRI_JOB_STATE.timer) clearInterval(LOVASIRI_JOB_STATE.timer);
    LOVASIRI_JOB_STATE.timer = setInterval(renderJobStatusPill, 1000);
    renderJobStatusPill();
  }

  function updateJobStatus(stage, options) {
    if (!LOVASIRI_JOB_STATE.running) return;
    const nextStage = stage || LOVASIRI_JOB_STATE.stage;
    if (nextStage !== LOVASIRI_JOB_STATE.stage || (options && options.resetStageTimer)) {
      LOVASIRI_JOB_STATE.stageStartedAt = Date.now();
    }
    LOVASIRI_JOB_STATE.stage = nextStage;
    LOVASIRI_JOB_STATE.stageTimeoutMs = Math.max(0, Number(options && options.timeoutMs || 0));
    persistRecoveryJob({ stage: LOVASIRI_JOB_STATE.stage, status: "running" });
    renderJobStatusPill();
  }

  function finishJobStatus(message) {
    if (LOVASIRI_JOB_STATE.timer) { clearInterval(LOVASIRI_JOB_STATE.timer); LOVASIRI_JOB_STATE.timer = null; }
    const pill = getOrCreateJobStatusPill();
    const elapsed = formatJobElapsed(Date.now() - (LOVASIRI_JOB_STATE.startedAt || Date.now()));
    LOVASIRI_JOB_STATE.running = false;
    LOVASIRI_JOB_STATE.stage = "";
    LOVASIRI_JOB_STATE.stageStartedAt = 0;
    LOVASIRI_JOB_STATE.stageTimeoutMs = 0;
    setComposerBusyState(false);
    pill.innerHTML = `<span style="color:#34d399;font-weight:800;">✓</span><strong style="color:#a7f3d0;">${escapeHtml(message || "Ready for your next prompt")}</strong><span style="color:#64748b;">· ${elapsed}</span>`;
    pill.style.display = "flex";
    positionJobStatusPill(pill);
    LOVASIRI_JOB_STATE.readyTimer = setTimeout(() => { try { pill.style.display = "none"; } catch (_) {} }, 4500);
  }

  // Prevent Enter/submit from launching a second prompt while the current job is
  // genuinely still alive. Typing is allowed; sending waits until the job finishes.
  document.addEventListener("keydown", function(e) {
    if (!LOVASIRI_JOB_STATE.running || e.key !== "Enter" || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (!t || !t.closest) return;
    if (!t.closest('form#chat-input, [data-testid*="chat-input" i]')) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const elapsed = formatJobElapsed(Date.now() - LOVASIRI_JOB_STATE.startedAt);
    showGitToast(`Still working (${elapsed}). Your next prompt can be sent when this job finishes.`, "info", 3500);
  }, true);

  document.addEventListener("submit", function(e) {
    if (!LOVASIRI_JOB_STATE.running) return;
    const t = e.target;
    if (!t || !t.matches || !t.matches('form#chat-input, [data-testid*="chat-input" i] form')) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const elapsed = formatJobElapsed(Date.now() - LOVASIRI_JOB_STATE.startedAt);
    showGitToast(`Still working (${elapsed}). Please wait for the current request to finish.`, "info", 3500);
  }, true);



  // Neutral release icon used by the existing friendly UI.
  const LOVABLE_ASSISTANT_LOGO_DATA = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAkElEQVR4nGMUllD/zzCAgAVdQND7CE0tfL/VBoXPRE/LsdnBhEuCXo5gorfl6I5gIqCO5mDUARjZEBe4PUcEQ0w15Q3FDhjwEBh1wKgDRh0w6oBRBxBdF2AD2OoHbABfnTHgITDqgAF3ANGJkBqND2xgwENgcDgAvbtEDwCzkwldgJ6WoziAXo5At4NxoLvnACGLH14rzN5EAAAAAElFTkSuQmCC";

  // Helper: Dual Storage (localStorage + chrome.storage.local)
  // v32.0.2: Git repository/branch are resolved per Lovable project.
  // This prevents a repository remembered for Project A from being reused in Project B.
  let _cachedGitConfig = null;

  function normalizeGitRepository(value) {
    return String(value || "").trim().replace(/^https?:\/\/github\.com\//i, "").replace(/\.git$/i, "").replace(/^\/+|\/+$/g, "").toLowerCase();
  }

  function getRuntimeLovableProjectId() {
    try {
      const match = String(location.pathname || "").match(/\/projects\/([a-zA-Z0-9_-]{8,120})/i);
      if (match && match[1]) return String(match[1]);
    } catch (_) {}
    try {
      const runtimeId = String(window.__lovable_project_id || "").trim();
      if (runtimeId) return runtimeId;
    } catch (_) {}
    try {
      const root = document.documentElement;
      const attrId = root && (root.getAttribute("data-project-id") || root.getAttribute("data-lovable-project-id"));
      if (attrId) return String(attrId).trim();
    } catch (_) {}
    return "";
  }

  function rawGitConfig() {
    try {
      const raw = localStorage.getItem("__127hub_git_config");
      const publicConfig = raw ? JSON.parse(raw) : {};
      return Object.assign({}, publicConfig || {}, _cachedGitConfig || {});
    } catch (_) {
      return Object.assign({}, _cachedGitConfig || {});
    }
  }

  function projectGitMappings(config) {
    return config && config.project_git_mappings && typeof config.project_git_mappings === "object"
      ? config.project_git_mappings
      : {};
  }

  function getProjectGitMapping(config, projectId) {
    const pid = String(projectId || "").trim();
    if (!pid) return null;
    const row = projectGitMappings(config)[pid];
    if (!row || !normalizeGitRepository(row.repository)) return null;
    return {
      projectId: pid,
      repository: String(row.repository || "").trim(),
      branch: String(row.branch || "main").trim() || "main",
      projectName: String(row.projectName || "").trim(),
      source: String(row.source || "saved").trim() || "saved",
      updatedAt: Number(row.updatedAt || 0) || 0
    };
  }

  function getGitConfig() {
    const base = rawGitConfig();
    const projectId = getRuntimeLovableProjectId();
    if (!projectId) return base;

    const mapped = getProjectGitMapping(base, projectId);
    if (mapped) {
      return Object.assign({}, base, {
        repository: mapped.repository,
        branch: mapped.branch,
        project_id: projectId,
        project_git_mapping_active: true,
        project_git_mapping_source: mapped.source
      });
    }

    // Backward-compatible migration path: only trust the old global repo when it was
    // explicitly saved for THIS exact Lovable project. Never borrow another project's repo.
    if (String(base.project_id || "").trim() === projectId && normalizeGitRepository(base.repository)) {
      return Object.assign({}, base, { project_id: projectId, project_git_mapping_legacy: true });
    }

    // Keep global credentials/provider settings, but intentionally blank the Git target.
    // A new project must be detected/mapped before repository reads or writes are allowed.
    return Object.assign({}, base, {
      repository: "",
      branch: "main",
      project_id: projectId,
      project_git_mapping_missing: true
    });
  }

  function saveCurrentProjectGitMapping(repository, branch, meta = {}) {
    const projectId = getRuntimeLovableProjectId();
    const repo = String(repository || "").trim();
    const targetBranch = String(branch || "main").trim() || "main";
    if (!projectId || !normalizeGitRepository(repo)) return null;

    const base = rawGitConfig();
    const all = Object.assign({}, projectGitMappings(base));
    all[projectId] = {
      repository: repo,
      branch: targetBranch,
      projectName: String(meta.projectName || getLovableProjectName() || "").trim(),
      source: String(meta.source || "saved").trim() || "saved",
      updatedAt: Date.now()
    };
    saveGitConfig({
      project_git_mappings: all,
      repository: repo,
      branch: targetBranch,
      project_id: projectId
    });
    return all[projectId];
  }

  function publicConfigForHostStorage(config) {
    const safe = Object.assign({}, config || {});
    delete safe.github_token;
    delete safe.byok_key;
    delete safe.provider_keys;
    if (Array.isArray(safe.xkiro_accounts)) {
      safe.xkiro_accounts = safe.xkiro_accounts.map(a => ({ id: a.id, label: a.label, email: a.email || "", name: a.name || "" }));
    }
    return safe;
  }

  function saveGitConfig(patch) {
    try {
      const cur = getGitConfig();
      const updated = Object.assign({}, cur, patch);
      _cachedGitConfig = updated;
      localStorage.setItem("__127hub_git_config", JSON.stringify(publicConfigForHostStorage(updated)));
      try {
        window.postMessage({
          source: "LOVABLE_GIT_PAGE_PAYLOAD",
          id: "git_cfg_" + Date.now(),
          type: "storage.set",
          items: { "__127hub_git_config": updated }
        }, "*");
      } catch(_) {}
      return updated;
    } catch (_) {
      return patch;
    }
  }

  function isGitConfigured() {
    try {
      const cur = getGitConfig();
      return !!(cur && cur.repository && !cur.repository.includes("friendly-greetings") && cur.github_token && resolveProviderApiKey(cur));
    } catch (_) {
      return false;
    }
  }


  // Populate cache from chrome.storage.local on boot and migrate legacy v30 settings.
  // Older releases could keep GitHub/BYOK secrets in the Lovable page's localStorage.
  // Preserve those values during upgrade, copy them once into extension storage, then
  // immediately rewrite host storage with the public/non-secret subset only.
  try {
    let legacyHostConfig = {};
    try { legacyHostConfig = JSON.parse(localStorage.getItem("__127hub_git_config") || "{}"); } catch (_) {}
    const initId = "git_cfg_init_" + Date.now();
    window.postMessage({
      source: "LOVABLE_GIT_PAGE_PAYLOAD",
      id: initId,
      type: "storage.get",
      keys: ["__127hub_git_config"]
    }, "*");
    window.addEventListener("message", function onGitCfgInit(e) {
      if (!(e.data && e.data.source === "LOVABLE_GIT_EXTENSION_BRIDGE" && e.data.id === initId)) return;
      window.removeEventListener("message", onGitCfgInit);
      const stored = e.data.result && e.data.result.__127hub_git_config
        ? e.data.result.__127hub_git_config
        : {};
      const merged = Object.assign({}, legacyHostConfig || {}, stored || {});
      if (Object.keys(merged).length) {
        // Normalize legacy one-key formats without forcing users to re-enter anything.
        const accounts = normalizeXKiroAccounts(merged);
        const providerKeys = normalizeProviderKeys(merged);
        if (accounts.length && !Array.isArray(merged.xkiro_accounts)) merged.xkiro_accounts = accounts;
        if (Object.keys(providerKeys).length && !merged.provider_keys) merged.provider_keys = providerKeys;
        if (accounts.length && !merged.xkiro_active_account_id) merged.xkiro_active_account_id = accounts[0].id;
        _cachedGitConfig = merged;

        const legacyHadSecrets = !!(
          legacyHostConfig.github_token ||
          legacyHostConfig.byok_key ||
          legacyHostConfig.provider_keys ||
          (Array.isArray(legacyHostConfig.xkiro_accounts) && legacyHostConfig.xkiro_accounts.some(a => a && (a.apiKey || a.api_key)))
        );
        if (legacyHadSecrets || !e.data.result || !e.data.result.__127hub_git_config) {
          try {
            window.postMessage({
              source: "LOVABLE_GIT_PAGE_PAYLOAD",
              id: "git_cfg_migrate_" + Date.now(),
              type: "storage.set",
              items: { "__127hub_git_config": merged }
            }, "*");
          } catch (_) {}
        }
        try {
          localStorage.setItem("__127hub_git_config", JSON.stringify(publicConfigForHostStorage(merged)));
        } catch(_) {}
      }
    });
  } catch(_) {}

  // Keep MAIN-world configuration current when the isolated extension context
  // restores credentials after an uninstall/reinstall. This also removes the
  // startup race between document_start scripts.
  try {
    window.addEventListener("message", function(e) {
      if (!(e.data && e.data.source === "LOVABLE_GIT_EXTENSION_BRIDGE" && e.data.event === "storage.changed")) return;
      const changes = e.data.changes || {};
      const cfgChange = changes["__127hub_git_config"];
      if (!cfgChange || !cfgChange.newValue || typeof cfgChange.newValue !== "object") return;
      _cachedGitConfig = Object.assign({}, _cachedGitConfig || {}, cfgChange.newValue);
      try {
        localStorage.setItem("__127hub_git_config", JSON.stringify(publicConfigForHostStorage(_cachedGitConfig)));
      } catch (_) {}
    });
  } catch (_) {}

  // Consistent Device ID permanently stored per browser profile
  function getConsistentDeviceId() {
    let devId = localStorage.getItem("__127hub_ultrax_device_id");
    if (!devId) {
      devId = (typeof crypto !== "undefined" && crypto.randomUUID) 
        ? "dev_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24)
        : "dev_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem("__127hub_ultrax_device_id", devId);
    }
    return devId;
  }

  function getActiveProjectId() {
    const runtimeProjectId = getRuntimeLovableProjectId();
    if (runtimeProjectId) return runtimeProjectId;

    const configProjectId = String((rawGitConfig() && rawGitConfig().project_id) || "").trim();
    if (configProjectId) return configProjectId;

    // Never guess another project's id. A stale/hard-coded id can make Lovable
    // sync/refresh the wrong project and leave the current preview loading.
    return "";
  }

  function getLovableToken() {
    return window.__lovasiriLovableToken || window.__lovableAuthToken || localStorage.getItem("sb-lovable-auth-token") || "";
  }

  function randomDigits(n) {
    let s = "";
    for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
    return s;
  }

  // Toast notifier
  function showGitToast(message, type = "info", duration = 4000) {
    const existing = document.getElementById("127hub-git-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = "127hub-git-toast";
    toast.style.cssText = `
      position: fixed;
      bottom: 28px;
      right: 28px;
      z-index: 2147483647;
      background: ${type === "error" ? "linear-gradient(135deg, #7f1d1d, #991b1b)" : type === "success" ? "linear-gradient(135deg, #064e3b, #059669)" : "linear-gradient(135deg, #0f172a, #1e1b4b)"};
      color: #ffffff;
      padding: 14px 22px;
      border-radius: 12px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13.5px;
      font-weight: 600;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5), 0 0 20px ${type === "success" ? "rgba(16,185,129,0.3)" : "rgba(0,242,254,0.25)"};
      border: 1px solid ${type === "error" ? "rgba(239,68,68,0.4)" : type === "success" ? "rgba(16,185,129,0.4)" : "rgba(0,242,254,0.35)"};
      display: flex;
      align-items: center;
      gap: 12px;
      opacity: 0;
      transform: translateY(15px);
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    `;

    const icon = type === "error" ? "⚠" : type === "success" ? "✓" : "🐙";
    toast.innerHTML = `<span style="font-size: 16px;">${icon}</span><span>${message}</span>`;
    const targetBody = (window.top && window.top.document && window.top.document.body) || document.body;
    targetBody.appendChild(toast);

    requestAnimationFrame(() => {
      toast.style.opacity = "1";
      toast.style.transform = "translateY(0)";
    });

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(10px)";
      setTimeout(() => toast.remove(), 350);
    }, duration);
  }

  // ─────────────────────────────────────────────────────────────────
  // Native Lovable Chat Formatting & Container Helpers
  // ─────────────────────────────────────────────────────────────────
  function formatChatMarkdown(text) {
    if (!text) return "";
    let s = escapeHtml(text);
    // Code blocks ```lang ... ```
    s = s.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, function(_, lang, code) {
      return `<pre style="background: #020617; border: 1px solid rgba(0, 242, 254, 0.25); border-radius: 8px; padding: 12px 14px; overflow-x: auto; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: #38bdf8; margin: 10px 0; line-height: 1.5;"><code>${code}</code></pre>`;
    });
    // Inline code `code`
    s = s.replace(/`([^`]+)`/g, '<code style="background: rgba(255,255,255,0.08); padding: 2px 6px; border-radius: 4px; font-family: ui-monospace, monospace; font-size: 12px; color: #38bdf8;">$1</code>');
    // Bold **text**
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong style="color: #ffffff; font-weight: 700;">$1</strong>');
    // Bullet points
    s = s.replace(/^[\*\-]\s+(.+)$/gm, '<div style="margin-left: 12px; margin-top: 4px; display: flex; gap: 8px;"><span style="color: #00f2fe;">•</span><span>$1</span></div>');
    // Numbered lists
    s = s.replace(/^(\d+)\.\s+(.+)$/gm, '<div style="margin-left: 12px; margin-top: 4px; display: flex; gap: 8px;"><span style="color: #00f2fe; font-weight: 600;">$1.</span><span>$2</span></div>');
    // Paragraph breaks
    s = s.replace(/\n\n+/g, '<div style="height: 10px;"></div>');
    s = s.replace(/\n/g, '<br>');
    return s;
  }

  function getLovableChatContainer() {
    const doc = (window.top && window.top.document) || document;
    const composerForm = doc.querySelector('form#chat-input, [data-testid*="chat-input" i]');

    // Helper: ensure a candidate is NOT the composer footer or a tiny non-scrollable wrapper
    function isSafeContainer(el) {
      if (!el || el === doc.body) return false;
      // Never return the composer's direct parent (the fixed footer)
      if (composerForm && (el === composerForm || el === composerForm.parentElement)) return false;
      if (composerForm && el.contains && el.contains(composerForm)) {
        // Only accept if it's a large scrollable wrapper (main chat area), not the small footer
        if (el.scrollHeight > 400 || el.clientHeight > 300) return true;
        return false;
      }
      return true;
    }

    // 1. Find existing message bubbles and return their scrollable parent
    const articles = doc.querySelectorAll('[role="article"], [data-message-id], [data-testid*="message" i]');
    if (articles.length > 0) {
      let candidate = articles[articles.length - 1].parentElement;
      // Walk up to find the actual scrollable container
      let walk = 0;
      while (candidate && walk < 5) {
        if (isSafeContainer(candidate) && (candidate.scrollHeight > candidate.clientHeight || candidate.clientHeight > 200)) {
          return candidate;
        }
        candidate = candidate.parentElement;
        walk++;
      }
      // Fallback: return the direct parent if safe
      const directParent = articles[articles.length - 1].parentElement;
      if (isSafeContainer(directParent)) return directParent;
    }

    // 2. Find scrollable chat area via composer's ancestors (skip the footer itself)
    if (composerForm) {
      const scrollable = composerForm.closest('[class*="chat" i], [class*="conversation" i], [class*="messages" i], main');
      if (scrollable && isSafeContainer(scrollable)) return scrollable;
    }

    // 3. Broad fallback: any messages/chat container
    const fallback = doc.querySelector('[class*="messages" i], [class*="conversation" i], main, [class*="chat" i]');
    if (fallback && isSafeContainer(fallback)) return fallback;

    return doc.body;
  }

  // Protect the composer input box from being hidden or pushed off-screen
  function protectComposerVisibility() {
    try {
      const doc = (window.top && window.top.document) || document;
      const composerForm = doc.querySelector('form#chat-input, [data-testid*="chat-input" i]');
      if (composerForm) {
        composerForm.style.display = '';
        composerForm.style.visibility = 'visible';
        composerForm.style.opacity = '1';
      }
      const textarea = doc.querySelector('form#chat-input textarea, [data-testid*="chat-input" i] textarea');
      if (textarea) {
        textarea.style.display = '';
        textarea.style.visibility = 'visible';
        textarea.style.opacity = '1';
      }
      // Migrate any misplaced cards from the composer footer to the messages container
      if (composerForm && composerForm.parentElement) {
        const footer = composerForm.parentElement;
        const misplacedCards = footer.querySelectorAll('.lovasiri-chat-card');
        if (misplacedCards.length > 0) {
          const msgContainer = getLovableChatContainer();
          if (msgContainer && msgContainer !== footer && msgContainer !== doc.body) {
            misplacedCards.forEach(c => {
              try { msgContainer.appendChild(c); } catch (_) {}
            });
          }
        }
      }
    } catch (_) {}
  }

  // ─────────────────────────────────────────────────────────────────
  // Native Lovable Chatbox Stream Integration (Zero Floating HUD Popups)
  // Everything is displayed cleanly directly inside Lovable\'s chatbox!
  // ─────────────────────────────────────────────────────────────────
  function showGitProgressHud(promptText) {
    // 1. Ensure any legacy floating popup is removed immediately
    const oldHud = document.getElementById("127hub-git-hud");
    if (oldHud) oldHud.remove();
    try {
      if (window.top && window.top.document) {
        const topHud = window.top.document.getElementById("127hub-git-hud");
        if (topHud) topHud.remove();
      }
    } catch (_) {}

    const doc = (window.top && window.top.document) || document;
    const container = getLovableChatContainer();

    // 2. If a previously active card exists, finalize its ID so it remains in chat history
    const existingActive = doc.getElementById("lovasiri-live-chat-card");
    if (existingActive) {
      existingActive.id = "lovasiri-chat-" + Date.now();
    }

    // 3. Create the assistant chat card inside Lovable\'s chat stream
    const card = doc.createElement("div");
    card.id = "lovasiri-live-chat-card";
    card.className = "lovasiri-chat-card";
    card.setAttribute("role", "article");
    card.setAttribute("data-message-id", "lovasiri-" + Date.now());
    card.style.cssText = `
      margin: 16px 0;
      background: linear-gradient(145deg, rgba(10, 16, 31, 0.98), rgba(15, 23, 42, 0.99));
      border: 1px solid rgba(0, 242, 254, 0.35);
      border-radius: 14px;
      padding: 16px 20px;
      color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      box-shadow: 0 10px 28px rgba(0, 0, 0, 0.55), 0 0 24px rgba(0, 242, 254, 0.12);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      line-height: 1.6;
      font-size: 13.5px;
      max-width: 100%;
      box-sizing: border-box;
      animation: hubCardFadeIn 0.3s ease-out;
    `;

    const cleanSnippet = String(promptText || "").slice(0, 120) + (String(promptText || "").length > 120 ? "..." : "");

    card.innerHTML = `
      <style>
        @keyframes hubSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes hubPulseGlow {
          0%, 100% { opacity: 0.8; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.08); filter: drop-shadow(0 0 8px #00f2fe); }
        }
        @keyframes hubCardFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      </style>

      <!-- Card Header -->
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 10px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 20px; animation: hubPulseGlow 2s infinite;">🐙</span>
          <div>
            <span style="font-weight: 800; font-size: 13.5px; color: #00f2fe; letter-spacing: 0.3px;">LOVABLE AI</span>
            <div style="font-size: 11px; color: #94a3b8;">Autonomous GitHub Sync Engine</div>
          </div>
        </div>
        <span style="background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.4); color: #34d399; font-size: 10.5px; font-weight: 700; padding: 2px 9px; border-radius: 10px;">
          Zero Lovable Credits
        </span>
      </div>

      <!-- User Prompt Snippet -->
      ${cleanSnippet ? `
        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 8px 12px; margin-bottom: 12px; font-size: 12.5px; color: #cbd5e1; line-height: 1.4;">
          <span style="color: #38bdf8; font-weight: 600;">Prompt: </span>${escapeHtml(cleanSnippet)}
        </div>
      ` : ''}

      <!-- Dynamic Progress Steps -->
      <div id="hub-card-steps" style="display: flex; flex-direction: column; gap: 8px; font-size: 13px;">
        <div id="hub-card-step-1" style="display: flex; align-items: center; gap: 10px; color: #38bdf8;">
          <div style="width: 14px; height: 14px; border: 2px solid rgba(56,189,248,0.3); border-top-color: #38bdf8; border-radius: 50%; animation: hubSpin 0.8s linear infinite;"></div>
          <span>Reading repository structure...</span>
        </div>
        <div id="hub-card-step-2" style="display: flex; align-items: center; gap: 10px; color: #64748b;">
          <span style="width: 14px; text-align: center; font-size: 11px;">○</span>
          <span id="hub-card-step-2-text">Thinking & synthesizing response...</span>
        </div>
        <div id="hub-card-step-3" style="display: flex; align-items: center; gap: 10px; color: #64748b;">
          <span style="width: 14px; text-align: center; font-size: 11px;">○</span>
          <span id="hub-card-step-3-text">Committing & pushing to GitHub...</span>
        </div>
      </div>

      <!-- Live Activity Terminal Log -->
      <div id="hub-card-terminal" style="margin-top: 12px; background: #060a14; border: 1px solid rgba(0, 242, 254, 0.2); border-radius: 8px; padding: 8px 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11.5px; color: #38bdf8; max-height: 75px; overflow-y: auto; line-height: 1.5;">
        <div style="color: #64748b;">> [LOVABLE AI] Initializing Git Mode session...</div>
      </div>

      <!-- Card Action Footer -->
      <div id="hub-card-footer" style="margin-top: 12px; display: flex; align-items: center; justify-content: flex-end;">
        <button id="hub-card-cancel" style="background: transparent; border: 1px solid rgba(255,255,255,0.15); color: #94a3b8; padding: 4px 12px; border-radius: 6px; font-size: 12px; cursor: pointer; transition: all 0.2s;">Cancel</button>
      </div>
    `;

    // 4. Insert card into Lovable chatbox messages stream (NEVER into composer footer!)
    container.appendChild(card);
    protectComposerVisibility();

    function ensureCardAttached() {
      try {
        if (card && card.isConnected) return;
        const liveContainer = getLovableChatContainer();
        if (liveContainer && card) liveContainer.appendChild(card);
        protectComposerVisibility();
      } catch (_) {}
    }

    function scrollToCard() {
      try {
        ensureCardAttached();
        const liveContainer = card && card.parentElement ? card.parentElement : getLovableChatContainer();
        if (liveContainer) liveContainer.scrollTop = liveContainer.scrollHeight;
        if (card && card.scrollIntoView) card.scrollIntoView({ behavior: "smooth", block: "nearest" });
      } catch (_) {}
    }
    scrollToCard();

    let isCancelled = false;
    let activityInterval = null;
    const cancelBtn = card.querySelector("#hub-card-cancel");
    if (cancelBtn) {
      cancelBtn.onclick = () => {
        isCancelled = true;
        if (activityInterval) clearInterval(activityInterval);
        card.innerHTML = `
          <div style="color: #f59e0b; font-size: 12.5px; display: flex; align-items: center; gap: 8px;">
            <span>⚠</span><span>Operation cancelled by user.</span>
          </div>
        `;
        showGitToast("Git Mode operation cancelled.", "info");
      };
    }

    const activities = [
      "Analyzing requirements & project architecture...",
      "Inspecting target files & component hierarchy...",
      "Writing full TypeScript logic & React components...",
      "Applying responsive Tailwind CSS styling...",
      "Synthesizing production code & assembling diffs..."
    ];
    let actIdx = 0;

    function appendLog(line, color = "#38bdf8") {
      ensureCardAttached();
      const term = card.querySelector("#hub-card-terminal");
      if (!term) return;
      const d = document.createElement("div");
      d.style.color = color;
      d.textContent = "> " + line;
      term.appendChild(d);
      term.scrollTop = term.scrollHeight;
    }

    return {
      isCancelled: () => isCancelled,
      appendLog: appendLog,
      setStep: (stepNumber, message) => {
        if (isCancelled) return;
        const s1 = card.querySelector("#hub-card-step-1");
        const s2 = card.querySelector("#hub-card-step-2");
        const s3 = card.querySelector("#hub-card-step-3");

        if (stepNumber === 1 && s1) {
          s1.style.color = "#38bdf8";
          s1.innerHTML = `<div style="width: 14px; height: 14px; border: 2px solid rgba(56,189,248,0.3); border-top-color: #38bdf8; border-radius: 50%; animation: hubSpin 0.8s linear infinite;"></div><span>${escapeHtml(message || "Reading repository structure...")}</span>`;
        } else if (stepNumber === 2) {
          if (s1) {
            s1.style.color = "#10b981";
            s1.innerHTML = `<span style="width: 14px; text-align: center; color: #10b981; font-weight: 800;">✓</span><span>Repository structure loaded</span>`;
          }
          if (s2) {
            s2.style.color = "#38bdf8";
            s2.innerHTML = `<div style="width: 14px; height: 14px; border: 2px solid rgba(56,189,248,0.3); border-top-color: #38bdf8; border-radius: 50%; animation: hubSpin 0.8s linear infinite;"></div><span id="hub-card-step-2-text">${escapeHtml(message || "Writing code via BYOK AI...")}</span>`;
          }
          // Dynamic activity ticker
          if (!activityInterval) {
            activityInterval = setInterval(() => {
              if (isCancelled) return;
              ensureCardAttached();
              actIdx = (actIdx + 1) % activities.length;
              const textEl = card.querySelector("#hub-card-step-2-text");
              if (textEl) {
                textEl.textContent = activities[actIdx];
              }
              appendLog(activities[actIdx], "#94a3b8");
            }, 1400);
          }
        } else if (stepNumber === 3) {
          if (activityInterval) {
            clearInterval(activityInterval);
            activityInterval = null;
          }
          if (s2) {
            s2.style.color = "#10b981";
            s2.innerHTML = `<span style="width: 14px; text-align: center; color: #10b981; font-weight: 800;">✓</span><span>Response generation completed</span>`;
          }
          if (s3) {
            s3.style.color = "#38bdf8";
            s3.innerHTML = `<div style="width: 14px; height: 14px; border: 2px solid rgba(56,189,248,0.3); border-top-color: #38bdf8; border-radius: 50%; animation: hubSpin 0.8s linear infinite;"></div><span>${escapeHtml(message || "Committing changes to GitHub...")}</span>`;
          }
        }
        scrollToCard();
      },
      setSuccess: (commitSha, changes, summary, branch, onReviewDiff, thinking) => {
        if (isCancelled) return;
        if (activityInterval) clearInterval(activityInterval);

        const shortSha = String(commitSha || "").slice(0, 7) || "HEAD";
        const fileBadges = (changes || []).map(c => `
          <div style="background: rgba(56, 189, 248, 0.08); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 6px; padding: 4px 10px; font-size: 11.5px; font-family: monospace; color: #a5f3fc; display: flex; align-items: center; gap: 6px;">
            <span style="color: #10b981; font-weight: bold;">✓</span><span>${escapeHtml(c.path)}</span>
          </div>
        `).join("");

        card.innerHTML = `
          <!-- Header -->
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 10px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <img src="${LOVABLE_ASSISTANT_LOGO_DATA}" alt="Lovable" style="width:26px;height:26px;border-radius:7px;object-fit:contain;">
              <div>
                <span style="font-weight: 800; font-size: 13.5px; color: #00f2fe; letter-spacing: 0.3px;">LOVABLE AI</span>
                <div style="font-size: 11px; color: #94a3b8;">Autonomous GitHub Sync Engine</div>
              </div>
            </div>
            <span style="background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.4); color: #34d399; font-size: 10.5px; font-weight: 700; padding: 2px 9px; border-radius: 10px;">
              Zero Lovable Credits
            </span>
          </div>

          <!-- Thinking block if present -->
          ${thinking && thinking.trim() ? `
            <details style="margin-bottom: 12px; background: rgba(0,0,0,0.45); border: 1px solid rgba(56, 189, 248, 0.22); border-radius: 8px; padding: 8px 12px;">
              <summary style="cursor: pointer; color: #38bdf8; font-size: 12px; font-weight: 700; display: flex; align-items: center; gap: 6px; user-select: none;">
                <span>💭 AI Thinking Process</span>
                <span style="font-size: 10.5px; color: #64748b; font-weight: normal;">(click to expand)</span>
              </summary>
              <div style="margin-top: 8px; font-size: 12px; color: #cbd5e1; line-height: 1.5; white-space: pre-wrap; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; max-height: 140px; overflow-y: auto; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 8px;">${escapeHtml(thinking.trim())}</div>
            </details>
          ` : ''}

          <!-- Summary -->
          <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; padding: 10px 14px; margin-bottom: 12px; font-size: 13px; color: #cbd5e1; line-height: 1.4;">
            ${escapeHtml(summary || "Modifications committed and pushed to GitHub.")}
          </div>

          <!-- Commit & Sync Badge -->
          <div style="margin-bottom: 12px; background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 10px 14px; font-size: 12.5px; color: #34d399; display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 16px;">🚀</span>
              <span><strong>Committed & Pushed to GitHub:</strong> <code style="color: #00f2fe; background: #0c182c; padding: 2px 6px; border-radius: 4px;">${shortSha}</code> · Branch: <code style="color: #a7f3d0; background: #0c182c; padding: 2px 6px; border-radius: 4px;">${escapeHtml(branch || "main")}</code></span>
            </div>
            <span style="font-size: 11px; background: rgba(16,185,129,0.2); padding: 2px 8px; border-radius: 10px; font-weight: 700;">GitHub Pushed</span>
          </div>

          <!-- Files updated list -->
          <div style="font-size: 11.5px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
            Pushed Files (${(changes || []).length})
          </div>
          <div style="display: flex; flex-direction: column; gap: 6px; max-height: 110px; overflow-y: auto; margin-bottom: 14px;">
            ${fileBadges || '<div style="color: #94a3b8; font-size: 12px;">Files updated.</div>'}
          </div>

          <!-- Actions Footer -->
          <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 12px; gap: 8px; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <button id="hub-card-review-btn" style="background: rgba(0, 242, 254, 0.12); border: 1px solid rgba(0, 242, 254, 0.3); color: #38bdf8; padding: 6px 14px; border-radius: 6px; font-size: 12.5px; font-weight: 700; cursor: pointer; transition: all 0.2s;">
                👁 View Code Diff
              </button>
              <button id="hub-card-refresh-btn" style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.35); color: #34d399; padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 6px;">
                <span>🔄</span><span>Refresh Lovable Preview</span>
              </button>
            </div>
            <span id="hub-card-preview-indicator" style="font-size: 11.5px; color: #10b981; font-weight: 600;">Waiting for Lovable sync</span>
          </div>
        `;

        const reviewBtn = card.querySelector("#hub-card-review-btn");
        if (reviewBtn) {
          reviewBtn.onclick = () => {
            if (typeof onReviewDiff === "function") onReviewDiff();
          };
        }

        const refreshBtn = card.querySelector("#hub-card-refresh-btn");
        if (refreshBtn) {
          refreshBtn.onclick = async () => {
            refreshBtn.style.opacity = "0.6";
            const ind = card.querySelector("#hub-card-preview-indicator");
            if (ind) ind.textContent = "Waiting for Lovable sync...";
            try {
              await refreshLovablePreview(commitSha);
              if (ind) ind.textContent = "✓ Native preview refresh requested";
              showGitToast("✓ Lovable preview refresh requested", "success", 3000);
            } catch (_) {}
            setTimeout(() => { refreshBtn.style.opacity = "1"; }, 1000);
          };
        }

        // Finalize card id so it remains in chat history
        card.id = "lovasiri-msg-" + Date.now();
        scrollToCard();
      },
      setConversationalResponse: (replyText, thinking) => {
        if (isCancelled) return;
        if (activityInterval) clearInterval(activityInterval);

        card.innerHTML = `
          <!-- Header -->
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 10px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <img src="${LOVABLE_ASSISTANT_LOGO_DATA}" alt="Lovable" style="width:26px;height:26px;border-radius:7px;object-fit:contain;">
              <div>
                <span style="font-weight: 800; font-size: 13.5px; color: #00f2fe; letter-spacing: 0.3px;">LOVABLE AI</span>
                <div style="font-size: 11px; color: #94a3b8;">Autonomous GitHub Sync Engine</div>
              </div>
            </div>
            <span style="background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.4); color: #34d399; font-size: 10.5px; font-weight: 700; padding: 2px 9px; border-radius: 10px;">
              Zero Lovable Credits
            </span>
          </div>

          <!-- Thinking block -->
          ${thinking && thinking.trim() ? `
            <details open style="margin-bottom: 12px; background: rgba(0,0,0,0.45); border: 1px solid rgba(56, 189, 248, 0.22); border-radius: 8px; padding: 8px 12px;">
              <summary style="cursor: pointer; color: #38bdf8; font-size: 12px; font-weight: 700; display: flex; align-items: center; gap: 6px; user-select: none;">
                <span>💭 AI Thinking Process</span>
                <span style="font-size: 10.5px; color: #64748b; font-weight: normal;">(click to collapse)</span>
              </summary>
              <div style="margin-top: 8px; font-size: 12px; color: #cbd5e1; line-height: 1.5; white-space: pre-wrap; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; max-height: 150px; overflow-y: auto; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 8px;">${escapeHtml(thinking.trim())}</div>
            </details>
          ` : ''}

          <!-- Formatted reply -->
          <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; padding: 12px 14px; margin-bottom: 12px; font-size: 13.5px; color: #e2e8f0; line-height: 1.6;">
            ${formatChatMarkdown(replyText)}
          </div>

          <!-- Action Footer -->
          <div style="display: flex; align-items: center; justify-content: flex-end; gap: 8px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 10px;">
            <button id="hub-card-copy-btn" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.2); color: #ffffff; padding: 5px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s;">
              📋 Copy Response
            </button>
          </div>
        `;

        const copyBtn = card.querySelector("#hub-card-copy-btn");
        if (copyBtn) {
          copyBtn.onclick = () => {
            navigator.clipboard.writeText(replyText).then(() => {
              copyBtn.textContent = "✓ Copied!";
              setTimeout(() => { copyBtn.textContent = "📋 Copy Response"; }, 2000);
            }).catch(() => {});
          };
        }

        // Finalize card id so it remains in chat history
        card.id = "lovasiri-msg-" + Date.now();
        scrollToCard();
      },
      setError: (errTitle, errMsg) => {
        if (isCancelled) return;
        if (activityInterval) clearInterval(activityInterval);

        card.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <img src="${LOVABLE_ASSISTANT_LOGO_DATA}" alt="Lovable" style="width:24px;height:24px;border-radius:7px;object-fit:contain;">
              <span style="font-weight: 700; font-size: 13px; color: #00f2fe;">LOVABLE AI</span>
            </div>
            <span style="background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.35); color: #fca5a5; font-size: 10.5px; font-weight: 700; padding: 2px 8px; border-radius: 10px;">
              Error
            </span>
          </div>
          <div style="background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); border-radius: 8px; padding: 12px 14px; color: #fca5a5; margin-bottom: 10px;">
            <div style="font-weight: 700; font-size: 13px; margin-bottom: 4px;">⚠ ${escapeHtml(errTitle || "Generation Error")}</div>
            <div style="font-size: 12px; line-height: 1.4;">${escapeHtml(errMsg || "An unexpected error occurred.")}</div>
          </div>
          <div style="display: flex; align-items: center; justify-content: flex-end; gap: 8px;">
            <button id="hub-card-settings-btn" style="background: rgba(0,242,254,0.15); border: 1px solid rgba(0,242,254,0.3); color: #38bdf8; padding: 5px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;">
              ⚙ Open Git Settings
            </button>
          </div>
        `;

        const settingsBtn = card.querySelector("#hub-card-settings-btn");
        if (settingsBtn) {
          settingsBtn.onclick = () => openGitSettings();
        }

        card.id = "lovasiri-msg-" + Date.now();
        scrollToCard();
      },
      close: () => {
        if (activityInterval) clearInterval(activityInterval);
      }
    };
  }

  function injectMessageIntoLovableChat(opts) {
    try {
      const doc = (window.top && window.top.document) || document;
      const {
        id = "lovasiri-chat-" + Date.now(),
        promptText = "",
        thinking = "",
        replyText = "",
        isPending = false,
        pendingStatus = "Thinking & analyzing project...",
        isError = false,
        errorMessage = "",
        commitSha = "",
        filesCount = 0
      } = opts;

      const container = getLovableChatContainer();
      if (!container) return null;

      let el = doc.getElementById(id);
      if (!el) {
        el = doc.createElement("div");
        el.id = id;
        el.className = "lovasiri-chat-card";
        el.setAttribute("role", "article");
        el.setAttribute("data-message-id", id);

        // Always append to the scrollable messages container (NEVER composer footer!)
        container.appendChild(el);
        protectComposerVisibility();
      }

      el.style.cssText = `
        margin: 16px 0;
        background: linear-gradient(145deg, rgba(10, 16, 31, 0.98), rgba(15, 23, 42, 0.99));
        border: 1px solid rgba(0, 242, 254, 0.35);
        border-radius: 14px;
        padding: 16px 20px;
        color: #f1f5f9;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        box-shadow: 0 10px 28px rgba(0, 0, 0, 0.55), 0 0 24px rgba(0, 242, 254, 0.12);
        backdrop-filter: blur(12px);
        line-height: 1.6;
        font-size: 13.5px;
        max-width: 100%;
        box-sizing: border-box;
      `;

      let inner = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.07); padding-bottom: 8px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <img src="${LOVABLE_ASSISTANT_LOGO_DATA}" alt="Lovable" style="width:24px;height:24px;border-radius:7px;object-fit:contain;">
            <span style="font-weight: 700; font-size: 13px; color: #00f2fe; letter-spacing: 0.3px;">LOVABLE AI</span>
          </div>
          <span style="background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.35); color: #34d399; font-size: 10.5px; font-weight: 700; padding: 2px 8px; border-radius: 10px;">
            Zero Lovable Credits
          </span>
        </div>
      `;

      if (isPending) {
        inner += `
          <div style="display: flex; align-items: center; gap: 10px; color: #38bdf8; padding: 10px 0; font-size: 13px;">
            <div style="width: 16px; height: 16px; border: 2px solid rgba(56,189,248,0.3); border-top-color: #38bdf8; border-radius: 50%; animation: hubSpin 0.8s linear infinite;"></div>
            <span>${escapeHtml(pendingStatus || "Thinking & synthesizing response...")}</span>
          </div>
        `;
      } else if (isError) {
        inner += `
          <div style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.35); border-radius: 8px; padding: 10px 14px; color: #fca5a5; font-size: 12.5px;">
            <div style="font-weight: 700; margin-bottom: 4px;">⚠ Generation Error</div>
            <div>${escapeHtml(errorMessage || "An error occurred")}</div>
          </div>
        `;
      } else {
        if (thinking && thinking.trim()) {
          inner += `
            <details open style="margin: 8px 0 12px; background: rgba(0,0,0,0.45); border: 1px solid rgba(56, 189, 248, 0.22); border-radius: 8px; padding: 8px 12px;">
              <summary style="cursor: pointer; color: #38bdf8; font-size: 12px; font-weight: 700; display: flex; align-items: center; gap: 6px; user-select: none;">
                <span>💭 AI Thinking Process</span>
                <span style="font-size: 10.5px; color: #64748b; font-weight: normal;">(click to collapse)</span>
              </summary>
              <div style="margin-top: 8px; font-size: 12px; color: #cbd5e1; line-height: 1.5; white-space: pre-wrap; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 8px;">${escapeHtml(thinking.trim())}</div>
            </details>
          `;
        }

        if (replyText) {
          inner += `<div style="color: #e2e8f0; line-height: 1.6; font-size: 13.5px; margin: 8px 0;">${formatChatMarkdown(replyText)}</div>`;
        }

        if (commitSha) {
          const short = commitSha.slice(0, 7);
          inner += `
            <div style="margin-top: 12px; display: flex; align-items: center; justify-content: space-between; background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 8px 12px; font-size: 12px; color: #34d399;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-weight: 800;">✓</span>
                <span>Pushed to GitHub: <strong>${short}</strong> (${filesCount || 1} file(s) updated)</span>
              </div>
            </div>
          `;
        }
      }

      el.innerHTML = inner;

      try {
        if (container) container.scrollTop = container.scrollHeight;
        if (el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      } catch (_) {}

      return el;
    } catch (e) {
      console.warn("[LOVABLE AI] injectMessageIntoLovableChat error:", e);
      return null;
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // UltraX Background Stealth Proxy Bridge (Zero CORS / Zero CSP)
  // ─────────────────────────────────────────────────────────────────

  // Background Communication Bridge (Bypasses all page CORS & CSP)
  function callBackground(message) {
    return new Promise((resolve, reject) => {
      const id = "hub_bg_" + Date.now() + "_" + Math.random().toString(36).slice(2);

      function cleanup() {
        clearTimeout(timer);
        window.removeEventListener("message", handler);
        try {
          if (window.top && window.top !== window) {
            window.top.removeEventListener("message", handler);
          }
        } catch (_) {}
      }

      const timer = setTimeout(() => {
        cleanup();
        reject(new Error("Timeout waiting for background service worker. Please reload the Lovable tab (F5)."));
      }, 295000);

      function handler(e) {
        if (!e.data || e.data.source !== "LOVABLE_GIT_EXTENSION_BRIDGE" || e.data.id !== id) return;
        cleanup();
        if (e.data.ok) {
          const res = e.data.result;
          if (res && res.ok === false) {
            reject(new Error(res.error || res.message || "Background task failed"));
          } else {
            resolve(res || { ok: true });
          }
        } else {
          reject(new Error(e.data.error || "Bridge communication error"));
        }
      }

      window.addEventListener("message", handler);
      try {
        if (window.top && window.top !== window) {
          window.top.addEventListener("message", handler);
        }
      } catch (_) {}

      const payload = {
        source: "LOVABLE_GIT_PAGE_PAYLOAD",
        id: id,
        type: "runtime.sendMessage",
        message: message
      };

      window.postMessage(payload, "*");
      try {
        if (window.top && window.top !== window) {
          window.top.postMessage(payload, "*");
        }
      } catch (_) {}
    });
  }



  // ─────────────────────────────────────────────────────────────────
  // GitHub Auto-Detection & Project Auto-Connect
  // ─────────────────────────────────────────────────────────────────
  function autoDetectGitHubRepo(options = {}) {
    const allowStorage = options.allowStorage === true;
    const allowConfigFallback = options.allowConfigFallback === true;

    function cleanRepo(match) {
      const repo = String(match || "").replace(/\.git$/i, "").replace(/\/(tree|blob|commit|pull|issues|actions|settings)(?:\/.*)?$/i, "").trim();
      if (!repo || repo.toLowerCase().includes("lovable-dev") || repo.includes("/login") || repo.includes("/signup")) return "";
      return repo;
    }

    function detectedBranch(el) {
      try {
        const raw = String((el && (el.getAttribute("data-branch") || el.getAttribute("data-git-branch") || el.getAttribute("data-github-branch"))) || "").trim();
        if (raw) return raw;
      } catch (_) {}
      return "main";
    }

    // 1. Current-page GitHub links are the strongest signal because they belong to
    // the Lovable project that is actually open right now.
    const links = Array.from(document.querySelectorAll('a[href*="github.com/"]'));
    for (const a of links) {
      const href = a.getAttribute("href") || "";
      const match = href.match(/github\.com\/([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)/i);
      if (match && match[1]) {
        const repo = cleanRepo(match[1]);
        if (repo) return { repository: repo, branch: detectedBranch(a), source: "dom_link", confidence: "high" };
      }
    }

    // 2. Explicit repo metadata/badges in the current Lovable DOM.
    const ghElements = document.querySelectorAll('[data-github-repo], [data-repo], button[title*="github.com"], a[title*="github.com"]');
    for (const el of ghElements) {
      const raw = el.dataset.githubRepo || el.dataset.repo || el.getAttribute("title") || "";
      const match = raw.match(/github\.com\/([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)/i) || raw.match(/^([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)$/);
      if (match && match[1]) {
        const repo = cleanRepo(match[1]);
        if (repo) return { repository: repo, branch: detectedBranch(el), source: "dom_badge", confidence: "high" };
      }
    }

    // Storage can contain stale values from a previously opened project, so it is
    // opt-in only and is never used for automatic project binding or commit safety.
    if (allowStorage) {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && /github|git_repo/i.test(k)) {
            const v = localStorage.getItem(k);
            const m = String(v).match(/([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)/);
            const repo = m && m[1] ? cleanRepo(m[1]) : "";
            if (repo) return { repository: repo, branch: "main", source: "storage", confidence: "low" };
          }
        }
      } catch (_) {}
    }

    if (allowConfigFallback) {
      const conf = rawGitConfig();
      if (normalizeGitRepository(conf.repository) && !String(conf.repository).includes("friendly-greetings")) {
        return { repository: conf.repository, branch: conf.branch || "main", source: "config", confidence: "low" };
      }
    }
    return null;
  }

  function ensureCurrentProjectGitMapping() {
    const projectId = getRuntimeLovableProjectId();
    if (!projectId) return getGitConfig();

    const base = rawGitConfig();
    const existing = getProjectGitMapping(base, projectId);
    if (existing) return getGitConfig();

    // Migrate v32.0.1/older configuration only when it explicitly belongs to this
    // exact project id.
    if (String(base.project_id || "").trim() === projectId && normalizeGitRepository(base.repository)) {
      saveCurrentProjectGitMapping(base.repository, base.branch || "main", { source: "legacy_project_match", projectName: getLovableProjectName() });
      return getGitConfig();
    }

    // Auto-bind only from high-confidence evidence visible in the CURRENT project.
    const detected = autoDetectGitHubRepo({ allowStorage: false, allowConfigFallback: false });
    if (detected && detected.repository && detected.confidence === "high") {
      saveCurrentProjectGitMapping(detected.repository, detected.branch || "main", { source: detected.source, projectName: getLovableProjectName() });
      return getGitConfig();
    }
    return getGitConfig();
  }

  function assertCurrentProjectGitTarget(config, operation = "GitHub operation") {
    const projectId = getRuntimeLovableProjectId();
    if (!projectId) {
      throw new Error(`${operation} blocked: the current Lovable project could not be identified safely. Refresh this project and try again.`);
    }

    const current = config || ensureCurrentProjectGitMapping();
    const base = rawGitConfig();
    const mapping = getProjectGitMapping(base, projectId);
    if (!mapping) {
      throw new Error(`${operation} blocked: this Lovable project has no verified GitHub repository mapping yet. Open Git Settings and use Auto Detect & Connect once.`);
    }

    if (normalizeGitRepository(current.repository) !== normalizeGitRepository(mapping.repository) || String(current.branch || "main") !== String(mapping.branch || "main")) {
      throw new Error(`${operation} blocked: the GitHub target does not match this Lovable project's saved repository/branch.`);
    }

    // If Lovable visibly exposes a repository, it must agree with our project mapping.
    const visible = autoDetectGitHubRepo({ allowStorage: false, allowConfigFallback: false });
    if (visible && visible.repository && normalizeGitRepository(visible.repository) !== normalizeGitRepository(mapping.repository)) {
      throw new Error(`${operation} blocked for safety: Lovable currently shows ${visible.repository}, but this project is mapped to ${mapping.repository}. Reconnect the correct repository in Git Settings.`);
    }

    return mapping;
  }

  function getLovableProjectName() {
    try {
      if (document.title) {
        let clean = document.title.replace(/\s*[-·|—–]\s*Lovable.*$/i, "").trim();
        if (clean && clean.toLowerCase() !== "lovable" && !clean.startsWith("http")) {
          return clean;
        }
      }
    } catch (_) {}

    const selectors = [
      '[data-testid="project-title"]',
      '[data-project-name]',
      'header button span.truncate',
      'header [contenteditable="true"]',
      'header h1',
      'header h2'
    ];
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el && el.textContent && el.textContent.trim()) {
          const text = el.textContent.trim();
          if (text.length > 1 && text.length < 50 && !text.toLowerCase().includes("lovable")) {
            return text;
          }
        }
      } catch (_) {}
    }

    try {
      const match = window.location.pathname.match(/\/projects\/([^/?#]+)/i);
      if (match && match[1]) {
        return match[1];
      }
    } catch (_) {}

    return "lovable-app";
  }

  // ─────────────────────────────────────────────────────────────────
  // GitHub Settings & Repository Linking Dialog (with BYOK & Auto-Connect)
  // ─────────────────────────────────────────────────────────────────
  function sanitizeProviderUiError(value) {
    const raw = String(value || "Unknown provider error").trim();
    if (!raw) return "Unknown provider error";
    if (/<\/?(?:html|head|body|title|center|hr|script|style|!doctype)\b/i.test(raw) ||
        (/(?:bad gateway|gateway time-?out|cloudflare|nginx|\balb\b)/i.test(raw) && /<[^>]+>/.test(raw))) {
      if (/504|gateway time-?out/i.test(raw)) return "Provider took too long to respond (504). Please try again shortly.";
      if (/502|bad gateway/i.test(raw)) return "Provider is temporarily unavailable (502). Please try again shortly.";
      if (/503|service unavailable/i.test(raw)) return "Provider is temporarily unavailable (503). Please try again shortly.";
      return "Provider returned an invalid gateway response. Please try again shortly.";
    }
    if (/anthropic-workspace-id|workspace.+required|not scoped to a workspace|identity-linked api key/i.test(raw)) {
      return "Anthropic workspace required. Enter the Workspace ID (wrkspc_...) and test again.";
    }
    return raw.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").slice(0, 600).trim();
  }


  // ─────────────────────────────────────────────────────────────────
  // Developer Diagnostics / Session Recorder (v32.1.1)
  // Records every AI job in a sanitized IndexedDB journal and can export
  // a ZIP at any time. Secrets and image bytes are never exported.
  // ─────────────────────────────────────────────────────────────────
  const DEV_DIAG_SCHEMA = 1;
  const DEV_DIAG_DB_NAME = "__lovasiri_dev_diagnostics_v1";
  const DEV_DIAG_DB_VERSION = 1;
  const DEV_DIAG_STORE = "jobs";
  const DEV_DIAG_ACTIVE = new Map();

  function diagnosticExtensionVersion() {
    // MAIN-world pages can expose their own chrome/runtime shim. Use our explicit
    // build ID so exports never report the page shim version (for example 80.0).
    return LOVASIRI_BUILD_VERSION;
  }

  function diagnosticEnabled(config) {
    return !config || config.dev_diagnostics !== false;
  }

  function diagnosticDeepEnabled(config) {
    // Development build default: capture the exact text/code context sent to AI.
    // Image bytes and credentials are still stripped.
    return !config || config.dev_diagnostics_deep !== false;
  }

  function diagnosticRedactString(value) {
    let text = String(value == null ? "" : value);
    // Authorization headers / common API-key families / GitHub PATs / JWTs.
    text = text.replace(/Bearer\s+[A-Za-z0-9._~+\/-]{12,}/gi, "Bearer [REDACTED]");
    text = text.replace(/\bgithub_pat_[A-Za-z0-9_]{12,}\b/g, "github_pat_[REDACTED]");
    text = text.replace(/\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, "gh_[REDACTED]");
    text = text.replace(/\bsk-[A-Za-z0-9_-]{10,}\b/g, "sk-[REDACTED]");
    text = text.replace(/\bAIza[0-9A-Za-z_-]{20,}\b/g, "AIza[REDACTED]");
    text = text.replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, "[JWT_REDACTED]");
    text = text.replace(/([?&](?:key|api_key|apikey|token|access_token)=)[^&#\s]+/gi, "$1[REDACTED]");
    // Never export image/base64 bodies. Keep MIME/size clue only.
    text = text.replace(/data:(image\/[a-z0-9.+-]+);base64,[A-Za-z0-9+/=\r\n]+/gi, function(m, mime) {
      return `[${mime || "image"} base64 redacted; ${m.length.toLocaleString()} chars]`;
    });
    return text;
  }

  function diagnosticSanitize(value, keyHint, depth) {
    const d = Number(depth || 0);
    if (d > 10) return "[depth-limit]";
    const key = String(keyHint || "").toLowerCase();
    if (/^(?:api.?key|apikey|token|access.?token|refresh.?token|authorization|password|secret|cookie|github_token|byok_key)$/i.test(key) || /(?:password|secret|authorization|github_token|byok_key|api.?key)$/i.test(key)) {
      return value ? "[REDACTED]" : value;
    }
    if (typeof value === "string") return diagnosticRedactString(value);
    if (value == null || typeof value === "number" || typeof value === "boolean") return value;
    if (Array.isArray(value)) return value.map(v => diagnosticSanitize(v, keyHint, d + 1));
    if (typeof value === "object") {
      const out = {};
      Object.keys(value).forEach(k => {
        if (/^(?:imageData|base64|blob|bytes)$/i.test(k)) {
          out[k] = "[BINARY_REDACTED]";
        } else {
          out[k] = diagnosticSanitize(value[k], k, d + 1);
        }
      });
      return out;
    }
    return String(value);
  }

  function diagnosticModelContent(content) {
    if (typeof content === "string") return diagnosticRedactString(content);
    if (!Array.isArray(content)) return diagnosticSanitize(content, "content", 0);
    return content.map(part => {
      if (!part || typeof part !== "object") return diagnosticSanitize(part, "content", 0);
      if (part.type === "image_url" || part.type === "input_image" || part.inline_data || part.inlineData) {
        const clone = Object.assign({}, part);
        if (clone.image_url && typeof clone.image_url === "object") clone.image_url = { url: "[IMAGE_DATA_REDACTED]" };
        if (clone.image_url && typeof clone.image_url === "string") clone.image_url = "[IMAGE_DATA_REDACTED]";
        if (clone.inline_data) clone.inline_data = { mime_type: clone.inline_data.mime_type || "image/*", data: "[IMAGE_DATA_REDACTED]" };
        if (clone.inlineData) clone.inlineData = { mimeType: clone.inlineData.mimeType || "image/*", data: "[IMAGE_DATA_REDACTED]" };
        return diagnosticSanitize(clone, "content", 0);
      }
      return diagnosticSanitize(part, "content", 0);
    });
  }

  function diagnosticOpenDb() {
    return new Promise((resolve, reject) => {
      try {
        const req = indexedDB.open(DEV_DIAG_DB_NAME, DEV_DIAG_DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(DEV_DIAG_STORE)) {
            const store = db.createObjectStore(DEV_DIAG_STORE, { keyPath: "id" });
            store.createIndex("startedAt", "startedAt", { unique: false });
            store.createIndex("projectId", "project.projectId", { unique: false });
            store.createIndex("repository", "project.repository", { unique: false });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error || new Error("Diagnostics DB open failed"));
      } catch (err) { reject(err); }
    });
  }

  async function diagnosticDbPut(record) {
    try {
      const db = await diagnosticOpenDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(DEV_DIAG_STORE, "readwrite");
        tx.objectStore(DEV_DIAG_STORE).put(diagnosticSanitize(record, "job", 0));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error || new Error("Diagnostics write failed"));
      });
      try { db.close(); } catch (_) {}
    } catch (err) {
      console.warn("[LOVABLE AI] Diagnostics write skipped:", err && err.message || err);
    }
  }

  async function diagnosticDbList() {
    try {
      const db = await diagnosticOpenDb();
      const rows = await new Promise((resolve, reject) => {
        const tx = db.transaction(DEV_DIAG_STORE, "readonly");
        const req = tx.objectStore(DEV_DIAG_STORE).getAll();
        req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
        req.onerror = () => reject(req.error || new Error("Diagnostics read failed"));
      });
      try { db.close(); } catch (_) {}
      return rows.sort((a, b) => Number(a.startedAt || 0) - Number(b.startedAt || 0));
    } catch (_) { return []; }
  }

  async function diagnosticDbClear(projectOnly) {
    const rows = await diagnosticDbList();
    const currentProjectId = String(getRuntimeLovableProjectId() || "");
    const currentRepo = normalizeGitRepository((getGitConfig() || {}).repository || "");
    const ids = projectOnly
      ? rows.filter(r => (currentProjectId && String(r.project && r.project.projectId || "") === currentProjectId) || (currentRepo && normalizeGitRepository(r.project && r.project.repository || "") === currentRepo)).map(r => r.id)
      : rows.map(r => r.id);
    if (!ids.length) return 0;
    try {
      const db = await diagnosticOpenDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(DEV_DIAG_STORE, "readwrite");
        const store = tx.objectStore(DEV_DIAG_STORE);
        ids.forEach(id => store.delete(id));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error || new Error("Diagnostics clear failed"));
      });
      try { db.close(); } catch (_) {}
      ids.forEach(id => DEV_DIAG_ACTIVE.delete(id));
      return ids.length;
    } catch (_) { return 0; }
  }

  function diagnosticProjectSnapshot(config) {
    return {
      projectId: String(getRuntimeLovableProjectId() || getActiveProjectId() || ""),
      projectName: String(getLovableProjectName() || ""),
      repository: String(config && config.repository || ""),
      branch: String(config && config.branch || "main"),
      page: String(location && location.pathname || "")
    };
  }

  function diagnosticStartJob(meta) {
    const config = meta && meta.config || getGitConfig() || {};
    if (!diagnosticEnabled(config)) return "";
    const now = Date.now();
    const id = `diag_${now}_${Math.random().toString(36).slice(2, 9)}`;
    const record = {
      schema: DEV_DIAG_SCHEMA,
      extensionVersion: diagnosticExtensionVersion(),
      id,
      startedAt: now,
      updatedAt: now,
      endedAt: null,
      durationMs: null,
      status: "started",
      stage: "preflight",
      project: diagnosticProjectSnapshot(config),
      input: {
        prompt: String(meta && meta.prompt || ""),
        attachmentCount: Number(meta && meta.attachmentCount || 0),
        attachmentNames: Array.isArray(meta && meta.attachmentNames) ? meta.attachmentNames.slice(0, 20) : []
      },
      agent: {
        provider: String(config.byok_provider || "xkiro"),
        configuredModel: releaseModelFor(config.byok_provider || "xkiro", meta && meta.releaseLevel || config.release_level || "auto", config.byok_custom_model, config.byok_xkiro_model, config.byok_anthropic_model),
        releaseLevel: String(meta && meta.releaseLevel || config.release_level || "auto"),
        changeScope: String(meta && meta.changeScope || config.change_scope || "auto"),
        reasoningEffort: releaseReasoningFor(config.byok_provider || "xkiro", meta && meta.releaseLevel || config.release_level || "basic"),
        consistencyReview: String(config.consistency_review || "smart"),
        strictConsistency: config.strict_consistency !== false,
        autoCommit: config.auto_commit !== false
      },
      environment: {
        userAgent: String(navigator.userAgent || ""),
        language: String(navigator.language || ""),
        urlOrigin: String(location.origin || ""),
        runtimeErrorAtStart: meta && meta.runtimeErrorContext ? diagnosticSanitize(meta.runtimeErrorContext, "runtimeError", 0) : null
      },
      context: {},
      modelCalls: [],
      parsed: {},
      validation: { events: [] },
      git: {},
      preview: {},
      events: [{ ts: now, type: "job_started", stage: "preflight" }],
      error: null
    };
    DEV_DIAG_ACTIVE.set(id, record);
    diagnosticDbPut(record);
    return id;
  }

  function diagnosticUpdateJob(id, patch, eventType, eventData) {
    if (!id) return;
    const rec = DEV_DIAG_ACTIVE.get(id);
    if (!rec) return;
    if (patch && typeof patch === "object") {
      Object.keys(patch).forEach(k => {
        const incoming = patch[k];
        if (incoming && typeof incoming === "object" && !Array.isArray(incoming) && rec[k] && typeof rec[k] === "object" && !Array.isArray(rec[k])) {
          rec[k] = Object.assign({}, rec[k], incoming);
        } else {
          rec[k] = incoming;
        }
      });
    }
    rec.updatedAt = Date.now();
    if (eventType) {
      rec.events = Array.isArray(rec.events) ? rec.events : [];
      rec.events.push({ ts: Date.now(), type: String(eventType), data: diagnosticSanitize(eventData || {}, "event", 0) });
      if (rec.events.length > 300) rec.events = rec.events.slice(-300);
    }
    diagnosticDbPut(rec);
  }

  function diagnosticAddValidation(id, name, ok, detail) {
    if (!id) return;
    const rec = DEV_DIAG_ACTIVE.get(id);
    if (!rec) return;
    rec.validation = rec.validation || { events: [] };
    rec.validation.events = Array.isArray(rec.validation.events) ? rec.validation.events : [];
    rec.validation.events.push({ ts: Date.now(), name: String(name || "validation"), ok: !!ok, detail: diagnosticSanitize(detail || {}, "detail", 0) });
    diagnosticUpdateJob(id, null, "validation", { name, ok: !!ok });
  }

  function diagnosticAddModelCall(id, call) {
    if (!id) return;
    const rec = DEV_DIAG_ACTIVE.get(id);
    if (!rec) return;
    rec.modelCalls = Array.isArray(rec.modelCalls) ? rec.modelCalls : [];
    rec.modelCalls.push(diagnosticSanitize(call || {}, "modelCall", 0));
    diagnosticUpdateJob(id, null, "model_call", { index: rec.modelCalls.length, purpose: call && call.purpose, model: call && (call.modelUsed || call.requestedModel) });
  }

  function diagnosticFinishJob(id, status, patch) {
    if (!id) return;
    const rec = DEV_DIAG_ACTIVE.get(id);
    if (!rec) return;
    const now = Date.now();
    rec.status = String(status || "finished");
    rec.endedAt = now;
    rec.updatedAt = now;
    rec.durationMs = Math.max(0, now - Number(rec.startedAt || now));
    if (patch && typeof patch === "object") {
      const cleanPatch = diagnosticSanitize(patch, "finish", 0);
      Object.keys(cleanPatch).forEach(k => {
        const incoming = cleanPatch[k];
        if (incoming && typeof incoming === "object" && !Array.isArray(incoming) && rec[k] && typeof rec[k] === "object" && !Array.isArray(rec[k])) rec[k] = Object.assign({}, rec[k], incoming);
        else rec[k] = incoming;
      });
    }
    rec.events = Array.isArray(rec.events) ? rec.events : [];
    rec.events.push({ ts: now, type: "job_finished", data: { status: rec.status, durationMs: rec.durationMs } });
    diagnosticDbPut(rec);
    DEV_DIAG_ACTIVE.delete(id);
  }

  async function ensureDiagnosticJSZip() {
    if (window.JSZip) return window.JSZip;
    await new Promise((resolve, reject) => {
      const old = document.getElementById("lovasiri-diagnostics-jszip");
      if (old) {
        let ticks = 0;
        const t = setInterval(() => {
          if (window.JSZip) { clearInterval(t); resolve(); }
          else if (++ticks > 80) { clearInterval(t); reject(new Error("ZIP library did not load")); }
        }, 50);
        return;
      }
      const script = document.createElement("script");
      script.id = "lovasiri-diagnostics-jszip";
      script.src = chrome.runtime.getURL("jszip.min.js");
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Could not load ZIP library"));
      (document.head || document.documentElement).appendChild(script);
    });
    if (!window.JSZip) throw new Error("ZIP library unavailable");
    return window.JSZip;
  }

  function diagnosticFileSafe(value) {
    return String(value || "job").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 90) || "job";
  }

  function diagnosticDownloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { try { a.remove(); URL.revokeObjectURL(url); } catch (_) {} }, 3000);
  }

  function diagnosticJobSummary(job) {
    const copy = JSON.parse(JSON.stringify(job || {}));
    if (copy.context) {
      delete copy.context.exactUserContent;
      delete copy.context.sourceContext;
    }
    if (Array.isArray(copy.modelCalls)) {
      copy.modelCalls = copy.modelCalls.map(c => {
        const x = Object.assign({}, c);
        delete x.systemPrompt;
        delete x.userContent;
        delete x.responseText;
        return x;
      });
    }
    if (copy.parsed && copy.parsed.changes) delete copy.parsed.changes;
    return copy;
  }

  async function exportDeveloperDiagnostics(options) {
    const opts = Object.assign({ allProjects: false }, options || {});
    const config = getGitConfig() || {};
    const currentProjectId = String(getRuntimeLovableProjectId() || "");
    const currentRepo = normalizeGitRepository(config.repository || "");
    let jobs = await diagnosticDbList();
    if (!opts.allProjects) {
      jobs = jobs.filter(r => (currentProjectId && String(r.project && r.project.projectId || "") === currentProjectId) || (currentRepo && normalizeGitRepository(r.project && r.project.repository || "") === currentRepo));
    }
    if (!jobs.length) throw new Error(opts.allProjects ? "No diagnostics have been recorded yet." : "No diagnostics recorded for this project yet.");
    const JSZipCtor = await ensureDiagnosticJSZip();
    const zip = new JSZipCtor();
    const exportedAt = new Date().toISOString();
    const manifest = {
      schema: DEV_DIAG_SCHEMA,
      extensionVersion: diagnosticExtensionVersion(),
      exportedAt,
      scope: opts.allProjects ? "all-projects" : "current-project",
      jobCount: jobs.length,
      note: "Sanitized developer diagnostics. API keys, tokens, authorization headers, cookies and image bytes are redacted. Hidden model chain-of-thought is not recorded; the bundle contains the exact visible prompts/context sent to providers plus their returned output."
    };
    zip.file("diagnostics-manifest.json", JSON.stringify(manifest, null, 2));
    zip.file("README.txt", `LOVABLE AI Developer Diagnostics\n\nExported: ${exportedAt}\nJobs: ${jobs.length}\n\nThis archive is intended for debugging prompt/context/model/patch/validation behavior. Credentials and image bytes are automatically redacted. Hidden chain-of-thought is not available or stored.\n`);
    zip.file("environment.json", JSON.stringify(diagnosticSanitize({
      extensionVersion: diagnosticExtensionVersion(),
      browser: navigator.userAgent,
      language: navigator.language,
      currentProject: diagnosticProjectSnapshot(config),
      selectedProvider: config.byok_provider || "xkiro",
      selectedQuality: config.release_level || "auto",
      selectedChangeScope: config.change_scope || "auto",
      projectMemory: config.project_memory !== false,
      consistencyReview: config.consistency_review || "smart",
      strictConsistency: config.strict_consistency !== false,
      autoCommit: config.auto_commit !== false,
      diagnosticsDeep: diagnosticDeepEnabled(config)
    }, "environment", 0), null, 2));

    jobs.forEach((job, idx) => {
      const stamp = new Date(Number(job.startedAt || Date.now())).toISOString().replace(/[:.]/g, "-");
      const folder = zip.folder(`jobs/${String(idx + 1).padStart(3, "0")}_${stamp}_${diagnosticFileSafe(job.id)}`);
      folder.file("job-summary.json", JSON.stringify(diagnosticJobSummary(job), null, 2));
      folder.file("prompt.txt", String(job.input && job.input.prompt || ""));
      folder.file("events.json", JSON.stringify(job.events || [], null, 2));
      folder.file("validation.json", JSON.stringify(job.validation || {}, null, 2));
      folder.file("git-preview.json", JSON.stringify({ git: job.git || {}, preview: job.preview || {}, error: job.error || null }, null, 2));
      if (job.context && job.context.relevantPaths) folder.file("selected-files.json", JSON.stringify(job.context.relevantPaths, null, 2));
      if (job.context && job.context.exactUserContent) folder.file("model-input.txt", typeof job.context.exactUserContent === "string" ? job.context.exactUserContent : JSON.stringify(job.context.exactUserContent, null, 2));
      if (job.context && job.context.systemPrompt) folder.file("system-prompt.txt", String(job.context.systemPrompt));
      if (job.context && job.context.sourceContext) folder.file("source-context.txt", String(job.context.sourceContext));
      if (job.parsed && job.parsed.changes) folder.file("candidate-changes.json", JSON.stringify(job.parsed.changes, null, 2));
      (job.modelCalls || []).forEach((call, callIndex) => {
        const cf = folder.folder(`model-calls/${String(callIndex + 1).padStart(2, "0")}_${diagnosticFileSafe(call.purpose || "call")}`);
        cf.file("metadata.json", JSON.stringify(Object.fromEntries(Object.entries(call).filter(([k]) => !["systemPrompt", "userContent", "responseText"].includes(k))), null, 2));
        if (call.systemPrompt) cf.file("system-prompt.txt", String(call.systemPrompt));
        if (call.userContent) cf.file("user-content.txt", typeof call.userContent === "string" ? call.userContent : JSON.stringify(call.userContent, null, 2));
        if (call.responseText) cf.file("response.txt", String(call.responseText));
      });
    });

    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
    const scopeName = opts.allProjects ? "all-projects" : diagnosticFileSafe(getLovableProjectName() || currentProjectId || "project");
    const date = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    diagnosticDownloadBlob(blob, `lovable-ai-debug-${scopeName}-${date}.zip`);
    return { count: jobs.length, size: blob.size };
  }

  async function diagnosticStatsForCurrentProject() {
    const config = getGitConfig() || {};
    const currentProjectId = String(getRuntimeLovableProjectId() || "");
    const currentRepo = normalizeGitRepository(config.repository || "");
    const jobs = (await diagnosticDbList()).filter(r => (currentProjectId && String(r.project && r.project.projectId || "") === currentProjectId) || (currentRepo && normalizeGitRepository(r.project && r.project.repository || "") === currentRepo));
    let approx = 0;
    jobs.forEach(j => { try { approx += JSON.stringify(j).length; } catch (_) {} });
    return { count: jobs.length, approxBytes: approx, last: jobs.length ? jobs[jobs.length - 1] : null };
  }

  // Capture page/runtime failures that occur while a recorded job is active.
  // They are observations only; unrelated Lovable UI errors are never treated as proof
  // that the generated code is bad.
  try {
    window.addEventListener("error", function(e) {
      if (!DEV_DIAG_ACTIVE.size) return;
      const message = String(e && e.message || "").trim();
      const filename = String(e && e.filename || "").trim();
      const line = e && e.lineno || null;
      // Lovable/iframes emit many anonymous cross-origin error events with no
      // actionable detail. They made diagnostics noisy without helping repairs.
      if (!message && !filename && !line) return;
      DEV_DIAG_ACTIVE.forEach((_, id) => diagnosticUpdateJob(id, null, "window_error", {
        message: message || "window error",
        filename,
        line,
        column: e && e.colno || null
      }));
    }, true);
    window.addEventListener("unhandledrejection", function(e) {
      if (!DEV_DIAG_ACTIVE.size) return;
      const reason = e && e.reason;
      DEV_DIAG_ACTIVE.forEach((_, id) => diagnosticUpdateJob(id, null, "unhandled_rejection", {
        message: reason && reason.message ? reason.message : String(reason || "unhandled rejection")
      }));
    });
  } catch (_) {}

  function openGitSettings(onSaved) {
    const oldModal = document.getElementById("127hub-git-settings-backdrop");
    if (oldModal) oldModal.remove();

    const config = ensureCurrentProjectGitMapping();
    const currentSettingsProjectId = getRuntimeLovableProjectId();
    const currentSettingsProjectMapping = getProjectGitMapping(rawGitConfig(), currentSettingsProjectId);
    const recoveryJob = getRecoveryJob();
    const foreignRecoveryJobs = getForeignRecoveryJobs();
    const recoveryPromptPreview = recoveryJob && recoveryJob.prompt ? String(recoveryJob.prompt).replace(/\s+/g, " ").trim().slice(0, 180) : "";
    const deviceId = getConsistentDeviceId();
    let currentEngine = "byok";
    let workingXKiroAccounts = normalizeXKiroAccounts(config);
    let workingXKiroActiveId = String(config.xkiro_active_account_id || (workingXKiroAccounts[0] && workingXKiroAccounts[0].id) || "");
    let workingProviderKeys = normalizeProviderKeys(config);
    let workingProvider = String(config.byok_provider || "xkiro").toLowerCase();

    const backdrop = document.createElement("div");
    backdrop.id = "127hub-git-settings-backdrop";
    backdrop.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      z-index: 2147483646;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      animation: hubFadeIn 0.25s ease-out;
    `;

    backdrop.innerHTML = `
      <style>
        @keyframes hubFadeIn {
          from { opacity: 0; transform: scale(0.97); }
          to { opacity: 1; transform: scale(1); }
        }
        .hub-git-card {
          width: 100%;
          max-width: 600px;
          max-height: 90vh;
          overflow-y: auto;
          background: #090d16;
          border: 1px solid rgba(0, 242, 254, 0.32);
          border-radius: 20px;
          padding: 26px 30px;
          color: #f8fafc;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.85), 0 0 35px rgba(0, 242, 254, 0.14);
        }
        .hub-git-title {
          font-size: 19px;
          font-weight: 800;
          color: #f8fafc;
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 4px;
        }
        .hub-git-subtitle {
          font-size: 12.5px;
          color: #94a3b8;
          line-height: 1.5;
          margin-bottom: 18px;
        }
        .hub-git-section-title {
          font-size: 11.5px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          color: #00f2fe;
          border-bottom: 1px solid rgba(0, 242, 254, 0.2);
          padding-bottom: 6px;
          margin: 18px 0 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .hub-git-group {
          margin-bottom: 14px;
        }
        .hub-git-label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: #cbd5e1;
          margin-bottom: 6px;
        }
        .hub-git-input, .hub-git-select {
          width: 100%;
          box-sizing: border-box;
          background: #131b2e;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 9px;
          padding: 10px 13px;
          color: #f8fafc;
          font-size: 13px;
          outline: none;
          transition: border-color 0.2s;
        }
        .hub-git-input:focus, .hub-git-select:focus {
          border-color: #00f2fe;
          box-shadow: 0 0 10px rgba(0, 242, 254, 0.2);
        }
        .hub-git-help {
          font-size: 11.5px;
          color: #64748b;
          margin-top: 5px;
          line-height: 1.4;
        }
        .hub-git-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 24px;
          padding-top: 16px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }
        .hub-git-btn-secondary {
          background: rgba(255, 255, 255, 0.08);
          color: #cbd5e1;
          border: none;
          padding: 10px 18px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }
        .hub-git-btn-primary {
          background: linear-gradient(135deg, #00f2fe, #4facfe);
          color: #041226;
          border: none;
          padding: 10px 22px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 4px 15px rgba(0, 242, 254, 0.3);
        }
        .hub-git-btn-auto {
          background: rgba(0, 242, 254, 0.12);
          color: #38bdf8;
          border: 1px solid rgba(0, 242, 254, 0.35);
          border-radius: 6px;
          padding: 4px 10px;
          font-size: 11.5px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
          transition: all 0.2s;
        }
        .hub-git-btn-auto:hover {
          background: rgba(0, 242, 254, 0.25);
          color: #ffffff;
        }
      </style>
      <div class="hub-git-card">
        <div class="hub-git-title">
          <img src="${LOVABLE_ASSISTANT_LOGO_DATA}" alt="Lovable" style="width:22px;height:22px;border-radius:6px;object-fit:contain;"> LOVABLE AI — BYOK & Git Mode
        </div>
        <div class="hub-git-subtitle">
          Direct GitHub commit & auto-sync engine using your own AI provider (Zero Lovable Credits).
        </div>

        ${recoveryPromptPreview ? `
        <div id="hub-recovery-panel" style="margin:12px 0 4px;padding:12px 13px;border-radius:10px;border:1px solid rgba(245,158,11,.35);background:rgba(245,158,11,.07);">
          <div style="font-size:12px;font-weight:800;color:#fbbf24;">Saved prompt available</div>
          <div style="font-size:11.5px;color:#cbd5e1;margin-top:5px;line-height:1.45;">${escapeHtml(recoveryPromptPreview)}${String(recoveryJob.prompt || "").length > 180 ? "…" : ""}</div>
          <div style="font-size:10.5px;color:#94a3b8;margin-top:4px;">${escapeHtml(recoveryJob.stage || recoveryJob.status || "Interrupted safely")} · Your prompt is preserved.</div>
          ${Number(recoveryJob.attachmentCount || 0) > 0 ? `<div style="font-size:10.5px;color:#fbbf24;margin-top:4px;">This saved job used ${Number(recoveryJob.attachmentCount || 0)} image${Number(recoveryJob.attachmentCount || 0) === 1 ? "" : "s"}. The prompt can be restored automatically; reattach the image${Number(recoveryJob.attachmentCount || 0) === 1 ? "" : "s"} before sending.</div>` : ""}
          <div style="display:flex;gap:7px;margin-top:8px;">
            <button type="button" class="hub-git-btn-auto" id="hub-retry-saved-prompt">↻ Retry Saved Prompt</button>
            <button type="button" class="hub-git-btn-auto" id="hub-clear-saved-prompt" style="color:#cbd5e1;">Clear</button>
          </div>
        </div>` : ""}

        ${!recoveryPromptPreview && foreignRecoveryJobs.length ? `
        <div id="hub-foreign-recovery-panel" style="margin:12px 0 4px;padding:11px 13px;border-radius:10px;border:1px solid rgba(56,189,248,.28);background:rgba(56,189,248,.06);">
          <div style="font-size:12px;font-weight:800;color:#7dd3fc;">Saved prompt belongs to another project</div>
          <div style="font-size:10.8px;color:#cbd5e1;margin-top:5px;line-height:1.45;">${foreignRecoveryJobs.length === 1 ? "One interrupted prompt is saved for a different Lovable project." : `${foreignRecoveryJobs.length} interrupted prompts are saved for other Lovable projects.`} It will never run in this project. Open the original project to resume it.</div>
        </div>` : ""}

        <div class="hub-git-section-title">
          <span>1. GitHub Repository Connection</span>
          <span id="hub-repo-detect-badge" style="font-size: 11px; color: #38bdf8; font-weight: 700;"></span>
        </div>

        <div class="hub-git-group">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <label class="hub-git-label" style="margin-bottom: 0;">GitHub Repository</label>
            <button type="button" class="hub-git-btn-auto" id="hub-git-auto-connect-btn">
              ⚡ Auto Detect & Connect
            </button>
          </div>
          <input type="text" id="hub-git-repo-input" class="hub-git-input" placeholder="e.g. username/my-project" value="${escapeHtml(config.repository || "")}">
          <div class="hub-git-help">The repository connected to this Lovable project. v32.0.2 stores repo + branch separately for every project and verifies the mapping again before every push.</div>
          <div style="margin-top:6px;padding:7px 9px;border-radius:7px;border:1px solid rgba(16,185,129,.2);background:rgba(16,185,129,.05);font-size:10.7px;color:#94a3b8;line-height:1.4;">
            🔒 <b style="color:#a7f3d0;">Project-isolated GitHub:</b> ${currentSettingsProjectId ? `Project <code style="color:#7dd3fc;">${escapeHtml(currentSettingsProjectId.slice(0, 16))}${currentSettingsProjectId.length > 16 ? "…" : ""}</code>` : "Current project ID not detected yet"}${currentSettingsProjectMapping ? ` → <b style="color:#e2e8f0;">${escapeHtml(currentSettingsProjectMapping.repository)}</b>@${escapeHtml(currentSettingsProjectMapping.branch)}` : " · no repository mapping saved yet"}.
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="hub-git-group">
            <label class="hub-git-label">Branch</label>
            <input type="text" id="hub-git-branch-input" class="hub-git-input" placeholder="main" value="${escapeHtml(config.branch || "main")}">
          </div>
          <div class="hub-git-group">
            <label class="hub-git-label">GitHub Token (PAT)</label>
            <input type="password" id="hub-git-token-input" class="hub-git-input" placeholder="ghp_..." value="${escapeHtml(config.github_token || "")}">
          </div>
        </div>
        <div class="hub-git-help" style="margin-top: -6px; margin-bottom: 7px;">
          Personal Access Token with <code>repo</code> scope needed to commit code directly.
        </div>
        <div style="margin-bottom:14px;padding:8px 10px;border-radius:8px;border:1px solid rgba(16,185,129,.22);background:rgba(16,185,129,.06);font-size:10.8px;line-height:1.45;color:#94a3b8;">
          🔐 <b style="color:#a7f3d0;">Reinstall Recovery Vault enabled.</b> GitHub/API credentials are mirrored to two recovery stores on this Lovable browser profile and restored automatically after reinstall. Clearing Lovable site data or using a different Chrome profile removes that recovery copy.
        </div>

        <div class="hub-git-section-title">
          <span>2. AI Provider Configuration (BYOK)</span>
          <span style="font-size: 11px; color: #10b981; font-weight: 700;">● User API Key</span>
        </div>

        <div style="background: rgba(147, 51, 234, 0.06); border: 1px solid rgba(147, 51, 234, 0.25); border-radius: 12px; padding: 14px; margin-bottom: 14px;">
          <div class="hub-git-group">
            <label class="hub-git-label">AI Provider</label>
            <select id="hub-byok-provider" class="hub-git-select">
              <option value="xkiro" ${config.byok_provider === 'xkiro' || !config.byok_provider ? 'selected' : ''}>xKiro (Free Models)</option>
              <option value="atria" ${config.byok_provider === 'atria' ? 'selected' : ''}>Atria (Dawn Preview)</option>
              <option value="google" ${config.byok_provider === 'google' ? 'selected' : ''}>Google AI Studio (Gemini 2.5 Flash / Pro)</option>
              <option value="deepseek" ${config.byok_provider === 'deepseek' ? 'selected' : ''}>DeepSeek (Flash / V4 Pro)</option>
              <option value="groq" ${config.byok_provider === 'groq' ? 'selected' : ''}>Groq (GPT-OSS 120B)</option>
              <option value="openrouter" ${config.byok_provider === 'openrouter' ? 'selected' : ''}>OpenRouter (Auto Router)</option>
              <option value="anyapi" ${config.byok_provider === 'anyapi' ? 'selected' : ''}>AnyAPI — NVIDIA Nemotron 3 Ultra (Free)</option>
              <option value="openai" ${config.byok_provider === 'openai' ? 'selected' : ''}>OpenAI (GPT-4o mini / GPT-5.6)</option>
              <option value="anthropic" ${config.byok_provider === 'anthropic' ? 'selected' : ''}>Anthropic (Claude — Auto Current Models)</option>
              <option value="mistral" ${config.byok_provider === 'mistral' ? 'selected' : ''}>Mistral AI (Mistral / Codestral)</option>
              <option value="xai" ${config.byok_provider === 'xai' ? 'selected' : ''}>xAI (Grok)</option>
              <option value="together" ${config.byok_provider === 'together' ? 'selected' : ''}>Together AI (Llama 3.3)</option>
              <option value="custom" ${config.byok_provider === 'custom' ? 'selected' : ''}>Custom / 3rd-Party (OpenAI-Compatible / Ollama / Proxy)</option>
            </select>
          </div>

          <div id="hub-anyapi-info" class="hub-git-group" style="display:${config.byok_provider === 'anyapi' ? 'block' : 'none'};">
            <label class="hub-git-label">Nemotron 3 Ultra — AnyAPI</label>
            <div class="hub-git-help" style="overflow-wrap:anywhere;">
              Model: <code>nvidia/nemotron-3-ultra-550b-a55b:free</code><br>
              Endpoint: <code>https://api.anyapi.ai/v1/chat/completions</code><br>
              Enter your own AnyAPI key below, then use Test Connection. Provider availability and free-tier limits may vary.
            </div>
          </div>

          <div id="hub-byok-key-group" class="hub-git-group" style="display:${config.byok_provider === 'xkiro' || !config.byok_provider ? 'none' : 'block'};">
            <label class="hub-git-label">API Key</label>
            <input type="password" id="hub-byok-key" class="hub-git-input" placeholder="Paste your API key" value="${escapeHtml((config.byok_provider === 'xkiro' ? '' : (workingProviderKeys[String(config.byok_provider || '').toLowerCase()] || config.byok_key || '')))}">
            <div class="hub-git-help">Saved in extension storage so you normally enter it only once.</div>
          </div>

          <div id="hub-anthropic-workspace-wrap" class="hub-git-group" style="display:${config.byok_provider === 'anthropic' ? 'block' : 'none'};">
            <label class="hub-git-label">Anthropic Workspace ID <span style="font-weight:500;color:#64748b;">(only for multi-workspace keys)</span></label>
            <input type="text" id="hub-anthropic-workspace-id" class="hub-git-input" placeholder="wrkspc_..." value="${escapeHtml(config.byok_anthropic_workspace_id || '')}">
            <div class="hub-git-help">Leave blank for a workspace-scoped key. If Anthropic says a workspace is required, copy the wrkspc_... ID from Claude Console → Settings → Workspaces.</div>
          </div>

          <div id="hub-anthropic-model-wrap" class="hub-git-group" style="display:${config.byok_provider === 'anthropic' ? 'block' : 'none'};">
            <label class="hub-git-label">Anthropic Model</label>
            <div style="display:flex;gap:8px;align-items:center;">
              <select id="hub-anthropic-model" class="hub-git-select" style="flex:1;">
                <option value="auto" ${!config.byok_anthropic_model || config.byok_anthropic_model === 'auto' ? 'selected' : ''}>Auto — current Claude model</option>
                ${config.byok_anthropic_model && config.byok_anthropic_model !== 'auto' ? `<option value="${escapeHtml(config.byok_anthropic_model)}" selected>${escapeHtml(config.byok_anthropic_model)} (saved)</option>` : ''}
              </select>
              <button type="button" class="hub-git-btn-auto" id="hub-anthropic-refresh-models" style="padding:8px 10px;white-space:nowrap;">↻ Refresh</button>
            </div>
            <div id="hub-anthropic-model-status" class="hub-git-help" style="margin-top:6px;">Loads the models currently available to this Anthropic key/workspace. Retired saved model IDs are replaced automatically.</div>
          </div>

          <div id="hub-xkiro-accounts-wrap" class="hub-git-group" style="display:${config.byok_provider === 'xkiro' || !config.byok_provider ? 'block' : 'none'};">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;">
              <label class="hub-git-label" style="margin:0;">xKiro Accounts</label>
              <button type="button" class="hub-git-btn-auto" id="hub-xkiro-refresh-usage" style="padding:6px 10px;">↻ Allowance</button>
            </div>
            <div id="hub-xkiro-accounts-list" style="display:flex;flex-direction:column;gap:8px;"></div>
            <div style="display:flex;gap:8px;margin-top:10px;">
              <input type="password" id="hub-xkiro-add-key" class="hub-git-input" placeholder="sk-xt-..." style="flex:1;">
              <button type="button" class="hub-git-btn-auto" id="hub-xkiro-add-account" style="padding:8px 12px;white-space:nowrap;">+ Add API Key</button>
            </div>
            <div id="hub-xkiro-account-status" class="hub-git-help" style="margin-top:6px;">Keys are remembered. When one allowance is exhausted, select another saved account; your prompt remains safe.</div>
          </div>

          <div id="hub-xkiro-model-wrap" class="hub-git-group" style="display:${config.byok_provider === 'xkiro' || !config.byok_provider ? 'block' : 'none'};">
            <label class="hub-git-label">xKiro Free Model</label>
            <div style="display:flex;gap:8px;align-items:center;">
              <select id="hub-xkiro-model" class="hub-git-select" style="flex:1;">
                <option value="auto" ${(config.byok_xkiro_model || 'auto') === 'auto' ? 'selected' : ''}>Auto — best available free model</option>
              </select>
              <button type="button" class="hub-git-btn-auto" id="hub-xkiro-refresh-models" style="padding:8px 10px;white-space:nowrap;">↻ Refresh</button>
            </div>
            <div id="hub-xkiro-model-status" class="hub-git-help" style="margin-top:6px;">Loads the current free-model catalog from xKiro.</div>
          </div>

          <div class="hub-git-group">
            <label class="hub-git-label">Output Quality</label>
            <select id="hub-release-level" class="hub-git-select">
              <option value="auto" ${(config.release_level || 'auto') === 'auto' ? 'selected' : ''}>Auto — adapt quality to each prompt</option>
              <option value="basic" ${config.release_level === 'basic' ? 'selected' : ''}>Basic — fast, simple edits</option>
              <option value="medium" ${config.release_level === 'medium' ? 'selected' : ''}>Medium — normal website work</option>
              <option value="super" ${config.release_level === 'super' ? 'selected' : ''}>Super — maximum context / harder changes</option>
            </select>
            <div id="hub-release-level-desc" class="hub-git-help" style="margin-top:6px;"></div>
          </div>

          <div id="hub-custom-provider-wrap" style="display:${config.byok_provider === 'custom' ? 'block' : 'none'};">
            <div class="hub-git-group">
              <label class="hub-git-label">Custom API Base URL</label>
              <input type="text" id="hub-custom-api-base" class="hub-git-input" placeholder="https://api.example.com/v1" value="${escapeHtml(config.byok_api_base || '')}">
              <div class="hub-git-help">OpenAI-compatible Chat Completions endpoint/base URL.</div>
            </div>
            <div class="hub-git-group">
              <label class="hub-git-label">Custom Model</label>
              <input type="text" id="hub-custom-model" class="hub-git-input" placeholder="your-model-id" value="${escapeHtml(config.byok_custom_model || '')}">
            </div>
          </div>

          <div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;">
            <button type="button" class="hub-git-btn-auto" id="hub-byok-test-btn" style="padding:6px 14px;">🧪 Test Connection</button>
            <span id="hub-byok-test-result" style="font-size:11px;font-weight:700;"></span>
          </div>
        </div>

        <div class="hub-git-section-title" style="margin-top:16px;">
          <span>3. Super Agent Options</span>
          <span style="font-size:11px;color:#a7f3d0;font-weight:700;">Project-aware</span>
        </div>
        <div style="background:rgba(14,165,233,.055);border:1px solid rgba(56,189,248,.2);border-radius:12px;padding:14px;margin-bottom:14px;">
          <div class="hub-git-group">
            <label class="hub-git-label">Change Scope</label>
            <select id="hub-change-scope" class="hub-git-select">
              <option value="auto" ${(config.change_scope || 'auto') === 'auto' ? 'selected' : ''}>Auto — understand intent</option>
              <option value="content" ${config.change_scope === 'content' ? 'selected' : ''}>Content only — text/copy, no redesign</option>
              <option value="style" ${config.change_scope === 'style' ? 'selected' : ''}>Style/UI only — preserve logic/data</option>
              <option value="image" ${config.change_scope === 'image' ? 'selected' : ''}>Images only — preserve layout/data</option>
              <option value="data" ${config.change_scope === 'data' ? 'selected' : ''}>Data only — preserve component structure</option>
              <option value="bugfix" ${config.change_scope === 'bugfix' ? 'selected' : ''}>Bug fix only — smallest repair</option>
              <option value="feature" ${config.change_scope === 'feature' ? 'selected' : ''}>Feature change</option>
              <option value="architecture" ${config.change_scope === 'architecture' ? 'selected' : ''}>Architecture / refactor</option>
              <option value="full" ${config.change_scope === 'full' ? 'selected' : ''}>Full redesign allowed</option>
            </select>
            <div class="hub-git-help">Auto prevents a small content/image request from accidentally redesigning unrelated parts of the project.</div>
          </div>

          <div style="display:flex;align-items:flex-start;gap:9px;margin:10px 0 12px;">
            <input type="checkbox" id="hub-project-memory" ${config.project_memory !== false ? 'checked' : ''} style="margin-top:2px;accent-color:#00f2fe;">
            <label for="hub-project-memory" style="font-size:12px;color:#cbd5e1;line-height:1.45;cursor:pointer;"><b>Project Contract Memory</b> — remember durable rules such as “every product has a working detail page” and apply them to future prompts.</label>
          </div>
          <div class="hub-git-group">
            <label class="hub-git-label">Project Contract (this repository)</label>
            <textarea id="hub-project-contract" class="hub-git-input" rows="5" placeholder="Example: Every displayed product must be clickable and resolve to a working detail page.
Use one shared product data source.
Preserve validated working images.">${escapeHtml(getProjectContract(config, config.repository || ''))}</textarea>
            <div class="hub-git-help">One rule per line. The assistant can also learn clear persistent requirements from successful prompts.</div>
          </div>

          <div class="hub-git-group">
            <label class="hub-git-label">Consistency Review</label>
            <select id="hub-consistency-review" class="hub-git-select">
              <option value="smart" ${(config.consistency_review || 'smart') === 'smart' ? 'selected' : ''}>Smart — local checks only (recommended, no extra AI call)</option>
              <option value="always" ${config.consistency_review === 'always' ? 'selected' : ''}>Always — strongest, uses more API tokens</option>
              <option value="off" ${config.consistency_review === 'off' ? 'selected' : ''}>Off — fastest / lowest token usage</option>
            </select>
            <div class="hub-git-help">Smart uses free deterministic checks only. “Always” adds one advisory AI review but never replaces otherwise valid code automatically.</div>
          </div>

          <div style="display:flex;align-items:flex-start;gap:9px;margin-top:10px;">
            <input type="checkbox" id="hub-strict-consistency" ${config.strict_consistency !== false ? 'checked' : ''} style="margin-top:2px;accent-color:#00f2fe;">
            <label for="hub-strict-consistency" style="font-size:12px;color:#cbd5e1;line-height:1.45;cursor:pointer;"><b>Strict local import & relationship safety</b> — block commits with missing local imports or known project-invariant violations.</label>
          </div>
        </div>

        <div class="hub-git-section-title" style="margin-top:20px;">
          <span>4. Developer Diagnostics</span>
          <span id="hub-diag-status" style="font-size:10.8px;color:#10b981;font-weight:700;">Recording</span>
        </div>
        <div style="background:rgba(56,189,248,.05);border:1px solid rgba(56,189,248,.22);border-radius:12px;padding:13px 14px;margin-bottom:14px;">
          <div style="display:flex;align-items:flex-start;gap:9px;">
            <input type="checkbox" id="hub-dev-diagnostics" ${config.dev_diagnostics !== false ? 'checked' : ''} style="margin-top:2px;accent-color:#00f2fe;">
            <label for="hub-dev-diagnostics" style="font-size:12px;color:#cbd5e1;line-height:1.45;cursor:pointer;"><b>Record every AI job</b> — prompt, selected model, model fallbacks, selected project files, AI response, generated changes, validation/repair events, Git commit, preview status and timings.</label>
          </div>
          <div style="display:flex;align-items:flex-start;gap:9px;margin-top:9px;">
            <input type="checkbox" id="hub-dev-diagnostics-deep" ${config.dev_diagnostics_deep !== false ? 'checked' : ''} style="margin-top:2px;accent-color:#00f2fe;">
            <label for="hub-dev-diagnostics-deep" style="font-size:12px;color:#cbd5e1;line-height:1.45;cursor:pointer;"><b>Deep diagnostics</b> — also keep the exact text/source context sent to the AI. API keys/tokens/cookies and image bytes are always redacted.</label>
          </div>
          <div id="hub-diag-stats" style="font-size:10.8px;color:#94a3b8;margin-top:10px;line-height:1.45;">Loading diagnostic history…</div>
          <div style="display:flex;flex-wrap:wrap;gap:7px;margin-top:10px;">
            <button type="button" class="hub-git-btn-auto" id="hub-diag-export-project">⬇ Export Current Project</button>
            <button type="button" class="hub-git-btn-auto" id="hub-diag-export-all">⬇ Export All Projects</button>
            <button type="button" class="hub-git-btn-auto" id="hub-diag-clear-project" style="color:#fbbf24;border-color:rgba(245,158,11,.35);">Clear Current Project Logs</button>
          </div>
          <div class="hub-git-help" style="margin-top:8px;">Export whenever you want — after 1 prompt, 10 prompts, or 100 prompts. The ZIP is designed for development/debugging and contains no full API keys or GitHub tokens.</div>
        </div>

        <div style="display:none;">
          <input type="checkbox" id="hub-cost-saver" checked>
          <input type="number" id="hub-max-prompt-chars" value="5000">
          <input type="number" id="hub-max-output-tokens" value="2200">
          <input type="number" id="hub-max-context-files" value="5">
          <input type="number" id="hub-max-context-chars" value="18000">
          <input type="number" id="hub-credit-value-usd" value="0.01">
        </div>

        <div style="margin-top: 14px; padding: 10px 14px; background: rgba(0, 242, 254, 0.06); border: 1px solid rgba(0, 242, 254, 0.22); border-radius: 8px; display: flex; align-items: center; gap: 10px;">
          <input type="checkbox" id="hub-git-auto-commit" ${config.auto_commit !== false ? 'checked' : ''} style="cursor: pointer; width: 16px; height: 16px; accent-color: #00f2fe;">
          <label for="hub-git-auto-commit" style="font-size: 12.5px; color: #cbd5e1; cursor: pointer; user-select: none;">
            ⚡ <strong>Auto-Commit & Push to GitHub</strong> (Automatically pushes code to repo — zero extra clicks)
          </label>
        </div>

        <div class="hub-git-actions">
          <button type="button" class="hub-git-btn-secondary" id="hub-git-cancel">Cancel</button>
          <button type="button" class="hub-git-btn-primary" id="hub-git-save">Save Settings</button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);

    const cancelBtn = backdrop.querySelector("#hub-git-cancel");
    const saveBtn = backdrop.querySelector("#hub-git-save");
    const autoConnectBtn = backdrop.querySelector("#hub-git-auto-connect-btn");
    const testByokBtn = backdrop.querySelector("#hub-byok-test-btn");
    const repoInput = backdrop.querySelector("#hub-git-repo-input");
    const branchInput = backdrop.querySelector("#hub-git-branch-input");
    const tokenInput = backdrop.querySelector("#hub-git-token-input");
    const byokProvider = backdrop.querySelector("#hub-byok-provider");
    const anyApiInfo = backdrop.querySelector("#hub-anyapi-info");
    const byokKey = backdrop.querySelector("#hub-byok-key");
    const byokKeyGroup = backdrop.querySelector("#hub-byok-key-group");
    const anthropicWorkspaceWrap = backdrop.querySelector("#hub-anthropic-workspace-wrap");
    const anthropicWorkspaceId = backdrop.querySelector("#hub-anthropic-workspace-id");
    const anthropicModelWrap = backdrop.querySelector("#hub-anthropic-model-wrap");
    const anthropicModel = backdrop.querySelector("#hub-anthropic-model");
    const anthropicRefreshModels = backdrop.querySelector("#hub-anthropic-refresh-models");
    const anthropicModelStatus = backdrop.querySelector("#hub-anthropic-model-status");
    const xkiroAccountsWrap = backdrop.querySelector("#hub-xkiro-accounts-wrap");
    const xkiroAccountsList = backdrop.querySelector("#hub-xkiro-accounts-list");
    const xkiroAddKey = backdrop.querySelector("#hub-xkiro-add-key");
    const xkiroAddAccount = backdrop.querySelector("#hub-xkiro-add-account");
    const xkiroRefreshUsage = backdrop.querySelector("#hub-xkiro-refresh-usage");
    const xkiroAccountStatus = backdrop.querySelector("#hub-xkiro-account-status");
    const xkiroModelWrap = backdrop.querySelector("#hub-xkiro-model-wrap");
    const xkiroModel = backdrop.querySelector("#hub-xkiro-model");
    const xkiroRefreshModels = backdrop.querySelector("#hub-xkiro-refresh-models");
    const xkiroModelStatus = backdrop.querySelector("#hub-xkiro-model-status");
    const releaseLevel = backdrop.querySelector("#hub-release-level");
    const releaseLevelDesc = backdrop.querySelector("#hub-release-level-desc");
    const changeScopeInput = backdrop.querySelector("#hub-change-scope");
    const projectMemoryInput = backdrop.querySelector("#hub-project-memory");
    const projectContractInput = backdrop.querySelector("#hub-project-contract");
    const consistencyReviewInput = backdrop.querySelector("#hub-consistency-review");
    const strictConsistencyInput = backdrop.querySelector("#hub-strict-consistency");
    const customWrap = backdrop.querySelector("#hub-custom-provider-wrap");
    const customApiBase = backdrop.querySelector("#hub-custom-api-base");
    const customModel = backdrop.querySelector("#hub-custom-model");
    const byokTestResult = backdrop.querySelector("#hub-byok-test-result");
    const repoBadge = backdrop.querySelector("#hub-repo-detect-badge");
    const autoCommitInput = backdrop.querySelector("#hub-git-auto-commit");
    const costSaverInput = backdrop.querySelector("#hub-cost-saver");
    const maxPromptCharsInput = backdrop.querySelector("#hub-max-prompt-chars");
    const maxOutputTokensInput = backdrop.querySelector("#hub-max-output-tokens");
    const maxContextFilesInput = backdrop.querySelector("#hub-max-context-files");
    const maxContextCharsInput = backdrop.querySelector("#hub-max-context-chars");
    const creditValueUsdInput = backdrop.querySelector("#hub-credit-value-usd");
    const retrySavedPromptBtn = backdrop.querySelector("#hub-retry-saved-prompt");
    const clearSavedPromptBtn = backdrop.querySelector("#hub-clear-saved-prompt");
    const devDiagnosticsInput = backdrop.querySelector("#hub-dev-diagnostics");
    const devDiagnosticsDeepInput = backdrop.querySelector("#hub-dev-diagnostics-deep");
    const diagStatus = backdrop.querySelector("#hub-diag-status");
    const diagStats = backdrop.querySelector("#hub-diag-stats");
    const diagExportProject = backdrop.querySelector("#hub-diag-export-project");
    const diagExportAll = backdrop.querySelector("#hub-diag-export-all");
    const diagClearProject = backdrop.querySelector("#hub-diag-clear-project");

    const refreshDiagnosticStatsUi = async () => {
      try {
        const stats = await diagnosticStatsForCurrentProject();
        const mb = stats.approxBytes >= 1024 * 1024 ? (stats.approxBytes / (1024 * 1024)).toFixed(2) + " MB" : Math.max(0, Math.round(stats.approxBytes / 1024)) + " KB";
        if (diagStats) diagStats.textContent = `${stats.count} recorded job${stats.count === 1 ? "" : "s"} for this project · approx. ${mb}${stats.last ? ` · last: ${new Date(Number(stats.last.startedAt || 0)).toLocaleString()}` : ""}`;
        if (diagStatus) {
          diagStatus.textContent = devDiagnosticsInput && devDiagnosticsInput.checked ? "● Recording" : "Paused";
          diagStatus.style.color = devDiagnosticsInput && devDiagnosticsInput.checked ? "#10b981" : "#94a3b8";
        }
      } catch (_) {}
    };
    refreshDiagnosticStatsUi();
    if (devDiagnosticsInput) devDiagnosticsInput.onchange = refreshDiagnosticStatsUi;

    if (diagExportProject) diagExportProject.onclick = async () => {
      diagExportProject.disabled = true;
      const old = diagExportProject.textContent;
      diagExportProject.textContent = "⏳ Building ZIP…";
      try {
        const out = await exportDeveloperDiagnostics({ allProjects: false });
        showGitToast(`✓ Exported ${out.count} diagnostic job${out.count === 1 ? "" : "s"}`, "success", 5000);
      } catch (err) {
        showGitToast("Diagnostics export: " + (err && err.message || err), "error", 7000);
      } finally {
        diagExportProject.disabled = false;
        diagExportProject.textContent = old;
      }
    };
    if (diagExportAll) diagExportAll.onclick = async () => {
      diagExportAll.disabled = true;
      const old = diagExportAll.textContent;
      diagExportAll.textContent = "⏳ Building ZIP…";
      try {
        const out = await exportDeveloperDiagnostics({ allProjects: true });
        showGitToast(`✓ Exported ${out.count} diagnostic job${out.count === 1 ? "" : "s"} across projects`, "success", 5000);
      } catch (err) {
        showGitToast("Diagnostics export: " + (err && err.message || err), "error", 7000);
      } finally {
        diagExportAll.disabled = false;
        diagExportAll.textContent = old;
      }
    };
    if (diagClearProject) diagClearProject.onclick = async () => {
      const ok = window.confirm("Clear diagnostic logs for only this Lovable project? This does not affect project code, API keys, prompts or Git history.");
      if (!ok) return;
      const count = await diagnosticDbClear(true);
      showGitToast(`Cleared ${count} diagnostic job${count === 1 ? "" : "s"} for this project`, "info", 4500);
      refreshDiagnosticStatsUi();
    };

    if (retrySavedPromptBtn && recoveryJob && recoveryJob.prompt) {
      if (Number(recoveryJob.attachmentCount || 0) > 0) retrySavedPromptBtn.textContent = "↻ Restore Prompt (reattach image)";
      retrySavedPromptBtn.onclick = () => {
        const liveJob = getRecoveryJob();
        if (!liveJob || !liveJob.prompt || (recoveryJob.jobId && liveJob.jobId !== recoveryJob.jobId)) {
          showGitToast("This saved prompt belongs to another project. Open its original project to resume it.", "info", 6500);
          return;
        }
        const savedPrompt = String(liveJob.prompt || "");
        const hadImages = Number(liveJob.attachmentCount || 0) > 0;
        backdrop.remove();
        if (!savedPrompt) return;
        if (!hadImages) {
          previewAndConfirm(savedPrompt, []);
          return;
        }
        try {
          const doc = (window.top && window.top.document) || document;
          const field = doc.querySelector('form#chat-input textarea, form#chat-input [contenteditable="true"], textarea[placeholder*="follow-up" i], [contenteditable="true"][data-placeholder]');
          if (field) {
            if ("value" in field) field.value = savedPrompt;
            else field.textContent = savedPrompt;
            field.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: savedPrompt }));
            try { field.focus(); } catch (_) {}
            showGitToast("Saved prompt restored. Reattach the image(s), then press Send — you do not need to retype the prompt.", "info", 7000);
            return;
          }
        } catch (_) {}
        showGitToast("Your saved prompt is still safe. Reattach the image(s) before retrying this visual request.", "info", 7000);
      };
    }
    if (clearSavedPromptBtn) {
      clearSavedPromptBtn.onclick = () => {
        clearRecoveryJob();
        const panel = backdrop.querySelector("#hub-recovery-panel");
        if (panel) panel.remove();
        showGitToast("Saved prompt cleared.", "success");
      };
    }

    function updateReleaseProviderUi() {
      const provider = byokProvider.value || "xkiro";
      const selectedLevel = (releaseLevel && releaseLevel.value) || "auto";
      const level = selectedLevel === "auto" ? "medium" : selectedLevel;
      const profile = releaseLevelProfile(level);
      const model = releaseModelFor(provider, level, customModel && customModel.value, xkiroModel && xkiroModel.value, anthropicModel && anthropicModel.value);
      if (customWrap) customWrap.style.display = provider === "custom" ? "block" : "none";
      if (anyApiInfo) anyApiInfo.style.display = provider === "anyapi" ? "block" : "none";
      if (byokKeyGroup) byokKeyGroup.style.display = provider === "xkiro" ? "none" : "block";
      if (anthropicWorkspaceWrap) anthropicWorkspaceWrap.style.display = provider === "anthropic" ? "block" : "none";
      if (anthropicModelWrap) anthropicModelWrap.style.display = provider === "anthropic" ? "block" : "none";
      if (xkiroAccountsWrap) xkiroAccountsWrap.style.display = provider === "xkiro" ? "block" : "none";
      if (xkiroModelWrap) xkiroModelWrap.style.display = provider === "xkiro" ? "block" : "none";
      const placeholders = {
        xkiro: "xKiro API key",
        atria: "atr_...",
        google: "Google AI API key",
        deepseek: "DeepSeek API key",
        groq: "gsk_...",
        openrouter: "sk-or-...",
        anyapi: "Enter your AnyAPI API key",
        openai: "sk-...",
        anthropic: "sk-ant-...",
        mistral: "Mistral API key",
        xai: "xAI API key",
        together: "Together API key",
        custom: "Your API key"
      };
      byokKey.placeholder = placeholders[provider] || "Your API key";
      if (releaseLevelDesc) {
        const modelDisplay = releaseModelDisplay(provider, model);
        releaseLevelDesc.textContent = `${selectedLevel === "auto" ? "Auto (Basic → Super as needed)" : profile.label}: ${releaseProviderLabel(provider)}${modelDisplay ? " · " + modelDisplay : ""}`;
      }
      const maxPrompt = backdrop.querySelector("#hub-max-prompt-chars");
      const maxOut = backdrop.querySelector("#hub-max-output-tokens");
      const maxFiles = backdrop.querySelector("#hub-max-context-files");
      const maxChars = backdrop.querySelector("#hub-max-context-chars");
      if (maxPrompt) maxPrompt.value = profile.maxPromptChars;
      if (maxOut) maxOut.value = profile.maxOutputTokens;
      if (maxFiles) maxFiles.value = profile.maxContextFiles;
      if (maxChars) maxChars.value = profile.maxContextChars;
    }

    const xkiroUsageCache = new Map();

    function currentXKiroAccount() {
      return workingXKiroAccounts.find(a => a.id === workingXKiroActiveId) || workingXKiroAccounts[0] || null;
    }

    function renderXKiroAccounts() {
      if (!xkiroAccountsList) return;
      xkiroAccountsList.textContent = "";
      if (!workingXKiroAccounts.length) {
        const empty = document.createElement("div");
        empty.className = "hub-git-help";
        empty.textContent = "No xKiro key saved yet. Add your first API key below.";
        xkiroAccountsList.appendChild(empty);
        return;
      }
      workingXKiroAccounts.forEach((account, index) => {
        const active = account.id === workingXKiroActiveId;
        const usage = xkiroUsageCache.get(account.id);
        const card = document.createElement("div");
        card.style.cssText = `padding:10px 11px;border-radius:10px;border:1px solid ${active ? "rgba(16,185,129,.55)" : "rgba(148,163,184,.2)"};background:${active ? "rgba(16,185,129,.07)" : "rgba(15,23,42,.55)"};`;

        const top = document.createElement("div");
        top.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:8px;";
        const title = document.createElement("strong");
        title.style.cssText = "font-size:12px;color:#f8fafc;";
        title.textContent = account.label || (index === 0 ? "Primary" : index === 1 ? "Secondary" : `Account ${index + 1}`);
        top.appendChild(title);
        const badge = document.createElement("span");
        badge.style.cssText = `font-size:10px;font-weight:800;color:${active ? "#10b981" : "#94a3b8"};`;
        badge.textContent = active ? "✓ Active" : "✓ Ready";
        top.appendChild(badge);
        card.appendChild(top);

        const keyLine = document.createElement("div");
        keyLine.style.cssText = "font:11px ui-monospace,SFMono-Regular,Menlo,monospace;color:#cbd5e1;margin-top:5px;";
        keyLine.textContent = maskApiKey(account.apiKey);
        card.appendChild(keyLine);

        if (account.email || account.name) {
          const identity = document.createElement("div");
          identity.style.cssText = "font-size:10.5px;color:#64748b;margin-top:3px;";
          identity.textContent = account.email || account.name;
          card.appendChild(identity);
        }

        const allowance = document.createElement("div");
        allowance.style.cssText = "font-size:11px;color:#94a3b8;margin-top:4px;";
        if (usage && usage.ok && usage.free_tokens) {
          const free = usage.free_tokens;
          if (free.limit_per_day == null) allowance.textContent = "Free allowance: no daily cap reported";
          else if (Number(free.remaining) <= 0) allowance.textContent = `Free allowance: 0 / ${compactTokenCount(free.limit_per_day)} remaining · Exhausted — your work and prompt are safe. Daily reset: 00:00 UTC.`;
          else allowance.textContent = `Free allowance: ${compactTokenCount(free.remaining)} / ${compactTokenCount(free.limit_per_day)} remaining`;
          if (Number(free.remaining) <= 0 && free.limit_per_day != null) allowance.style.color = "#f59e0b";
        } else if (usage && usage.error) {
          allowance.textContent = usage.error;
          allowance.style.color = "#ef4444";
        } else {
          allowance.textContent = "Free allowance: checking…";
        }
        card.appendChild(allowance);

        const actions = document.createElement("div");
        actions.style.cssText = "display:flex;gap:7px;margin-top:7px;";
        if (!active) {
          const use = document.createElement("button");
          use.type = "button"; use.className = "hub-git-btn-auto"; use.style.cssText = "padding:4px 8px;font-size:10px;"; use.textContent = "Use this key";
          use.onclick = () => { workingXKiroActiveId = account.id; renderXKiroAccounts(); };
          actions.appendChild(use);
        }
        if (workingXKiroAccounts.length > 1) {
          const remove = document.createElement("button");
          remove.type = "button"; remove.className = "hub-git-btn-auto"; remove.style.cssText = "padding:4px 8px;font-size:10px;color:#fca5a5;"; remove.textContent = "Remove";
          remove.onclick = () => {
            workingXKiroAccounts = workingXKiroAccounts.filter(a => a.id !== account.id);
            xkiroUsageCache.delete(account.id);
            if (workingXKiroActiveId === account.id) workingXKiroActiveId = (workingXKiroAccounts[0] && workingXKiroAccounts[0].id) || "";
            renderXKiroAccounts();
          };
          actions.appendChild(remove);
        }
        if (actions.childNodes.length) card.appendChild(actions);
        xkiroAccountsList.appendChild(card);
      });
    }

    async function refreshXKiroUsage(showStatus) {
      if (!workingXKiroAccounts.length) { renderXKiroAccounts(); return; }
      if (xkiroRefreshUsage) xkiroRefreshUsage.disabled = true;
      if (showStatus && xkiroAccountStatus) { xkiroAccountStatus.textContent = "Checking xKiro allowance…"; xkiroAccountStatus.style.color = "#38bdf8"; }
      await Promise.all(workingXKiroAccounts.map(async account => {
        try {
          const usage = await callBackground({ action: "bundlee_git_lovable_xkiro_usage", apiKey: account.apiKey });
          xkiroUsageCache.set(account.id, usage || { ok: false, error: "Allowance unavailable" });
          if (usage && usage.user) { account.email = String(usage.user.email || account.email || ""); account.name = String(usage.user.name || account.name || ""); }
        } catch (err) {
          xkiroUsageCache.set(account.id, { ok: false, error: sanitizeProviderUiError(err && err.message ? err.message : String(err)) });
        }
      }));
      renderXKiroAccounts();
      if (showStatus && xkiroAccountStatus) { xkiroAccountStatus.textContent = "Allowance updated. xKiro usage checks are free and do not consume tokens."; xkiroAccountStatus.style.color = "#10b981"; }
      if (xkiroRefreshUsage) xkiroRefreshUsage.disabled = false;
    }

    if (xkiroAddAccount) xkiroAddAccount.onclick = async () => {
      const key = String(xkiroAddKey && xkiroAddKey.value || "").trim();
      if (!key) { if (xkiroAccountStatus) { xkiroAccountStatus.textContent = "Enter an xKiro API key first."; xkiroAccountStatus.style.color = "#ef4444"; } return; }
      if (workingXKiroAccounts.some(a => a.apiKey === key)) { if (xkiroAccountStatus) xkiroAccountStatus.textContent = "That xKiro key is already saved."; return; }
      xkiroAddAccount.disabled = true;
      try {
        const usage = await callBackground({ action: "bundlee_git_lovable_xkiro_usage", apiKey: key });
        const index = workingXKiroAccounts.length;
        const account = {
          id: "xk_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
          label: index === 0 ? "Primary" : index === 1 ? "Secondary" : `Account ${index + 1}`,
          apiKey: key,
          email: String(usage && usage.user && usage.user.email || ""),
          name: String(usage && usage.user && usage.user.name || "")
        };
        const sameAccount = account.email && workingXKiroAccounts.some(existing => existing.email && String(existing.email).toLowerCase() === String(account.email).toLowerCase());
        workingXKiroAccounts.push(account);
        xkiroUsageCache.set(account.id, usage);
        if (!workingXKiroActiveId) workingXKiroActiveId = account.id;
        if (xkiroAddKey) xkiroAddKey.value = "";
        renderXKiroAccounts();
        if (xkiroAccountStatus) {
          xkiroAccountStatus.textContent = sameAccount
            ? `${account.label} added. Note: this key belongs to the same xKiro account as another saved key, so both keys share the same free allowance.`
            : `${account.label} added successfully. Click Save Settings to persist it.`;
          xkiroAccountStatus.style.color = sameAccount ? "#f59e0b" : "#10b981";
        }
      } catch (err) {
        if (xkiroAccountStatus) { xkiroAccountStatus.textContent = "Could not add key: " + sanitizeProviderUiError(err && err.message ? err.message : String(err)); xkiroAccountStatus.style.color = "#ef4444"; }
      } finally { xkiroAddAccount.disabled = false; }
    };
    if (xkiroRefreshUsage) xkiroRefreshUsage.onclick = () => refreshXKiroUsage(true);
    renderXKiroAccounts();
    if (workingXKiroAccounts.length) refreshXKiroUsage(false);

    let xkiroCatalogLoaded = false;
    let xkiroCatalogLoading = false;

    function formatXKiroModelLabel(model) {
      const id = String(model && model.id || "");
      const name = String(model && model.name || "").trim();
      const context = Number(model && model.context_length || 0);
      const tags = [];
      if (model && model.reasoning) tags.push("reasoning");
      if (model && model.tools) tags.push("tools");
      if (model && model.vision) tags.push("vision");
      const base = name && name !== id ? `${name} — ${id}` : id;
      const meta = [context >= 1000 ? `${Math.round(context / 1000)}k ctx` : "", tags.join("/")].filter(Boolean).join(" · ");
      return meta ? `${base} (${meta})` : base;
    }

    async function loadXKiroFreeModels(forceRefresh) {
      if (!xkiroModel || xkiroCatalogLoading) return;
      xkiroCatalogLoading = true;
      const wanted = String((!xkiroCatalogLoaded && config.byok_xkiro_model) || xkiroModel.value || "auto");
      if (xkiroRefreshModels) xkiroRefreshModels.disabled = true;
      if (xkiroModelStatus) {
        xkiroModelStatus.textContent = "Loading current xKiro free models...";
        xkiroModelStatus.style.color = "#38bdf8";
      }
      try {
        const res = await callBackground({ action: "bundlee_git_lovable_xkiro_list_free_models", forceRefresh: !!forceRefresh });
        if (!res || !res.ok || !Array.isArray(res.models)) throw new Error(res?.error || "Could not load xKiro free models");
        const models = res.models.filter(m => m && m.id);
        xkiroModel.innerHTML = "";
        const autoOption = document.createElement("option");
        autoOption.value = "auto";
        autoOption.textContent = "Auto — best available free model";
        xkiroModel.appendChild(autoOption);
        models.forEach(model => {
          const opt = document.createElement("option");
          opt.value = String(model.id);
          opt.textContent = formatXKiroModelLabel(model);
          xkiroModel.appendChild(opt);
        });
        const available = models.some(m => String(m.id) === wanted);
        xkiroModel.value = wanted === "auto" || available ? wanted : "auto";
        xkiroCatalogLoaded = true;
        if (xkiroModelStatus) {
          xkiroModelStatus.textContent = available || wanted === "auto"
            ? `${models.length} free chat model${models.length === 1 ? "" : "s"} available. Choose one or leave Auto selected.`
            : `Your previously selected model is no longer in the free catalog. Auto was selected.`;
          xkiroModelStatus.style.color = available || wanted === "auto" ? "#10b981" : "#f59e0b";
        }
        updateReleaseProviderUi();
      } catch (err) {
        if (xkiroModelStatus) {
          xkiroModelStatus.textContent = "⚠ " + sanitizeProviderUiError(err && err.message ? err.message : String(err));
          xkiroModelStatus.style.color = "#ef4444";
        }
      } finally {
        xkiroCatalogLoading = false;
        if (xkiroRefreshModels) xkiroRefreshModels.disabled = false;
      }
    }

    let anthropicCatalogLoaded = false;
    let anthropicCatalogLoading = false;

    function formatAnthropicModelLabel(model) {
      const id = String(model && model.id || "");
      const name = String(model && model.display_name || "").trim();
      const maxTokens = Number(model && model.max_tokens || 0);
      const base = name && name !== id ? `${name} — ${id}` : id;
      return maxTokens > 0 ? `${base} (max ${maxTokens.toLocaleString()} output)` : base;
    }

    async function loadAnthropicModels(forceRefresh) {
      if (!anthropicModel || anthropicCatalogLoading) return;
      const key = String(byokKey && byokKey.value || workingProviderKeys.anthropic || "").trim();
      const workspaceId = String(anthropicWorkspaceId && anthropicWorkspaceId.value || "").trim();
      if (!key) {
        if (anthropicModelStatus) {
          anthropicModelStatus.textContent = "Enter an Anthropic API key, then click Refresh or Test Connection.";
          anthropicModelStatus.style.color = "#f59e0b";
        }
        return;
      }
      anthropicCatalogLoading = true;
      const wanted = String((!anthropicCatalogLoaded && config.byok_anthropic_model) || anthropicModel.value || "auto");
      if (anthropicRefreshModels) anthropicRefreshModels.disabled = true;
      if (anthropicModelStatus) {
        anthropicModelStatus.textContent = "Loading models available to this Anthropic key/workspace...";
        anthropicModelStatus.style.color = "#38bdf8";
      }
      try {
        const res = await callBackground({
          action: "bundlee_git_lovable_anthropic_list_models",
          apiKey: key,
          workspaceId,
          model: wanted,
          forceRefresh: !!forceRefresh
        });
        if (!res || !res.ok || !Array.isArray(res.models)) throw new Error(res?.error || "Could not load Anthropic models");
        const models = res.models.filter(m => m && m.id);
        anthropicModel.innerHTML = "";
        const autoOption = document.createElement("option");
        autoOption.value = "auto";
        autoOption.textContent = `Auto — ${res.selectedModel || "current Claude model"}`;
        anthropicModel.appendChild(autoOption);
        models.forEach(model => {
          const opt = document.createElement("option");
          opt.value = String(model.id);
          opt.textContent = formatAnthropicModelLabel(model);
          anthropicModel.appendChild(opt);
        });
        const available = models.some(m => String(m.id) === wanted);
        anthropicModel.value = wanted === "auto" || available ? wanted : "auto";
        anthropicCatalogLoaded = true;
        if (anthropicModelStatus) {
          anthropicModelStatus.textContent = available || wanted === "auto"
            ? `${models.length} available Claude model${models.length === 1 ? "" : "s"}. Auto follows Anthropic's current catalog.`
            : `Saved model ${wanted} is no longer available. Auto selected ${res.selectedModel || "a current Claude model"}.`;
          anthropicModelStatus.style.color = available || wanted === "auto" ? "#10b981" : "#f59e0b";
        }
        updateReleaseProviderUi();
      } catch (err) {
        if (anthropicModelStatus) {
          anthropicModelStatus.textContent = "⚠ " + sanitizeProviderUiError(err && err.message ? err.message : String(err));
          anthropicModelStatus.style.color = "#ef4444";
        }
      } finally {
        anthropicCatalogLoading = false;
        if (anthropicRefreshModels) anthropicRefreshModels.disabled = false;
      }
    }

    byokProvider.onchange = () => {
      if (workingProvider && workingProvider !== "xkiro" && byokKey) {
        const previousKey = String(byokKey.value || "").trim();
        if (previousKey) workingProviderKeys[workingProvider] = previousKey;
      }
      workingProvider = String(byokProvider.value || "xkiro").toLowerCase();
      if (byokKey) byokKey.value = workingProvider === "xkiro" ? "" : String(workingProviderKeys[workingProvider] || "");
      updateReleaseProviderUi();
      if (byokProvider.value === "xkiro") {
        renderXKiroAccounts();
        if (!xkiroCatalogLoaded) loadXKiroFreeModels(false);
      } else if (byokProvider.value === "anthropic") {
        if (!anthropicCatalogLoaded) loadAnthropicModels(false);
      }
    };
    if (releaseLevel) releaseLevel.onchange = updateReleaseProviderUi;
    if (customModel) customModel.oninput = updateReleaseProviderUi;
    if (xkiroModel) xkiroModel.onchange = updateReleaseProviderUi;
    if (anthropicModel) anthropicModel.onchange = updateReleaseProviderUi;
    if (xkiroRefreshModels) xkiroRefreshModels.onclick = () => loadXKiroFreeModels(true);
    if (anthropicRefreshModels) anthropicRefreshModels.onclick = () => loadAnthropicModels(true);
    if (anthropicWorkspaceId) anthropicWorkspaceId.onchange = () => { anthropicCatalogLoaded = false; loadAnthropicModels(true); };
    updateReleaseProviderUi();
    if (byokProvider.value === "xkiro") loadXKiroFreeModels(false);
    if (byokProvider.value === "anthropic") loadAnthropicModels(false);

    // Show/apply only the repository mapped to the CURRENT Lovable project.
    const mappedOnOpen = getProjectGitMapping(rawGitConfig(), getRuntimeLovableProjectId());
    const detected = autoDetectGitHubRepo({ allowStorage: false, allowConfigFallback: false });
    if (mappedOnOpen) {
      repoInput.value = mappedOnOpen.repository;
      branchInput.value = mappedOnOpen.branch || "main";
      repoBadge.textContent = "✓ Project-Linked";
      repoBadge.style.color = "#10b981";
    } else if (detected && detected.repository) {
      repoInput.value = detected.repository;
      branchInput.value = detected.branch || "main";
      saveCurrentProjectGitMapping(detected.repository, detected.branch || "main", { source: detected.source, projectName: getLovableProjectName() });
      repoBadge.textContent = "✓ Auto-Linked to This Project";
      repoBadge.style.color = "#10b981";
    } else if (!repoInput.value) {
      const pName = getLovableProjectName();
      if (pName && pName !== "lovable-app") {
        repoBadge.textContent = "Project: " + pName + " · Repo not mapped";
        repoBadge.style.color = "#f59e0b";
      }
    }

    // Auto-Connect Button Click (Auto-Detect or Auto-Create GitHub Repository)
    autoConnectBtn.onclick = async () => {
      const pat = tokenInput.value.trim() || config.github_token;
      if (!pat) {
        repoBadge.textContent = "⚠ Enter PAT First";
        repoBadge.style.color = "#ef4444";
        tokenInput.focus();
        showGitToast("⚠ Please enter your GitHub Token (PAT) first to connect or create repository!", "error");
        return;
      }

      autoConnectBtn.disabled = true;
      autoConnectBtn.textContent = "⏳ Connecting...";
      repoBadge.textContent = "Connecting with GitHub...";
      repoBadge.style.color = "#38bdf8";

      const found = autoDetectGitHubRepo();
      const projName = getLovableProjectName();
      const preferred = (found && found.repository && !found.repository.includes("friendly-greetings")) 
        ? found.repository 
        : repoInput.value.trim();

      try {
        const res = await callBackground({
          action: "bundlee_git_127hub_github_auto_connect",
          token: pat,
          preferredRepo: preferred,
          projectName: projName
        });

        if (res && res.ok) {
          repoInput.value = res.repository;
          branchInput.value = res.branch || "main";
          repoBadge.textContent = res.created ? "✓ Auto-Created & Connected" : "✓ Connected";
          repoBadge.style.color = "#10b981";

          // Save linked repo & token immediately
          saveGitConfig({
            repository: res.repository,
            branch: res.branch || "main",
            github_token: pat,
            project_id: getRuntimeLovableProjectId() || getActiveProjectId()
          });
          saveCurrentProjectGitMapping(res.repository, res.branch || "main", { source: res.created ? "auto_created" : "auto_connect", projectName: getLovableProjectName() });

          if (res.created) {
            showGitToast(`✓ Created new private GitHub repository: ${res.repository} with default main branch!`, "success");
          } else {
            showGitToast(`✓ Connected to GitHub repository: ${res.repository}`, "success");
          }
        } else {
          throw new Error(res?.error || "Auto-connect failed");
        }
      } catch (err) {
        repoBadge.textContent = "⚠ " + (err.message || "Failed");
        repoBadge.style.color = "#ef4444";
        showGitToast("GitHub Connect Error: " + (err.message || err), "error");
      } finally {
        autoConnectBtn.disabled = false;
        autoConnectBtn.textContent = "⚡ Auto Detect & Connect";
      }
    };

    // Test BYOK Connection
    testByokBtn.onclick = async () => {
      const activeAccount = currentXKiroAccount();
      const key = byokProvider.value === "xkiro" ? String(activeAccount && activeAccount.apiKey || "").trim() : byokKey.value.trim();
      if (!key) {
        byokTestResult.textContent = byokProvider.value === "xkiro" ? "⚠ Add an xKiro API key first" : "⚠ Please enter API Key first";
        byokTestResult.style.color = "#ef4444";
        return;
      }
      testByokBtn.disabled = true;
      testByokBtn.textContent = "⏳ Testing...";
      byokTestResult.textContent = "Connecting to provider...";
      byokTestResult.style.color = "#38bdf8";

      try {
        const res = await callBackground({
          action: "bundlee_git_lovable_public_byok_test",
          provider: byokProvider.value,
          apiKey: key,
          apiBase: customApiBase ? customApiBase.value.trim() : "",
          workspaceId: byokProvider.value === "anthropic" && anthropicWorkspaceId ? anthropicWorkspaceId.value.trim() : "",
          model: releaseModelFor(byokProvider.value, releaseLevel ? releaseLevel.value : "basic", customModel ? customModel.value : "", xkiroModel ? xkiroModel.value : "auto", anthropicModel ? anthropicModel.value : "auto") || undefined,
          messages: [{ role: "user", content: "Reply with 'pong' only." }],
          systemPrompt: "You are a test agent.",
          maxOutputTokens: 32,
          reasoningEffort: releaseReasoningFor(byokProvider.value, releaseLevel ? releaseLevel.value : "basic")
        });

        if (res && res.ok) {
          const successMessage = res.message || "Connected successfully.";
          byokTestResult.textContent = "✓ " + successMessage;
          byokTestResult.style.color = "#10b981";
          showGitToast("✓ " + successMessage, "success");
          if (byokProvider.value === "xkiro" && activeAccount && res.usageStatus) {
            xkiroUsageCache.set(activeAccount.id, res.usageStatus);
            renderXKiroAccounts();
          }
          if (byokProvider.value === "anthropic") {
            anthropicCatalogLoaded = false;
            loadAnthropicModels(true);
          }
        } else {
          throw new Error(res?.error || "Test ping failed");
        }
      } catch (err) {
        const safeError = sanitizeProviderUiError(err && err.message ? err.message : String(err));
        byokTestResult.textContent = "⚠ " + safeError;
        byokTestResult.style.color = "#ef4444";
        showGitToast("BYOK Test Error: " + safeError, "error");
      } finally {
        testByokBtn.disabled = false;
        testByokBtn.textContent = "🧪 Test Connection";
      }
    };

    cancelBtn.onclick = () => backdrop.remove();

    saveBtn.onclick = async () => {
      const repository = repoInput.value.trim();
      const branch = branchInput.value.trim() || "main";
      const token = tokenInput.value.trim();

      if (!repository) {
        showGitToast("Please enter or auto-detect your GitHub repository", "error");
        return;
      }

      saveBtn.disabled = true;
      saveBtn.textContent = "Saving...";

      try {
        const activeXKiro = currentXKiroAccount();
        const currentProvider = String(byokProvider.value || "xkiro").toLowerCase();
        if (currentProvider !== "xkiro" && byokKey) {
          const currentKey = String(byokKey.value || "").trim();
          if (currentKey) workingProviderKeys[currentProvider] = currentKey;
        }
        const selectedProviderKey = currentProvider === "xkiro" ? String(activeXKiro && activeXKiro.apiKey || "").trim() : String(workingProviderKeys[currentProvider] || "").trim();
        if (!selectedProviderKey) throw new Error(currentProvider === "xkiro" ? "Add at least one xKiro API key." : "API key is required.");
        const currentContracts = Object.assign({}, config.project_contracts_by_repo || {});
        const currentRepoKey = projectRepoKey(config, repository);
        if (currentRepoKey) currentContracts[currentRepoKey] = normalizeContractText(projectContractInput ? projectContractInput.value : getProjectContract(config, repository));
        saveGitConfig({
          repository,
          branch,
          github_token: token,
          auto_commit: autoCommitInput ? autoCommitInput.checked : true,
          engine_mode: "byok",
          byok_provider: byokProvider.value,
          byok_key: selectedProviderKey,
          provider_keys: Object.assign({}, workingProviderKeys),
          xkiro_accounts: workingXKiroAccounts.map(a => ({ id: a.id, label: a.label, apiKey: a.apiKey, email: a.email || "", name: a.name || "" })),
          xkiro_active_account_id: workingXKiroActiveId,
          byok_api_base: customApiBase ? customApiBase.value.trim() : "",
          byok_custom_model: customModel ? customModel.value.trim() : "",
          byok_xkiro_model: xkiroModel ? xkiroModel.value : "auto",
          byok_anthropic_workspace_id: anthropicWorkspaceId ? anthropicWorkspaceId.value.trim() : "",
          byok_anthropic_model: anthropicModel ? anthropicModel.value : "auto",
          release_level: releaseLevel ? releaseLevel.value : "auto",
          byok_plan_model: releaseModelFor(byokProvider.value, (releaseLevel && releaseLevel.value === "auto") ? "medium" : (releaseLevel ? releaseLevel.value : "medium"), customModel ? customModel.value : "", xkiroModel ? xkiroModel.value : "auto", anthropicModel ? anthropicModel.value : "auto"),
          byok_apply_model: releaseModelFor(byokProvider.value, (releaseLevel && releaseLevel.value === "auto") ? "medium" : (releaseLevel ? releaseLevel.value : "medium"), customModel ? customModel.value : "", xkiroModel ? xkiroModel.value : "auto", anthropicModel ? anthropicModel.value : "auto"),
          ai_power_level: releaseLevel ? releaseLevel.value : "auto",
          change_scope: changeScopeInput ? changeScopeInput.value : "auto",
          project_memory: projectMemoryInput ? projectMemoryInput.checked : true,
          project_contracts_by_repo: currentContracts,
          consistency_review: consistencyReviewInput ? consistencyReviewInput.value : "smart",
          strict_consistency: strictConsistencyInput ? strictConsistencyInput.checked : true,
          dev_diagnostics: devDiagnosticsInput ? devDiagnosticsInput.checked : true,
          dev_diagnostics_deep: devDiagnosticsDeepInput ? devDiagnosticsDeepInput.checked : true,
          credit_value_usd: 0.01,
          cost_saver: true,
          max_prompt_chars: releaseLevelProfile((releaseLevel && releaseLevel.value !== "auto") ? releaseLevel.value : "medium").maxPromptChars,
          max_output_tokens: releaseLevelProfile((releaseLevel && releaseLevel.value !== "auto") ? releaseLevel.value : "medium").maxOutputTokens,
          max_context_files: releaseLevelProfile((releaseLevel && releaseLevel.value !== "auto") ? releaseLevel.value : "medium").maxContextFiles,
          max_context_chars: releaseLevelProfile((releaseLevel && releaseLevel.value !== "auto") ? releaseLevel.value : "medium").maxContextChars,
          project_id: getRuntimeLovableProjectId() || getActiveProjectId()
        });
        saveCurrentProjectGitMapping(repository, branch, { source: "manual_settings", projectName: getLovableProjectName() });

        showGitToast(`✓ Settings Saved for this project! Connected to ${repository}`, "success");
        backdrop.remove();
        if (typeof onSaved === "function") onSaved({ repository, branch, token });
      } catch (err) {
        showGitToast("Save failed: " + (err.message || err), "error");
        saveBtn.disabled = false;
        saveBtn.textContent = "Save Settings";
      }
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // Diff Preview Modal
  // ─────────────────────────────────────────────────────────────────
  function showDiffPreviewModal(result, onConfirm, onDiscard, isAlreadyCommitted = false) {
    const old = document.getElementById("127hub-diff-modal-backdrop");
    if (old) old.remove();

    const config = getGitConfig();
    const backdrop = document.createElement("div");
    backdrop.id = "127hub-diff-modal-backdrop";
    backdrop.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(4, 7, 16, 0.88);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      animation: hubFadeIn 0.25s ease-out;
    `;

    const changes = Array.isArray(result.changes) ? result.changes : [];
    let fileListHtml = "";

    changes.forEach((c, idx) => {
      const isCreate = c.action === "create";
      const badgeColor = isCreate ? "#10b981" : "#38bdf8";
      const actionText = isCreate ? "CREATE" : "UPDATE";

      fileListHtml += `
        <details style="margin-bottom: 12px; background: #111927; border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; overflow: hidden;" ${idx === 0 ? "open" : ""}>
          <summary style="padding: 12px 16px; cursor: pointer; font-size: 13px; font-weight: 600; display: flex; align-items: center; justify-content: space-between; user-select: none; background: rgba(255,255,255,0.03);">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="background: ${badgeColor}22; color: ${badgeColor}; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 800;">${actionText}</span>
              <span style="color: #f1f5f9; font-family: monospace;">${c.path}</span>
            </div>
            <span style="color: #64748b; font-size: 12px;">▾</span>
          </summary>
          <pre style="margin: 0; padding: 14px; max-height: 240px; overflow-y: auto; background: #080c14; color: #a5f3fc; font-size: 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; line-height: 1.5; white-space: pre-wrap; border-top: 1px solid rgba(255,255,255,0.06);">${escapeHtml(c.content || "")}</pre>
        </details>
      `;
    });

    const statusBadge = isAlreadyCommitted
      ? `<span style="background: rgba(16,185,129,0.2); color: #34d399; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 20px; border: 1px solid rgba(16,185,129,0.4);">✓ Pushed to GitHub</span>`
      : `<span style="background: rgba(16,185,129,0.15); color: #34d399; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 20px; border: 1px solid rgba(16,185,129,0.3);">Zero Lovable Credits</span>`;

    const footerButtons = isAlreadyCommitted
      ? `
        <div style="padding: 16px 26px; border-top: 1px solid rgba(255,255,255,0.08); background: rgba(0,0,0,0.25); display: flex; align-items: center; justify-content: flex-end;">
          <button id="hub-diff-close-view" style="background: linear-gradient(135deg, #00f2fe, #4facfe); color: #051428; border: none; padding: 11px 24px; border-radius: 10px; font-size: 13px; font-weight: 800; cursor: pointer; box-shadow: 0 4px 18px rgba(0,242,254,0.35); transition: all 0.2s;">
            Close
          </button>
        </div>
      `
      : `
        <div style="padding: 16px 26px; border-top: 1px solid rgba(255,255,255,0.08); background: rgba(0,0,0,0.25); display: flex; align-items: center; justify-content: space-between;">
          <button id="hub-diff-discard" style="background: rgba(255,255,255,0.08); color: #cbd5e1; border: none; padding: 11px 20px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s;">
            Discard Changes
          </button>
          <button id="hub-diff-confirm" style="background: linear-gradient(135deg, #00f2fe, #4facfe); color: #051428; border: none; padding: 11px 24px; border-radius: 10px; font-size: 13px; font-weight: 800; cursor: pointer; box-shadow: 0 4px 18px rgba(0,242,254,0.35); transition: all 0.2s;">
            ✓ Confirm & Push to GitHub
          </button>
        </div>
      `;

    backdrop.innerHTML = `
      <style>
        @keyframes hubFadeIn {
          from { opacity: 0; transform: scale(0.97); }
          to { opacity: 1; transform: scale(1); }
        }
      </style>
      <div style="width: 100%; max-width: 680px; max-height: 85vh; display: flex; flex-direction: column; background: #0a0f1d; border: 1px solid rgba(0, 242, 254, 0.3); border-radius: 20px; box-shadow: 0 25px 60px rgba(0,0,0,0.8), 0 0 35px rgba(0,242,254,0.15); color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; overflow: hidden;">
        <!-- Header -->
        <div style="padding: 22px 26px 16px; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: space-between;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 18px;">⚡</span>
              <h2 style="margin: 0; font-size: 18px; font-weight: 800; color: #ffffff;">Git Mode — Review Code Changes</h2>
            </div>
            <div style="font-size: 12.5px; color: #94a3b8; margin-top: 4px;">
              Target: <code style="color: #38bdf8; background: #131d31; padding: 2px 6px; border-radius: 4px;">${config.repository || "Connected Repo"}</code> · Branch: <code style="color: #a7f3d0; background: #131d31; padding: 2px 6px; border-radius: 4px;">${config.branch || "main"}</code>
            </div>
          </div>
          ${statusBadge}
        </div>

        <!-- Body -->
        <div style="padding: 20px 26px; overflow-y: auto; flex: 1;">
          <p style="margin: 0 0 16px; font-size: 13.5px; color: #cbd5e1; line-height: 1.5;">
            ${escapeHtml(result.summary || "The AI has planned the following repository updates. Review the modified files below before committing.")}
          </p>

          <div style="font-size: 12px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;">
            Modified Files (${changes.length})
          </div>

          ${fileListHtml || '<div style="color: #94a3b8; font-size: 13px; padding: 16px; text-align: center;">No file modifications planned.</div>'}
        </div>

        <!-- Footer -->
        ${footerButtons}
      </div>
    `;

    document.body.appendChild(backdrop);

    if (isAlreadyCommitted) {
      const closeBtn = backdrop.querySelector("#hub-diff-close-view");
      if (closeBtn) closeBtn.onclick = () => backdrop.remove();
      return;
    }

    const discardBtn = backdrop.querySelector("#hub-diff-discard");
    const confirmBtn = backdrop.querySelector("#hub-diff-confirm");

    discardBtn.onclick = () => {
      backdrop.remove();
      if (typeof onDiscard === "function") onDiscard();
      showGitToast("Changes discarded. Repository unchanged.", "info");
    };

    confirmBtn.onclick = async () => {
      confirmBtn.disabled = true;
      discardBtn.disabled = true;
      confirmBtn.style.opacity = "0.7";
      confirmBtn.textContent = "Committing to GitHub...";

      try {
        if (typeof onConfirm === "function") {
          await onConfirm();
        }
        backdrop.remove();
        showGitToast("✓ Successfully committed to GitHub! Lovable is syncing...", "success", 6000);
      } catch (err) {
        showGitToast("Commit failed: " + (err.message || err), "error");
        let errBanner = backdrop.querySelector("#hub-diff-err-banner");
        if (!errBanner) {
          errBanner = document.createElement("div");
          errBanner.id = "hub-diff-err-banner";
          errBanner.style.cssText = "margin: 12px 26px 0; padding: 12px 16px; background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.35); border-radius: 10px; color: #fca5a5; font-size: 13px; display: flex; align-items: center; gap: 10px;";
          const modalInner = backdrop.querySelector("div[style*='max-width: 680px']");
          if (modalInner) modalInner.insertBefore(errBanner, modalInner.children[1]);
        }
        errBanner.innerHTML = `<span style="font-size: 16px;">⚠</span><div><strong>Commit Failed:</strong> ${escapeHtml(err.message || String(err))}</div>`;
        confirmBtn.disabled = false;
        discardBtn.disabled = false;
        confirmBtn.style.opacity = "1";
        confirmBtn.textContent = "✓ Confirm & Push to GitHub";
      }
    };
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // ─────────────────────────────────────────────────────────────────
  // Robust AI Code & JSON Parser (Handles all JSON, Markdown & Raw Formats)
  // ─────────────────────────────────────────────────────────────────
  function collectLovableRuntimeErrorContext() {
    try {
      const doc = (window.top && window.top.document) || document;
      const raw = String((doc.body && doc.body.innerText) || "");
      if (!raw) return null;

      // Only treat explicit Lovable preview/build failures as active errors.
      // Ordinary historical chat text containing the word "error" is ignored.
      const patterns = [
        /Runtime error/i,
        /Transform failed with \d+ error/i,
        /\[PARSE_ERROR\]/i,
        /Unexpected token/i,
        /Couldn['’]t update the preview/i,
        /Preview has not been built yet/i
      ];
      let hit = -1;
      for (const re of patterns) {
        const m = re.exec(raw);
        if (m && (hit < 0 || m.index < hit)) hit = m.index;
      }
      if (hit < 0) {
        try {
          const mon = window.__LAA_BUILD_MONITOR && window.__LAA_BUILD_MONITOR.latest;
          if (mon && mon.state === "failed" && mon.details) {
            const t = String(mon.details).replace(/\u001b\[[0-9;]*m/gi, "").slice(0, 5000);
            const mm = t.match(/((?:src|app|pages|components)\/[A-Za-z0-9_@.\-\/]+\.(?:tsx?|jsx?|mjs|cjs|css|json)):(\d+):(\d+)/i);
            const actionableBuildFailure = !!mm || /(?:transform failed|parse[_ ]?error|compile error|build failed|unexpected token|cannot find module|failed to resolve import|module not found|referenceerror|syntaxerror|typeerror)/i.test(t);
            // Lovable's own editor/network UI can surface generic messages such as
            // "API endpoint not found". Those are not enough to override the user's
            // coding request unless they identify a project source/build failure.
            if (actionableBuildFailure) {
              return { text: t, path: mm ? String(mm[1]).replace(/^\.\//, "") : "", line: mm ? Number(mm[2]) : 0, column: mm ? Number(mm[3]) : 0 };
            }
          }
        } catch (_) {}
        return null;
      }

      const start = Math.max(0, hit - 500);
      const segment = raw.slice(start, Math.min(raw.length, hit + 6500))
        .replace(/\u001b\[[0-9;]*m/gi, "")
        .replace(/\[(?:\d{1,3};?)+m/g, "")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{4,}/g, "\n\n\n")
        .trim();

      const pathMatch = segment.match(/((?:src|app|pages|components)\/[A-Za-z0-9_@.\-\/]+\.(?:tsx?|jsx?|mjs|cjs|css|json)):(\d+):(\d+)/i)
        || segment.match(/((?:src|app|pages|components)\/[A-Za-z0-9_@.\-\/]+\.(?:tsx?|jsx?|mjs|cjs|css|json))[^\n]{0,50}line\s*(\d+)(?:[^\n]{0,30}(?:col(?:umn)?|:)\s*(\d+))?/i);

      return {
        text: segment.slice(0, 5000),
        path: pathMatch ? String(pathMatch[1]).replace(/^\.\//, "") : "",
        line: pathMatch && pathMatch[2] ? Number(pathMatch[2]) : 0,
        column: pathMatch && pathMatch[3] ? Number(pathMatch[3]) : 0
      };
    } catch (_) {
      return null;
    }
  }

  function buildRuntimeErrorSourceExcerpt(content, lineNumber) {
    const text = String(content || "");
    const line = Number(lineNumber || 0);
    if (!line || text.length < 18000) return text;
    const lines = text.split("\n");
    const idx = Math.max(0, Math.min(lines.length - 1, line - 1));
    const headEnd = Math.min(lines.length, 90);
    const from = Math.max(headEnd, idx - 90);
    const to = Math.min(lines.length, idx + 95);
    const head = lines.slice(0, headEnd).join("\n");
    const around = lines.slice(from, to).join("\n");
    return `${head}\n\n/* ... ${Math.max(0, from - headEnd)} line(s) omitted; active Lovable error is near line ${line} ... */\n\n${around}`;
  }

  // Runtime-repair retries should be surgical. Supplying a huge whole file makes
  // smaller/free models more likely to repeat a no-op or truncate a replacement.
  // This excerpt contains the exact current source around Lovable's reported line
  // (without synthetic line prefixes) so the provider can return a tiny verbatim
  // search/replace patch that will safely match the latest GitHub file.
  function buildRuntimeRepairPatchContext(content, lineNumber) {
    const text = String(content || "");
    const line = Number(lineNumber || 0);
    if (!line) return text.length <= 18000 ? text : text.slice(0, 18000);
    const lines = text.split("\n");
    const idx = Math.max(0, Math.min(lines.length - 1, line - 1));
    const from = Math.max(0, idx - 120);
    const to = Math.min(lines.length, idx + 61);
    return lines.slice(from, to).join("\n");
  }

  function selectRelevantRepoFiles(prompt, repoFiles, maxFiles = 5) {
    const files = Array.isArray(repoFiles) ? repoFiles : [];
    const q = String(prompt || "").toLowerCase();
    const scope = inferChangeScope(prompt, "auto");
    const words = q.split(/[^a-z0-9_-]+/).filter(w => w.length >= 3);
    const selected = [];

    function add(path) {
      if (path && files.includes(path) && !selected.includes(path) && selected.length < maxFiles) selected.push(path);
    }

    const broadCreation = isBroadAppCreationPrompt(q);
    const hasRouterProjectEarly = files.includes("src/router.tsx") || files.includes("src/routeTree.gen.ts") || files.includes("src/routes/__root.tsx");
    const domainEntityRequest = /\b(customer|customers|client|clients|product|products|order|orders|sales|analytics|settings|dashboard|invoice|invoices|transaction|transactions)\b/.test(q);

    // In many Lovable projects the entire prototype lives in routes/index.tsx.
    // For entity/workflow edits, anchor on the rendered page before generic UI
    // primitives such as button.tsx/menubar.tsx steal the relevance ranking.
    if (!broadCreation && domainEntityRequest && hasRouterProjectEarly && files.includes("src/routes/index.tsx")) {
      add("src/routes/index.tsx");
    }

    // Broad app/site creation must start from the rendered entry page, not whichever
    // utility file happens to share words such as "menu" or "client".
    if (broadCreation) {
      if (hasRouterProjectEarly && files.includes("src/routes/index.tsx")) add("src/routes/index.tsx");
      else if (files.includes("src/App.tsx")) add("src/App.tsx");
      else if (files.includes("src/App.jsx")) add("src/App.jsx");
      else if (files.includes("src/main.tsx")) add("src/main.tsx");
      if (hasRouterProjectEarly) add("src/routes/__root.tsx");
      if (files.includes("src/styles.css")) add("src/styles.css");
      add("package.json");
    }

    // Navigation requests must see the rendered page before generic sidebar/ui
    // primitives. This prevents the model from redesigning __root.tsx or inventing
    // routes without understanding the actual app screen it is supposed to preserve.
    if (!broadCreation && isNavigationFeaturePrompt(q)) {
      if (hasRouterProjectEarly && files.includes("src/routes/index.tsx")) add("src/routes/index.tsx");
      else if (files.includes("src/App.tsx")) add("src/App.tsx");
      else if (files.includes("src/App.jsx")) add("src/App.jsx");
      if (hasRouterProjectEarly) add("src/routes/__root.tsx");
    }

    const scores = files.map(path => {
      const p = String(path || "");
      const l = p.toLowerCase();
      const base = l.split("/").pop() || "";
      let score = 0;

      // Strongest signal: the filename/path directly matches words from the request.
      for (const w of words) {
        if (l.includes(w)) score += 28;
        if (base.includes(w)) score += 22;
      }

      // Feature-specific path hints.
      if (/\b(sidebar|navigation|navbar|menu)\b/.test(q) && /(sidebar|nav|menu|layout|shell)/.test(l)) score += 60;
      if (/\b(sidebar|navigation|navbar|menu)\b/.test(q) && /__root|root\./.test(l) && !["content", "style", "image"].includes(scope)) score += 30;
      if (/\b(price|pricing|currency|rupees?|inr|usd|dollars?)\b/.test(q) && /(price|pricing|product|plan|billing|subscription|home|index)/.test(l)) score += 45;
      if (/\b(client|customer)\b/.test(q) && /(client|customer)/.test(l)) score += 50;
      if (/\b(invoice)\b/.test(q) && /invoice/.test(l)) score += 50;
      if (/\b(transaction)\b/.test(q) && /transaction/.test(l)) score += 50;
      if (/\b(product)\b/.test(q) && /product/.test(l)) score += 55;
      if (/\b(cart)\b/.test(q) && /cart/.test(l)) score += 55;
      if (/\b(auth|login|signup)\b/.test(q) && /(auth|login|signup)/.test(l)) score += 55;
      if (/\b(settings?)\b/.test(q) && /settings?/.test(l)) score += 50;
      if (/\b(faq)\b/.test(q) && /faq/.test(l)) score += 50;

      if (scope === "style" && /\.(css|scss|sass|less|tsx|jsx)$/.test(l)) score += 10;
      if (scope === "content" && /\.(tsx|jsx|ts|js|json)$/.test(l)) score += 8;
      if (scope === "image" && /\.(tsx|jsx|ts|js|json|css)$/.test(l)) score += 8;
      if (/\b(home|homepage|landing)\b/.test(q) && /(^|\/)(index|home|page)\.(tsx|jsx|ts|js)$/.test(l)) score += 55;
      if (/\b(route|routing|404|not found)\b/.test(q) && /(route|router|root|app|main)/.test(l)) score += 50;

      // Generated files are poor context unless explicitly named.
      if (/routeTree\.gen\./i.test(p) && !/routetree/.test(q)) score -= 100;

      // Generic shadcn/UI primitives frequently contain words such as button/menu
      // and used to outrank the actual application page. Let dependency expansion
      // bring them in when the rendered page truly imports them. Sidebar is kept as
      // an exception because users commonly ask to edit that component directly.
      if (/^src\/components\/ui\/[^/]+\.(?:tsx?|jsx?)$/i.test(p) && !/\bsidebar\b/.test(base)) {
        const explicitPrimitive = q.includes(`ui/${base}`) || q.includes(base) || q.includes(`${base.replace(/\.(?:tsx?|jsx?)$/i, "")} component`);
        if (!explicitPrimitive) score -= 80;
        else if (/^button\.(?:tsx?|jsx?)$/i.test(base) && !/\bbutton component\b|ui\/button|button\.(?:tsx?|jsx?)/.test(q)) score -= 80;
      }
      return { path: p, score };
    }).sort((a, b) => b.score - a.score);

    // First take highly relevant named files. This is the main token-saving change:
    // do not always spend 3-4 slots on package/router/root files for a tiny edit.
    for (const item of scores) {
      if (selected.length >= maxFiles) break;
      if (item.score >= 35) add(item.path);
    }

    const hasRouterProject = files.includes("src/router.tsx") || files.includes("src/routeTree.gen.ts") || files.includes("src/routes/__root.tsx");
    if (broadCreation && /\b(sidebar|navigation|navbar|menu)\b/.test(q)) {
      const navCandidates = scores.filter(item => /(?:sidebar|nav|menu|layout|shell)/.test(String(item.path || "").toLowerCase()) && item.score > 0);
      for (const item of navCandidates.slice(0, 2)) add(item.path);
    }
    const smallEdit = ["content", "style", "image"].includes(scope) && String(prompt || "").length < 500;
    const dependencyRequest = /\b(package|dependency|dependencies|install|npm|library|module|sdk)\b/.test(q);
    const routingRequest = /\b(route|routing|router|navigation|sidebar|navbar|menu|layout|404|not found)\b/.test(q);

    // Always give the model at least one actual rendered page when filename matching
    // did not find anything. For router projects that is normally routes/index.tsx.
    if (!selected.length) {
      if (hasRouterProject && files.includes("src/routes/index.tsx")) add("src/routes/index.tsx");
      else if (files.includes("src/App.tsx")) add("src/App.tsx");
      else if (files.includes("src/App.jsx")) add("src/App.jsx");
      else if (files.includes("src/main.tsx")) add("src/main.tsx");
    }

    // For routing/layout work, include the root/layout only when it is actually useful.
    // If a tiny sidebar/navbar request already matched its dedicated component, do
    // not spend extra context on the root/router unless the prompt explicitly asks
    // for routing or the component is not present.
    const hasDirectNavigationFile = selected.some(p => /(?:^|\/)(?:sidebar|nav(?:bar)?|menu|layout|shell)[^/]*\.(?:tsx?|jsx?)$/i.test(String(p || "")));
    if (routingRequest && hasRouterProject && (!smallEdit || !hasDirectNavigationFile || /\b(route|routing|router|404|not found)\b/.test(q))) {
      add("src/routes/__root.tsx");
      if (selected.length < maxFiles && /\b(route|routing|router|404|not found)\b/.test(q)) add("src/router.tsx");
    }

    // Package metadata is useful for new features/dependencies, not for "make sticky"
    // or "change USD to INR".
    if (dependencyRequest || scope === "architecture" || scope === "full") add("package.json");

    // Larger feature/data/bugfix jobs still need a minimal structural baseline when
    // filename matching found very little. Add at most enough to reach three files.
    if (!smallEdit && selected.length < Math.min(3, maxFiles)) {
      if (hasRouterProject) {
        add("src/routes/index.tsx");
        add("src/routes/__root.tsx");
      } else {
        add("src/App.tsx");
        add("src/App.jsx");
      }
      if (selected.length < Math.min(3, maxFiles)) add("package.json");
    }

    // Fill remaining slots by relevance. For small edits, require a positive match;
    // for larger feature work, use only paths with an actual relevance signal.
    for (const item of scores) {
      if (selected.length >= maxFiles) break;
      if (smallEdit && item.score < 35) continue;
      if (/routeTree\.gen\./i.test(item.path) && !/routetree/.test(q)) continue;
      if (item.score > 0) add(item.path);
    }

    return selected.slice(0, maxFiles);
  }

  function validateIntentAlignment(previewData, prompt, repoFiles) {
    if (!isBroadAppCreationPrompt(prompt)) return previewData;
    if (!previewData || !Array.isArray(previewData.changes) || !previewData.changes.length) {
      throw new Error("Intent alignment failed: the requested application build returned no code changes.");
    }

    const paths = previewData.changes.map(c => String(c && c.path || "").replace(/^\.\//, "").replace(/^\//, ""));
    const files = Array.isArray(repoFiles) ? repoFiles : [];
    const expectedEntry = files.includes("src/routes/index.tsx")
      ? "src/routes/index.tsx"
      : (files.includes("src/App.tsx") ? "src/App.tsx" : (files.includes("src/App.jsx") ? "src/App.jsx" : ""));
    const touchesRenderedEntry = expectedEntry && paths.includes(expectedEntry);
    const createsRealPage = paths.some(p => /(?:^|\/)(?:routes|pages|app)\/.+\.(?:tsx?|jsx?)$/i.test(p) && !/(?:__root|routeTree\.gen)\./i.test(p));

    // A broad "create CRM/web app/site" request cannot be considered satisfied by
    // changing only a generic UI primitive or utility file.
    if (!touchesRenderedEntry && !createsRealPage) {
      throw new Error(`Intent alignment failed: the user asked to build an application, but the generated change did not modify the rendered entry page${expectedEntry ? ` (${expectedEntry})` : ""} or create a real page.`);
    }

    const summary = String(previewData.summary || "").toLowerCase();
    const promptText = String(prompt || "").toLowerCase();
    if (/\b(crm|dashboard|website|web app|portal|platform|store|shop)\b/.test(promptText) &&
        /(?:shortcut display name|metadata|typo|utility|primitive only)/i.test(summary)) {
      throw new Error("Intent alignment failed: the generated summary is unrelated to the requested application build.");
    }
    return previewData;
  }

  function buildWhitespaceIndex(text) {
    const source = String(text || "");
    let normalized = "";
    const starts = [];
    const ends = [];
    let inWhitespace = false;
    for (let i = 0; i < source.length; i++) {
      const ch = source[i];
      if (/\s/.test(ch)) {
        if (!inWhitespace) {
          normalized += " ";
          starts.push(i);
          ends.push(i + 1);
          inWhitespace = true;
        } else {
          ends[ends.length - 1] = i + 1;
        }
      } else {
        normalized += ch;
        starts.push(i);
        ends.push(i + 1);
        inWhitespace = false;
      }
    }
    return { normalized, starts, ends };
  }

  function findUniqueWhitespaceNormalizedRange(content, search) {
    const needle = String(search || "").replace(/\s+/g, " ").trim();
    // Never fuzzy-match tiny snippets. A short common fragment could modify the wrong place.
    if (needle.length < 24) return null;
    const indexed = buildWhitespaceIndex(content);
    const first = indexed.normalized.indexOf(needle);
    if (first < 0) return null;
    const second = indexed.normalized.indexOf(needle, first + 1);
    if (second >= 0) return null;
    const last = first + needle.length - 1;
    if (first >= indexed.starts.length || last >= indexed.ends.length) return null;
    return { start: indexed.starts[first], end: indexed.ends[last] };
  }

  function normalizeRepoPath(path) {
    const out = [];
    String(path || "").replace(/\\/g, "/").split("/").forEach(part => {
      if (!part || part === ".") return;
      if (part === "..") out.pop(); else out.push(part);
    });
    return out.join("/");
  }

  function dirnameRepoPath(path) {
    const p = normalizeRepoPath(path);
    const idx = p.lastIndexOf("/");
    return idx >= 0 ? p.slice(0, idx) : "";
  }

  // Vite/TanStack/older Lovable projects commonly decorate import specifiers with
  // resource queries such as ?url, ?raw, ?inline, ?worker or a hash fragment.
  // Those suffixes control bundler behaviour; they are NOT part of the repository
  // filename and must never make the consistency checker report a false missing file.
  function normalizeLocalImportSpecifier(spec) {
    let clean = String(spec || "").trim();
    if (!clean) return "";
    // Remove Vite/Webpack resource query/hash decorators while preserving the path.
    // Examples: ./styles.css?url -> ./styles.css, ./icon.svg?raw#x -> ./icon.svg
    const cut = clean.search(/[?#]/);
    if (cut >= 0) clean = clean.slice(0, cut);
    try { clean = decodeURIComponent(clean); } catch (_) {}
    return clean.trim();
  }

  function extractRelativeImports(source) {
    const out = [];
    const text = String(source || "");
    // from "./x", import("./x"), require("./x")
    const re = /(?:from\s*|import\s*\(\s*|require\s*\(\s*)["'](\.{1,2}\/[^"']+)["']/g;
    // bare side-effect imports: import "./styles.css";
    const bare = /(?:^|[;\n\r])\s*import\s*["'](\.{1,2}\/[^"']+)["']/g;
    let m;
    while ((m = re.exec(text))) if (m[1] && !out.includes(m[1])) out.push(m[1]);
    while ((m = bare.exec(text))) if (m[1] && !out.includes(m[1])) out.push(m[1]);
    return out;
  }

  function resolveRepoImport(importer, spec, fileSet) {
    const cleanSpec = normalizeLocalImportSpecifier(spec);
    if (!cleanSpec || !cleanSpec.startsWith(".")) return "";
    const base = normalizeRepoPath((dirnameRepoPath(importer) ? dirnameRepoPath(importer) + "/" : "") + cleanSpec);
    // First try the exact path. Then support the extensions/index files seen across
    // old and new Lovable/Vite/React/TanStack projects. The extra asset/style
    // extensions make extensionless legacy imports tolerant without weakening checks
    // for genuinely missing files.
    const exts = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs", ".json", ".css", ".scss", ".sass", ".less", ".styl", ".svg", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif"];
    const candidates = [base, ...exts.map(ext => `${base}${ext}`), ...exts.map(ext => `${base}/index${ext}`)];
    return candidates.find(c => fileSet.has(c)) || "";
  }

  async function expandContextWithDependencies(contextFiles, repoFiles, config, maxFiles, maxChars, hud) {
    const rows = Array.isArray(contextFiles) ? contextFiles.slice() : [];
    if (rows.length >= maxFiles) return rows;
    const fileSet = new Set(Array.isArray(repoFiles) ? repoFiles.map(normalizeRepoPath) : []);
    const loaded = new Set(rows.map(f => normalizeRepoPath(f.path)));
    const wanted = [];
    for (const f of rows) {
      if (!/\.(?:tsx?|jsx?|mjs|cjs)$/i.test(String(f.path || ""))) continue;
      for (const spec of extractRelativeImports(f.content)) {
        const resolved = resolveRepoImport(f.path, spec, fileSet);
        if (resolved && !loaded.has(resolved) && !wanted.includes(resolved)) wanted.push(resolved);
        if (rows.length + wanted.length >= maxFiles) break;
      }
      if (rows.length + wanted.length >= maxFiles) break;
    }
    if (!wanted.length) return rows;
    try {
      const res = await callBackground({ action: "bundlee_git_127hub_github_get_files", repository: config.repository, branch: config.branch || "main", token: config.github_token, paths: wanted, maxTotalChars: Math.max(8000, Math.floor(Number(maxChars || 30000) * 0.45)) });
      if (res && res.ok && Array.isArray(res.files)) {
        res.files.forEach(f => { if (f && f.path && !loaded.has(normalizeRepoPath(f.path))) { rows.push(f); loaded.add(normalizeRepoPath(f.path)); } });
        if (hud && res.files.length) hud.appendLog(`Smart context: loaded ${res.files.length} local dependenc${res.files.length === 1 ? "y" : "ies"} referenced by the relevant files.`, "#a7f3d0");
      }
    } catch (_) {}
    return rows.slice(0, maxFiles);
  }

  function constrainLoadedContextToBudget(contextFiles, maxChars, hud) {
    const rows = Array.isArray(contextFiles) ? contextFiles.filter(f => f && f.path && typeof f.content === "string") : [];
    if (!rows.length) return rows;
    const requested = Math.max(8000, Number(maxChars || 30000));
    const primaryChars = String(rows[0].content || "").length;
    // Never truncate the primary target file: exact patches require verbatim source.
    // Instead, drop secondary context until the budget is respected.
    const budget = Math.max(requested, primaryChars + 2500);
    const kept = [];
    let used = 0;
    for (const row of rows) {
      const len = String(row.content || "").length;
      if (!kept.length || used + len <= budget) {
        kept.push(row);
        used += len;
      }
    }
    if (kept.length < rows.length && hud) {
      hud.appendLog(`Context budget: kept ${kept.length}/${rows.length} file(s) · ${used.toLocaleString()} chars`, "#a7f3d0");
    }
    return kept;
  }

  function validateLocalImportGraph(previewData, repoContentMap, repoFiles) {
    if (!previewData || !Array.isArray(previewData.changes)) return previewData;

    // Keep a before/after view so legacy projects are not punished for a pre-existing
    // unusual import that this job did not introduce. We block only when the current
    // AI change introduces a missing relative import, or when the current change
    // deletes/breaks a target that previously resolved.
    const treeTrusted = Array.isArray(repoFiles) && repoFiles.length > 0;
    const beforeFileSet = new Set((repoFiles || []).map(normalizeRepoPath));
    const afterFileSet = new Set(beforeFileSet);
    const beforeMap = {};
    const postMap = {};
    Object.keys(repoContentMap || {}).forEach(path => {
      const key = normalizeRepoPath(path);
      beforeMap[key] = String(repoContentMap[path] || "");
      postMap[key] = String(repoContentMap[path] || "");
    });

    const changedPaths = new Set();
    for (const c of previewData.changes) {
      const path = normalizeRepoPath(c && c.path);
      if (!path) continue;
      changedPaths.add(path);
      if (c.action === "delete") {
        afterFileSet.delete(path);
        delete postMap[path];
      } else {
        afterFileSet.add(path);
        postMap[path] = String(c && c.content !== undefined ? c.content : postMap[path] || "");
      }
    }

    for (const [path, source] of Object.entries(postMap)) {
      if (!/\.(?:tsx?|jsx?|mjs|cjs)$/i.test(path)) continue;
      const beforeSource = Object.prototype.hasOwnProperty.call(beforeMap, path) ? beforeMap[path] : "";
      const beforeSpecs = new Set(extractRelativeImports(beforeSource).map(normalizeLocalImportSpecifier).filter(Boolean));

      for (const spec of extractRelativeImports(source)) {
        if (resolveRepoImport(path, spec, afterFileSet)) continue;

        const normalizedSpec = normalizeLocalImportSpecifier(spec);
        const existedBefore = beforeSpecs.has(normalizedSpec);
        const resolvedBefore = existedBefore ? resolveRepoImport(path, spec, beforeFileSet) : "";

        // If this import used to resolve and does not now, this job broke it (usually
        // by deleting/renaming its target), so blocking is correct even in old projects.
        if (resolvedBefore) {
          throw new Error(`Project consistency check failed for ${path}: local import ${spec} was broken by the current change. No GitHub commit was made.`);
        }

        // For a new import introduced by a changed/new file, block only when we have
        // a reliable repository tree. If the GitHub tree timed out, absence from an
        // empty/partial map is not proof the file is missing; allow the job rather than
        // create a false positive on an older/large repository.
        if (changedPaths.has(path) && !existedBefore && treeTrusted) {
          throw new Error(`Project consistency check failed for ${path}: new local import ${spec} does not resolve to a repository file. No GitHub commit was made.`);
        }

        // Pre-existing unresolved imports are legacy project state. Do not block an
        // unrelated edit because an old project uses a generated/bundler-specific path.
      }
    }
    return previewData;
  }

  function tanStackRoutePatternFromFile(path) {
    const p = normalizeRepoPath(path);
    if (!/^src\/routes\//i.test(p) || /(?:^|\/)__root\.(?:tsx?|jsx?)$/i.test(p) || /routeTree\.gen\./i.test(p)) return "";
    let rel = p.replace(/^src\/routes\//i, "").replace(/\.(?:tsx?|jsx?)$/i, "");
    rel = rel.replace(/\/(?:index)$/i, "").replace(/(?:^|\.)index$/i, "");
    if (rel === "index" || !rel) return "/";
    rel = rel.replace(/\./g, "/");
    const parts = rel.split("/").filter(Boolean).filter(seg => !/^\(.+\)$/.test(seg) && !/^_/.test(seg));
    if (!parts.length) return "/";
    return "/" + parts.map(seg => seg.startsWith("$") ? ":param" : seg.replace(/\$$/, "")).join("/");
  }

  function collectKnownRoutePatterns(repoFiles, repoContentMap, previewData) {
    const patterns = new Set(["/"]);
    for (const path of (repoFiles || [])) {
      const pat = tanStackRoutePatternFromFile(path);
      if (pat) patterns.add(pat);
    }
    const scanContent = (text) => {
      const src = String(text || "");
      const re = /create(?:File|LazyFile)Route\(\s*["'`]([^"'`]+)["'`]\s*\)/g;
      let m;
      while ((m = re.exec(src))) if (m[1] && m[1].startsWith("/")) patterns.add(m[1].replace(/\$[^/]+/g, ":param"));
    };
    Object.values(repoContentMap || {}).forEach(scanContent);
    for (const c of (previewData && previewData.changes || [])) {
      const path = normalizeRepoPath(c && c.path);
      if (c && c.action !== "delete") {
        const pat = tanStackRoutePatternFromFile(path);
        if (pat) patterns.add(pat);
        scanContent(c && c.content);
      }
    }
    return Array.from(patterns);
  }

  function extractStaticNavigationTargets(source) {
    const text = String(source || "");
    const out = [];
    const regexes = [
      /<Link\b[^>]*\bto\s*=\s*["']([^"']+)["'][^>]*>/g,
      /\bnavigate\s*\(\s*\{[^}]*\bto\s*:\s*["']([^"']+)["'][^}]*\}\s*\)/g,
      /\bto\s*:\s*["'](\/[^"']+)["']/g
    ];
    for (const re of regexes) {
      let m;
      while ((m = re.exec(text))) {
        const target = String(m[1] || "").trim();
        if (target && target.startsWith("/") && !target.startsWith("//") && !out.includes(target)) out.push(target);
      }
    }
    return out;
  }

  function routeTargetMatchesKnown(target, patterns) {
    const clean = String(target || "").split(/[?#]/)[0].replace(/\/$/, "") || "/";
    for (const pattern of patterns || []) {
      const p = String(pattern || "").replace(/\/$/, "") || "/";
      if (p === clean) return true;
      const esc = p.split("/").map(seg => seg === ":param" || seg.startsWith("$") ? "[^/]+" : seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("/");
      try { if (new RegExp(`^${esc}/?$`).test(clean)) return true; } catch (_) {}
    }
    return false;
  }

  function validateNavigationRouteSafety(previewData, repoContentMap, repoFiles, prompt) {
    if (!previewData || !Array.isArray(previewData.changes)) return previewData;
    const isTanStack = (repoFiles || []).some(p => /src\/routes\/(?:__root|index)|routeTree\.gen/i.test(String(p || "")));
    if (!isTanStack) return previewData;
    const patterns = collectKnownRoutePatterns(repoFiles, repoContentMap, previewData);
    for (const c of previewData.changes) {
      if (!c || c.action === "delete") continue;
      const path = normalizeRepoPath(c.path);
      const before = String((repoContentMap || {})[path] || "");
      const after = String(c.content || "");
      const oldTargets = new Set(extractStaticNavigationTargets(before));
      for (const target of extractStaticNavigationTargets(after)) {
        if (oldTargets.has(target)) continue; // legacy route state was not introduced by this job
        if (!routeTargetMatchesKnown(target, patterns)) {
          throw new Error(`Navigation route safety failed for ${path}: the new navigation target ${target} does not match any existing TanStack route and this change did not create that route. No GitHub commit was made.`);
        }
      }
    }
    return previewData;
  }

  function validateNavigationImplementationSafety(previewData, repoContentMap, repoFiles, prompt) {
    if (!isNavigationFeaturePrompt(prompt) || !previewData || !Array.isArray(previewData.changes)) return previewData;
    const request = String(prompt || "").toLowerCase();
    const explicitProviderIntent = /\b(shadcn|sidebarprovider|ui\/sidebar|global sidebar|root layout|all pages|app shell)\b/.test(request);
    const byPath = {};
    Object.keys(repoContentMap || {}).forEach(p => { byPath[normalizeRepoPath(p)] = String(repoContentMap[p] || ""); });
    for (const c of previewData.changes) {
      const path = normalizeRepoPath(c && c.path);
      if (!path) continue;
      if (c.action === "delete") delete byPath[path]; else byPath[path] = String(c && c.content || "");
    }
    const rootPath = Object.keys(byPath).find(p => /^src\/routes\/__root\.(?:tsx?|jsx?)$/i.test(p));
    const indexPath = Object.keys(byPath).find(p => /^src\/routes\/index\.(?:tsx?|jsx?)$/i.test(p));
    const rootBefore = rootPath ? String((repoContentMap || {})[rootPath] || "") : "";
    const rootAfter = rootPath ? String(byPath[rootPath] || "") : "";
    const indexAfter = indexPath ? String(byPath[indexPath] || "") : "";

    if (rootPath && !explicitProviderIntent) {
      const introducedSidebarProvider = !/SidebarProvider|@\/components\/ui\/sidebar|useIsMobile/.test(rootBefore) && /SidebarProvider|@\/components\/ui\/sidebar|useIsMobile/.test(rootAfter);
      if (introducedSidebarProvider) {
        throw new Error(`Navigation safety failed for ${rootPath}: a simple navigation request introduced a new framework-level SidebarProvider/useIsMobile implementation in the root layout. Use the existing layout or a simple JSX/Tailwind sidebar unless the user explicitly requests a global provider architecture.`);
      }
    }
    if (rootPath && indexPath) {
      const rootHasSidebar = /<Sidebar\b|SidebarProvider|@\/components\/ui\/sidebar/.test(rootAfter);
      const pageHasSidebar = /<Sidebar\b|SidebarProvider|@\/components\/ui\/sidebar|<aside\b/i.test(indexAfter);
      const beforeRootHasSidebar = /<Sidebar\b|SidebarProvider|@\/components\/ui\/sidebar/.test(rootBefore);
      if (rootHasSidebar && pageHasSidebar && !beforeRootHasSidebar && !/\b(two sidebars|nested sidebar|secondary sidebar)\b/.test(request)) {
        throw new Error("Navigation safety failed: the generated change would create sidebar/navigation implementations in both the root layout and the rendered page. Keep one navigation owner and preserve the existing app structure.");
      }
      if (/<Outlet\s*\/?>/.test(rootBefore) && !/<Outlet\s*\/?>/.test(rootAfter)) {
        throw new Error(`Navigation safety failed for ${rootPath}: the existing TanStack <Outlet /> was removed, which would break child routes.`);
      }
    }
    return previewData;
  }

  function validateCommonFeatureCompletion(previewData, repoContentMap, prompt) {
    if (!previewData || !Array.isArray(previewData.changes)) return previewData;
    const q = String(prompt || "").toLowerCase();
    const changedText = previewData.changes.filter(c => c && c.action !== "delete").map(c => String(c.content || "")).join("\n");
    if (/\b(dark|light)\s*(?:and|&|\/)?\s*(?:light|dark)?\s*(?:mode|theme)|theme\s*(?:toggle|switch)|dark\s*mode\b/.test(q)) {
      const hasThemeLogic = /toggleTheme|setTheme|darkMode|classList\.(?:add|remove|toggle)|document\.documentElement|ThemeProvider/i.test(changedText);
      const hasVisibleControl = /<(?:button|Switch|Toggle)\b[\s\S]{0,500}(?:theme|dark|light|Moon|Sun)|(?:Moon|Sun)[\s\S]{0,300}<(?:button|Switch|Toggle)\b/i.test(changedText);
      if (!hasThemeLogic || !hasVisibleControl) {
        throw new Error("Feature completion check failed: dark/light mode requires both real theme-switching logic and a visible user toggle/control. No GitHub commit was made.");
      }
    }
    return previewData;
  }

  function shouldRunConsistencyReview(mode, prompt, architectureRules, scope) {
    const m = String(mode || "smart").toLowerCase();
    // v32.1.1: "Smart" means deterministic/local checks only. The previous Smart
    // mode made a second AI call, sometimes on a truncated copy of a good file,
    // then replaced the good output with a smaller "repair". That wasted credits
    // and reduced feature completeness. Only an explicit "Always" setting may call
    // the AI reviewer now, and even that reviewer is advisory only.
    return m === "always";
  }

  function parseSmallJsonObject(text) {
    const raw = String(text || "").replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
    try { return JSON.parse(raw); } catch (_) {}
    const first = raw.indexOf("{");
    const last = raw.lastIndexOf("}");
    if (first >= 0 && last > first) { try { return JSON.parse(raw.slice(first, last + 1)); } catch (_) {} }
    return null;
  }

  function applyPatchChanges(previewData, repoContentMap) {
    if (!previewData || !Array.isArray(previewData.changes)) return previewData;

    // One model response can contain several sequential patches for the same file.
    // Apply them to a working per-path buffer and emit exactly ONE final change per
    // repository path. Previously every patch restarted from the original GitHub
    // content, producing duplicate tree entries and false post-commit mismatches.
    const working = new Map();
    const finalMeta = new Map();
    const order = [];

    function remember(path) {
      if (!order.includes(path)) order.push(path);
      if (!working.has(path) && typeof repoContentMap[path] === "string") working.set(path, String(repoContentMap[path]));
    }

    for (const change of previewData.changes) {
      const path = String(change && change.path || "").replace(/^\.\//, "").replace(/^\//, "");
      if (!path) continue;
      remember(path);

      if (change.action === "delete") {
        working.delete(path);
        finalMeta.set(path, { action: "delete" });
        continue;
      }

      if (Array.isArray(change.replacements) && change.replacements.length) {
        let content = working.has(path) ? working.get(path) : repoContentMap[path];
        if (typeof content !== "string") {
          throw new Error(`Could not load ${path} from GitHub for a safe patch. The extension will auto-fetch missing patch files before applying them; please retry if this persists.`);
        }
        for (const rep of change.replacements) {
          const search = String(rep && rep.search !== undefined ? rep.search : "");
          const replace = String(rep && rep.replace !== undefined ? rep.replace : "");
          if (!search) continue;

          let idx = content.indexOf(search);
          if (idx >= 0) {
            content = content.slice(0, idx) + replace + content.slice(idx + search.length);
            continue;
          }

          const normalizedContent = content.replace(/\r\n/g, "\n");
          const normalizedSearch = search.replace(/\r\n/g, "\n");
          idx = normalizedContent.indexOf(normalizedSearch);
          if (idx >= 0) {
            content = normalizedContent.slice(0, idx) + replace.replace(/\r\n/g, "\n") + normalizedContent.slice(idx + normalizedSearch.length);
            continue;
          }

          const range = findUniqueWhitespaceNormalizedRange(content, search);
          if (range) {
            content = content.slice(0, range.start) + replace + content.slice(range.end);
            continue;
          }

          throw new Error(`Patch could not be safely matched in ${path}. The target block is different from the latest GitHub file. Please retry the same prompt; no GitHub commit was made.`);
        }
        working.set(path, content);
        finalMeta.set(path, { action: change.action || "update" });
      } else if (change.content !== undefined && change.content !== null) {
        working.set(path, String(change.content));
        finalMeta.set(path, { action: change.action || "update" });
      }
    }

    const out = [];
    for (const path of order) {
      const meta = finalMeta.get(path);
      if (!meta) continue;
      if (meta.action === "delete") out.push({ path, action: "delete" });
      else out.push({ path, action: meta.action || "update", content: String(working.get(path) || "") });
    }
    return Object.assign({}, previewData, { changes: out });
  }

  async function ensurePatchTargetContents(previewData, repoContentMap, config, maxContextChars, hud) {
    if (!previewData || !Array.isArray(previewData.changes)) return;
    // Re-fetch ALL existing target files immediately before applying. This prevents
    // stale patches when GitHub/Lovable changed a file after the first context read.
    const targets = [];
    for (const change of previewData.changes) {
      const path = String(change.path || "").replace(/^\.\//, "").replace(/^\//, "");
      if (!path) continue;
      if (!targets.includes(path)) targets.push(path);
    }
    if (!targets.length) return;
    if (hud) hud.appendLog(`Refreshing ${targets.length} target file(s) from latest GitHub HEAD before applying...`, "#38bdf8");
    const contentRes = await Promise.race([
      callBackground({
        action: "bundlee_git_127hub_github_get_files",
        repository: config.repository,
        branch: config.branch || "main",
        token: config.github_token,
        paths: targets.slice(0, 8),
        maxTotalChars: Math.max(12000, Math.min(60000, Number(maxContextChars || 18000) * 2))
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Latest target file fetch timeout")), 15000))
    ]);
    if (contentRes && contentRes.ok && Array.isArray(contentRes.files)) {
      contentRes.files.forEach(f => {
        if (f && f.path && typeof f.content === "string") repoContentMap[f.path] = f.content;
      });
      if (hud) hud.appendLog(`Latest GitHub contents loaded for ${contentRes.files.length}/${targets.length} target file(s)`, "#10b981");
    }
  }

  function countOccurrences(text, re) {
    const m = String(text || "").match(re);
    return m ? m.length : 0;
  }

  async function findCriticalBaselineSyntaxIssues(repoContextFiles) {
    const rows = Array.isArray(repoContextFiles) ? repoContextFiles : [];
    const critical = rows.filter((f, idx) => {
      const p = normalizeRepoPath(f && f.path);
      return idx === 0 || /^src\/(?:routes\/(?:index|__root)|App|main)\.(?:tsx?|jsx?)$/i.test(p);
    }).slice(0, 5);
    const issues = [];
    for (const f of critical) {
      const path = normalizeRepoPath(f && f.path);
      const source = String(f && f.content || "");
      if (!path || !/\.(?:tsx?|jsx?|mjs|cjs)$/i.test(path) || !source.trim()) continue;
      let syntaxResult = null;
      try { syntaxResult = await callBackground({ action: "bundlee_git_lovable_validate_source", path, source }); } catch (_) {}
      const balance = scanSourceBalance(source);
      if ((syntaxResult && syntaxResult.ok === false) || !balance.ok) {
        issues.push({
          path,
          line: syntaxResult && syntaxResult.line || null,
          column: syntaxResult && syntaxResult.column || null,
          error: syntaxResult && syntaxResult.error || balance.reason || "existing source is structurally incomplete"
        });
      }
    }
    return issues;
  }

  async function validateCriticalBaselineAfterChanges(previewData, repoContentMap) {
    if (!previewData || !Array.isArray(previewData.changes)) return previewData;
    const post = {};
    Object.keys(repoContentMap || {}).forEach(p => { post[normalizeRepoPath(p)] = String(repoContentMap[p] || ""); });
    for (const c of previewData.changes) {
      const path = normalizeRepoPath(c && c.path);
      if (!path) continue;
      if (c.action === "delete") delete post[path]; else post[path] = String(c && c.content || "");
    }
    const criticalPaths = Object.keys(post).filter(p => /^src\/(?:routes\/(?:index|__root)|App|main)\.(?:tsx?|jsx?)$/i.test(p));
    for (const path of criticalPaths) {
      const source = String(post[path] || "");
      if (!source.trim()) continue;
      let syntaxResult = null;
      try { syntaxResult = await callBackground({ action: "bundlee_git_lovable_validate_source", path, source }); } catch (_) {}
      const balance = scanSourceBalance(source);
      if ((syntaxResult && syntaxResult.ok === false) || !balance.ok) {
        const where = syntaxResult && syntaxResult.line ? ` at line ${syntaxResult.line}${syntaxResult.column ? `, column ${syntaxResult.column}` : ""}` : "";
        const detail = syntaxResult && syntaxResult.error || balance.reason || "source is structurally incomplete";
        throw new Error(`Baseline project syntax check failed for ${path}${where}: ${String(detail).replace(/\s+/g, " ").trim()}. The project must be buildable before this feature can be committed.`);
      }
    }
    return previewData;
  }

  function looksLikeJsonImplementationEnvelope(text) {
    let s = String(text || "").trim();
    if (/^```json\b/i.test(s)) s = s.replace(/^```json\s*/i, "").replace(/\s*```\s*$/i, "");
    return s.startsWith("{") || s.startsWith("[") || /^"(?:summary|changes|files|path|file|replacements)"\s*:/.test(s);
  }

  function validateChangePlanShape(previewData) {
    if (!previewData || !Array.isArray(previewData.changes)) return previewData;
    for (const change of previewData.changes) {
      const path = String(change && change.path || "").replace(/^\.\//, "").replace(/^\//, "");
      if (!path) throw new Error("AI response validation failed: a changed file is missing its path.");
      const hasContent = change.content !== undefined && change.content !== null && String(change.content).length > 0;
      const reps = Array.isArray(change.replacements) ? change.replacements : [];
      if (!hasContent && !reps.length) {
        throw new Error(`AI response validation failed for ${path}: no file content or replacements were returned.`);
      }
      for (const rep of reps) {
        if (!rep || typeof rep.search !== "string" || !rep.search.length || typeof rep.replace !== "string") {
          throw new Error(`AI response validation failed for ${path}: an incomplete search/replace patch was returned.`);
        }
      }
    }
    return previewData;
  }

  function scanSourceBalance(source) {
    const text = String(source || "");
    const stack = [];
    let quote = "";
    let escaped = false;
    let lineComment = false;
    let blockComment = false;
    let regexLiteral = false;
    let regexClass = false;

    function previousNonWhitespace(index) {
      for (let j = index - 1; j >= 0; j--) if (!/\s/.test(text[j])) return text[j];
      return "";
    }
    function quoteCanStart(index, ch) {
      if (ch === "`") return true;
      const prev = previousNonWhitespace(index);
      if (!prev || /[=(:,\[{!?&|;+*\/%<>-]/.test(prev)) return true;
      const prefix = text.slice(Math.max(0, index - 28), index);
      return /\b(?:return|throw|case|yield|await|from|import|export)\s*$/.test(prefix);
    }
    function regexCanStart(index) {
      const prev = previousNonWhitespace(index);
      if (!prev || /[=(:,\[{!?&|;+*\/%<>-]/.test(prev)) return true;
      const prefix = text.slice(Math.max(0, index - 24), index);
      return /\b(?:return|case|throw)\s*$/.test(prefix);
    }

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i + 1] || "";
      if (lineComment) {
        if (ch === "\n") lineComment = false;
        continue;
      }
      if (blockComment) {
        if (ch === "*" && next === "/") { blockComment = false; i++; }
        continue;
      }
      if (regexLiteral) {
        if (escaped) { escaped = false; continue; }
        if (ch === "\\") { escaped = true; continue; }
        if (ch === "[" && !regexClass) { regexClass = true; continue; }
        if (ch === "]" && regexClass) { regexClass = false; continue; }
        if (ch === "/" && !regexClass) { regexLiteral = false; continue; }
        continue;
      }
      if (quote) {
        if (escaped) { escaped = false; continue; }
        if (ch === "\\") { escaped = true; continue; }
        if (ch === quote) { quote = ""; continue; }
        continue;
      }
      if (ch === "/" && next === "/") { lineComment = true; i++; continue; }
      if (ch === "/" && next === "*") { blockComment = true; i++; continue; }
      if (ch === "/" && !(previousNonWhitespace(i) === "<" && /[A-Za-z>]/.test(next)) && regexCanStart(i)) { regexLiteral = true; regexClass = false; continue; }
      if ((ch === '"' || ch === "'" || ch === "`") && quoteCanStart(i, ch)) { quote = ch; continue; }
      if (ch === "(" || ch === "[" || ch === "{") stack.push(ch);
      else if (ch === ")" || ch === "]" || ch === "}") {
        const expected = ch === ")" ? "(" : (ch === "]" ? "[" : "{");
        if (stack.pop() !== expected) return { ok: false, reason: `unbalanced ${ch}` };
      }
    }
    if (quote) return { ok: false, reason: "unterminated string/template literal" };
    if (regexLiteral) return { ok: false, reason: "unterminated regular expression" };
    if (blockComment) return { ok: false, reason: "unterminated block comment" };
    if (stack.length) return { ok: false, reason: `unclosed ${stack[stack.length - 1]}` };
    return { ok: true, reason: "" };
  }

  function normalizeVisionAttachments(attachments) {
    const out = [];
    const seen = new Set();
    for (const raw of (Array.isArray(attachments) ? attachments : [])) {
      if (!raw || typeof raw !== "object" || out.length >= 4) continue;
      const name = String(raw.name || raw.file_name || raw.filename || `image-${out.length + 1}`);
      const mime = String(raw.mime || raw.mime_type || raw.content_type || "").toLowerCase();
      const dataUrl = String(raw.dataUrl || raw.data_url || "").trim();
      const url = String(raw.url || raw.file_url || raw.public_url || raw.download_url || "").trim();
      const source = /^data:image\/(?:png|jpe?g|webp|gif);base64,/i.test(dataUrl)
        ? dataUrl
        : (/^https?:\/\//i.test(url) ? url : "");
      if (!source || seen.has(source)) continue;
      seen.add(source);
      out.push({ name, mime: mime || "image/jpeg", source });
    }
    return out;
  }

  function buildVisionUserContent(text, attachments) {
    const images = normalizeVisionAttachments(attachments);
    if (!images.length) return String(text || "");
    const parts = [];
    images.forEach((image, index) => {
      parts.push({ type: "text", text: `Attached visual reference ${index + 1}: ${image.name}. Inspect this image before editing the project.` });
      parts.push({ type: "image_url", image_url: { url: image.source, detail: "high" } });
    });
    parts.push({ type: "text", text: String(text || "") });
    return parts;
  }

  function isImageSensitivePrompt(prompt) {
    return /\b(image|images|photo|photos|picture|pictures|thumbnail|thumbnails|hero image|banner image|product image|product images|broken image|broken images|image url|image urls|screenshot|visual reference)\b/i.test(String(prompt || ""));
  }

  function explicitlyAllowsImageReplacement(prompt) {
    const text = String(prompt || "").toLowerCase();
    return /\b(replace|change|swap|update|fix|repair|correct|use|choose|find|make).{0,45}\b(image|images|photo|photos|picture|pictures|thumbnail|thumbnails)\b/.test(text) ||
      /\b(image|images|photo|photos|picture|pictures|thumbnail|thumbnails)\b.{0,45}\b(replace|change|swap|update|fix|repair|correct|use|relevant|appropriate)\b/.test(text);
  }

  function extractImageReferences(source) {
    const text = String(source || "");
    const refs = [];
    const seen = new Set();
    const push = (value) => {
      let v = String(value || "").trim().replace(/&amp;/g, "&");
      if (!v || seen.has(v)) return;
      if (/^(?:javascript:|#)/i.test(v)) return;
      seen.add(v);
      refs.push(v);
    };
    const prop = /(?:\bsrc|\bimage|\bimageUrl|\bimage_url|\bthumbnail|\bthumbnailUrl|\bposter|\bbackgroundImage)\s*[:=]\s*(?:\{\s*)?["'`]([^"'`]+)["'`]/gi;
    let m;
    while ((m = prop.exec(text))) push(m[1]);
    const css = /url\(\s*["']?([^"')]+)["']?\s*\)/gi;
    while ((m = css.exec(text))) push(m[1]);
    return refs;
  }

  function remoteImageReferences(source) {
    return extractImageReferences(source).filter(v => /^https?:\/\//i.test(v));
  }

  function looksLikeLocalImageReference(value) {
    const v = String(value || "").trim();
    if (!v || /^(?:https?:|data:|blob:|javascript:|#)/i.test(v)) return false;
    if (/[{}$]/.test(v)) return false;
    return /\.(?:png|jpe?g|webp|gif|svg|avif|bmp)(?:[?#].*)?$/i.test(v);
  }

  function normalizeRepoPath(path) {
    const parts = [];
    String(path || "").replace(/\\/g, "/").split("/").forEach(part => {
      if (!part || part === ".") return;
      if (part === "..") parts.pop();
      else parts.push(part);
    });
    return parts.join("/");
  }

  function resolveLocalImagePath(ref, sourcePath, repoFilesSet) {
    let value = String(ref || "").split(/[?#]/)[0].trim();
    if (!looksLikeLocalImageReference(value)) return { relevant: false, exists: true, path: "" };
    const candidates = [];
    if (value.startsWith("@/")) candidates.push("src/" + value.slice(2));
    else if (value.startsWith("/")) {
      candidates.push("public/" + value.replace(/^\/+/, ""));
      candidates.push(value.replace(/^\/+/, ""));
    } else {
      const base = String(sourcePath || "").replace(/\\/g, "/").split("/").slice(0, -1).join("/");
      candidates.push(normalizeRepoPath((base ? base + "/" : "") + value));
      candidates.push(normalizeRepoPath(value));
      if (!value.startsWith("src/")) candidates.push(normalizeRepoPath("src/" + value));
    }
    const path = candidates.find(candidate => repoFilesSet.has(candidate));
    return { relevant: true, exists: !!path, path: path || candidates[0] || value };
  }

  function imageSafetyState(config, repository) {
    const all = config && config.image_safety_by_repo && typeof config.image_safety_by_repo === "object" ? config.image_safety_by_repo : {};
    const state = all[String(repository || "")] || {};
    return {
      broken: Array.isArray(state.broken) ? state.broken.map(String).filter(Boolean).slice(-40) : [],
      updatedAt: Number(state.updatedAt || 0)
    };
  }

  function rememberBrokenImages(config, repository, urls) {
    const values = (Array.isArray(urls) ? urls : []).map(v => String(v || "").trim()).filter(Boolean);
    if (!values.length || !repository) return;
    const all = Object.assign({}, config && config.image_safety_by_repo || {});
    const current = imageSafetyState(config || {}, repository);
    all[String(repository)] = { broken: Array.from(new Set(current.broken.concat(values))).slice(-40), updatedAt: Date.now() };
    saveGitConfig({ image_safety_by_repo: all });
    if (config && typeof config === "object") config.image_safety_by_repo = all;
  }

  async function auditCurrentProjectImages(repoContextFiles, prompt, config, hud, repoFiles) {
    const known = imageSafetyState(config || {}, config && config.repository).broken;
    const repoFilesSet = new Set((Array.isArray(repoFiles) ? repoFiles : []).map(v => normalizeRepoPath(v)));
    if (!isImageSensitivePrompt(prompt)) return { enabled: false, working: [], broken: known, checked: [], localWorking: [], localBroken: [], repoFiles: Array.from(repoFilesSet) };

    const urls = Array.from(new Set((Array.isArray(repoContextFiles) ? repoContextFiles : []).flatMap(f => remoteImageReferences(f && f.content)))).slice(0, 12);
    const localWorking = [];
    const localBroken = [];
    for (const file of (Array.isArray(repoContextFiles) ? repoContextFiles : [])) {
      for (const ref of extractImageReferences(file && file.content)) {
        if (!looksLikeLocalImageReference(ref)) continue;
        const resolved = resolveLocalImagePath(ref, file && file.path, repoFilesSet);
        if (!resolved.relevant) continue;
        if (resolved.exists) localWorking.push(ref);
        else localBroken.push(ref);
      }
    }
    if (localBroken.length) rememberBrokenImages(config, config.repository, localBroken);

    let rows = [];
    try {
      if (urls.length) {
        const result = await callBackground({ action: "bundlee_git_lovable_validate_image_urls", urls });
        rows = result && Array.isArray(result.results) ? result.results : [];
      }
      const brokenNow = rows.filter(r => !r.ok).map(r => r.url);
      const working = rows.filter(r => r.ok).map(r => r.url);
      if (brokenNow.length) rememberBrokenImages(config, config.repository, brokenNow);
      const totalBroken = Array.from(new Set(known.concat(brokenNow, localBroken)));
      if (hud) {
        if (brokenNow.length || localBroken.length) hud.appendLog(`Image audit: ${brokenNow.length + localBroken.length} broken image reference${brokenNow.length + localBroken.length === 1 ? "" : "s"} identified; working images will be preserved.`, "#f59e0b");
        else if (working.length || localWorking.length) hud.appendLog(`Image audit: ${working.length + localWorking.length} existing image reference${working.length + localWorking.length === 1 ? "" : "s"} checked.`, "#10b981");
      }
      return { enabled: true, working, broken: totalBroken, checked: rows, localWorking: Array.from(new Set(localWorking)), localBroken: Array.from(new Set(localBroken)), repoFiles: Array.from(repoFilesSet) };
    } catch (err) {
      if (hud) hud.appendLog("Image audit could not verify some remote images; local asset paths and existing image preservation are still enforced.", "#f59e0b");
      return { enabled: true, working: [], broken: Array.from(new Set(known.concat(localBroken))), checked: [], localWorking: Array.from(new Set(localWorking)), localBroken: Array.from(new Set(localBroken)), repoFiles: Array.from(repoFilesSet) };
    }
  }

  function buildImageSafetyContext(prompt, audit, attachments, repoFiles) {
    const vision = normalizeVisionAttachments(attachments);
    const localAssets = (Array.isArray(repoFiles) ? repoFiles : []).filter(path => /\.(png|jpe?g|webp|gif|svg|avif)$/i.test(String(path || ""))).slice(0, 30);
    const broken = audit && Array.isArray(audit.broken) ? audit.broken : [];
    const working = audit && Array.isArray(audit.working) ? audit.working : [];
    const localBroken = audit && Array.isArray(audit.localBroken) ? audit.localBroken : [];
    if (!isImageSensitivePrompt(prompt) && !vision.length && !broken.length) return "";
    return `IMAGE SAFETY CONTEXT:\n` +
      `- Attached visual references: ${vision.length ? vision.map(v => v.name).join(", ") : "none"}.\n` +
      `- Known/confirmed broken image references/URLs (NEVER reuse these): ${broken.length ? broken.join(" | ") : "none"}.\n` +
      `- Confirmed working existing remote image URLs (preserve unless the user explicitly asked to replace that image): ${working.length ? working.join(" | ") : "none checked"}.\n` +
      `- Existing local image assets visible in the repository map: ${localAssets.length ? localAssets.join(", ") : "none found"}.\n` +
      `Rules: change only the images the user actually asked about. Never restore a known broken URL. Never invent an arbitrary photo/CDN URL just to make an <img> render. Keep each product name/alt text paired with a semantically matching image. Prefer an existing relevant local asset or an explicit URL/image supplied by the user. If no trustworthy relevant photo exists, use a neutral labeled visual fallback rather than a misleading unrelated product photo. Do not embed attached base64 image data inside project source.`;
  }

  async function validateImageSafety(previewData, repoContentMap, prompt, audit, config) {
    if (!previewData || !Array.isArray(previewData.changes)) return previewData;
    const sensitive = isImageSensitivePrompt(prompt);
    const allowReplace = explicitlyAllowsImageReplacement(prompt);
    const knownBroken = new Set((audit && audit.broken || []).concat(imageSafetyState(config || {}, config && config.repository).broken || []));
    const knownWorking = new Set(audit && audit.working || []);
    const knownLocalWorking = new Set(audit && audit.localWorking || []);
    const toCheck = new Set();
    const availableFiles = new Set((audit && audit.repoFiles || []).map(v => normalizeRepoPath(v)));
    for (const c of previewData.changes) {
      const p = normalizeRepoPath(c && c.path);
      if (p && c && c.action !== "delete") availableFiles.add(p);
    }

    for (const change of previewData.changes) {
      const path = String(change && change.path || "").replace(/^\.\//, "").replace(/^\//, "");
      if (!/\.(tsx|jsx|js|ts|html|css|vue|svelte)$/i.test(path)) continue;
      const before = typeof repoContentMap[path] === "string" ? repoContentMap[path] : "";
      const after = String(change && change.content !== undefined ? change.content : "");
      if (!after) continue;

      if (!/data:image\/(?:png|jpe?g|webp|gif);base64,/i.test(before) && /data:image\/(?:png|jpe?g|webp|gif);base64,/i.test(after)) {
        throw new Error(`Image safety check failed for ${path}: the AI tried to embed a large base64 image directly in source code. Attachments are visual references, not source-code blobs.`);
      }

      const beforeRefs = extractImageReferences(before);
      const beforeUrls = beforeRefs.filter(v => /^https?:\/\//i.test(v));
      const afterUrls = remoteImageReferences(after);
      const afterSet = new Set(afterUrls);
      const afterRefs = extractImageReferences(after);
      const afterRefsSet = new Set(afterRefs);

      for (const ref of afterRefs) {
        if (knownBroken.has(ref)) {
          throw new Error(`Image safety check failed for ${path}: the AI tried to restore an image reference already confirmed broken: ${ref}`);
        }
        if (looksLikeLocalImageReference(ref)) {
          const resolved = resolveLocalImagePath(ref, path, availableFiles);
          if (resolved.relevant && !resolved.exists) {
            rememberBrokenImages(config, config.repository, [ref]);
            throw new Error(`Image safety check failed for ${path}: generated local image path does not exist in the repository: ${ref}. Use an existing asset or a neutral fallback.`);
          }
        }
      }

      for (const url of afterUrls) {
        if (knownBroken.has(url)) {
          throw new Error(`Image safety check failed for ${path}: the AI tried to restore a URL already confirmed broken: ${url}`);
        }
      }

      // Ordinary edits must never silently replace working images. For image-fix
      // prompts, preserve every image we positively verified as working and let the
      // model touch only broken/requested images.
      if (!allowReplace || (sensitive && audit && audit.enabled)) {
        for (const url of beforeUrls) {
          if (knownWorking.has(url) && !afterSet.has(url) && !allowReplace) {
            throw new Error(`Image safety check failed for ${path}: a working existing image was changed even though the user did not ask to replace it.`);
          }
        }
        for (const ref of beforeRefs) {
          if (knownLocalWorking.has(ref) && !afterRefsSet.has(ref) && !allowReplace) {
            throw new Error(`Image safety check failed for ${path}: a working local image was changed even though the user did not ask to replace it.`);
          }
        }
      }

      if (sensitive) afterUrls.forEach(url => toCheck.add(url));
      else afterUrls.filter(url => !beforeUrls.includes(url)).forEach(url => toCheck.add(url));
    }

    const urls = Array.from(toCheck).slice(0, 16);
    if (urls.length) {
      const result = await callBackground({ action: "bundlee_git_lovable_validate_image_urls", urls });
      const rows = result && Array.isArray(result.results) ? result.results : [];
      const bad = rows.filter(r => !r.ok);
      if (bad.length) {
        rememberBrokenImages(config, config.repository, bad.map(r => r.url));
        const detail = bad.slice(0, 3).map(r => `${r.url} (${r.reason || "unreachable"})`).join("; ");
        throw new Error(`Image safety check failed: generated image URL${bad.length === 1 ? "" : "s"} did not load correctly: ${detail}. Never reuse these URLs.`);
      }
    }
    return previewData;
  }

  async function validateGeneratedCode(previewData, repoContentMap, prompt) {
    if (!previewData || !Array.isArray(previewData.changes)) return previewData;
    const request = String(prompt || "").toLowerCase();
    const buildPageIntent = /\b(create|build|make|generate|design|replace|complete)\b[\s\S]{0,80}\b(home|homepage|landing|website|site|store|shop|ecommerce|e-commerce|page)\b|\b(home|homepage|landing|website|store|shop|ecommerce|e-commerce)\b[\s\S]{0,60}\b(create|build|make|generate|design|complete)\b/.test(request);

    for (const change of previewData.changes) {
      const path = String(change && change.path || "").replace(/^\.\//, "").replace(/^\//, "");
      const after = String(change && change.content !== undefined ? change.content : "");
      const before = typeof repoContentMap[path] === "string" ? repoContentMap[path] : "";
      if (!after.trim()) throw new Error(`AI response validation failed for ${path}: generated file is empty.`);

      const beforeBlank = /data-lovable-blank-page-placeholder|blank-app-v1\.svg/i.test(before);
      const afterBlank = /data-lovable-blank-page-placeholder|blank-app-v1\.svg/i.test(after);
      if (buildPageIntent && beforeBlank && afterBlank) {
        throw new Error(`AI response validation failed for ${path}: the Lovable starter placeholder was not replaced.`);
      }

      if (/\.(?:json)$/i.test(path)) {
        try { JSON.parse(after); }
        catch (_) { throw new Error(`AI response validation failed for ${path}: generated JSON is incomplete or invalid.`); }
        continue;
      }

      if (!/\.(?:tsx|ts|jsx|js|mjs|cjs|html|css|vue|svelte)$/i.test(path)) continue;

      // Catch a common malformed-string pattern seen in provider output, e.g.:
      // name: "Vista Pro Tablet 12.9"",
      if (/(?:[:=]\s*)"[^"\n]{1,240}""\s*[,;}\]]|(?:[:=]\s*)'[^'\n]{1,240}''\s*[,;}\]]/.test(after)) {
        throw new Error(`AI response validation failed for ${path}: malformed quoted string detected.`);
      }

      if (/\.(?:tsx|ts|jsx|js|mjs|cjs)$/i.test(path)) {
        let syntaxResult;
        try {
          syntaxResult = await callBackground({
            action: "bundlee_git_lovable_validate_source",
            path,
            source: after
          });
        } catch (_) {
          syntaxResult = { ok: true, validatorUnavailable: true };
        }
        if (!syntaxResult || syntaxResult.ok !== true) {
          const where = syntaxResult && syntaxResult.line
            ? ` at line ${syntaxResult.line}${syntaxResult.column ? `, column ${syntaxResult.column}` : ""}`
            : "";
          const detail = syntaxResult && syntaxResult.error
            ? String(syntaxResult.error).replace(/\s+/g, " ").trim()
            : "generated source contains a syntax error";
          throw new Error(`AI response validation failed for ${path}${where}: ${detail}. No GitHub commit was made.`);
        }

        // v32.1.5 defense-in-depth: validate the fully reconstructed file locally
        // even when the background TypeScript parser reports success/unavailable.
        // This specifically catches patch-boundary damage such as a SEARCH/REPLACE
        // that accidentally removes the closing brace of a function. The previous
        // validator trusted {ok:true, validatorUnavailable:true}, allowing invalid
        // TSX to be committed and leaving Lovable unable to update its preview.
        const localBalance = scanSourceBalance(after);
        if (!localBalance.ok) {
          throw new Error(`AI response validation failed for ${path}: ${localBalance.reason}. The fully reconstructed file is structurally incomplete. No GitHub commit was made.`);
        }
      } else {
        const balance = scanSourceBalance(after);
        if (!balance.ok) {
          throw new Error(`AI response validation failed for ${path}: ${balance.reason}. The provider response may have been truncated.`);
        }
      }

      const trimmed = after.trim();
      if (/[<({\[,:=+\-*/.]$/.test(trimmed) || /<\/?[A-Za-z][A-Za-z0-9_.:-]*(?:\s+[A-Za-z_:][-A-Za-z0-9_:.]*(?:\s*=\s*(?:"[^"]*"|'[^']*'|\{[^}]*\}))?)*\s*$/.test(trimmed)) {
        throw new Error(`AI response validation failed for ${path}: generated source ends abruptly and appears truncated.`);
      }
    }
    return previewData;
  }

  function meaningfulLineRetention(before, after) {
    const clean = value => String(value || "").replace(/\r\n/g, "\n").split("\n")
      .map(line => line.trim())
      .filter(line => line.length >= 4 && !/^\/\/|^\*|^\{|^\}|^\);?$/.test(line));
    const oldLines = Array.from(new Set(clean(before)));
    if (!oldLines.length) return 1;
    const newText = String(after || "").replace(/\s+/g, " ");
    let kept = 0;
    for (const line of oldLines) {
      const compact = line.replace(/\s+/g, " ");
      if (newText.includes(compact)) kept++;
    }
    return kept / oldLines.length;
  }

  function validatePreservation(previewData, repoContentMap, prompt) {
    if (!previewData || !Array.isArray(previewData.changes)) return previewData;
    const request = String(prompt || "").toLowerCase();
    const destructiveIntent = /\b(remove|delete|hide|replace|rewrite|redesign|clear|strip|remove all|start over)\b/.test(request);
    const additiveIntent = /\b(add|include|create|build|extend|expand|more|another|section|homepage|website|page)\b/.test(request);
    const allowBlankTemplate = /\b(restore|revert|reset).{0,30}(blank|placeholder|starter|template)|\bblank.{0,20}(page|template|placeholder)\b/.test(request);

    for (const change of previewData.changes) {
      const path = String(change.path || "").replace(/^\.\//, "").replace(/^\//, "");
      if (/^(src\/)?routeTree\.gen\.ts$/i.test(path)) {
        throw new Error(`Safety check blocked editing generated router file ${path}. Lovable will edit the source route instead.`);
      }
      if (!path || !/\.(tsx|jsx|html|vue|svelte|css)$/i.test(path)) continue;
      const before = repoContentMap[path];
      const after = change && change.content;
      if (typeof before !== "string" || typeof after !== "string") continue;
      const isCriticalEntry = /^(?:src\/)?(?:routes\/(?:index|__root)|app|main)\.(?:tsx|jsx|ts|js)$/i.test(path);
      // Older TanStack/Lovable route wrappers can be tiny. Never skip semantic root
      // protection merely because the original file is under 120 characters.
      if (before.length < 120 && !isCriticalEntry) continue;

      // Never let an ordinary follow-up edit restore Lovable's blank starter page over
      // a real client page. This is the regression seen in public testing.
      const beforeBlank = /data-lovable-blank-page-placeholder|blank-app-v1\.svg/i.test(before);
      const afterBlank = /data-lovable-blank-page-placeholder|blank-app-v1\.svg/i.test(after);
      if (!beforeBlank && afterBlank && !allowBlankTemplate) {
        throw new Error(`Safety check stopped ${path} from reverting to Lovable's blank starter page. Your existing page was kept unchanged.`);
      }

      // Critical-route semantic guard. TanStack/Lovable starter routes can compile
      // perfectly while rendering only a debug fallback such as Hello "/"!. Syntax,
      // import and build checks cannot detect that semantic regression, so reject it
      // before GitHub whenever a real page is replaced by a known starter/debug view.
      if (isCriticalEntry) {
        const fallbackPattern = /data-lovable-blank-page-placeholder|blank-app-v1\.svg|(?:^|[>\s('"`])hello\s*(?:["'`]\s*\/\s*["'`]|\{?\s*(?:route\.)?(?:fullpath|path)\s*\}?)?\s*!?(?:[<\s)'"`]|$)|hello\s+world|(?:^|[>\s])(?:todo|placeholder|coming\s+soon)(?:[<\s.!]|$)/i;
        const beforeFallback = fallbackPattern.test(before);
        const afterFallback = fallbackPattern.test(after);
        const explicitFallbackIntent = /\b(hello(?:\s+world)?|placeholder|starter|debug\s+page|coming\s+soon|reset\s+(?:the\s+)?(?:home|homepage|root|route)|replace\s+(?:the\s+)?(?:home|homepage|root)\s+(?:with|by)\s+(?:a\s+)?(?:blank|starter|placeholder))\b/i.test(request);
        if (!beforeFallback && afterFallback && !explicitFallbackIntent && !allowBlankTemplate) {
          throw new Error(`Root route regression blocked in ${path}: the generated change would replace the working page with a starter/debug fallback (for example Hello "/"!). No GitHub commit was made.`);
        }

        // A targeted follow-up such as "add sidebar" or "change button" must retain
        // the semantic skeleton of a working root route, even when the file is only a
        // few lines long. This catches valid-but-wrong rewrites that still compile.
        const rootRewriteIntent = /\b(replace|rewrite|redesign|reset|rebuild|start\s+over)\b[\s\S]{0,40}\b(home|homepage|root|route|app|page)\b|\b(home|homepage|root|route|app|page)\b[\s\S]{0,40}\b(replace|rewrite|redesign|reset|rebuild|start\s+over)\b/i.test(request);
        const targetedFollowUp = /\b(add|fix|change|update|move|style|make|adjust|sidebar|navbar|navigation|button|text|color|spacing|image|card|section)\b/i.test(request) && !rootRewriteIntent;
        const retention = meaningfulLineRetention(before, after);
        if (!beforeFallback && targetedFollowUp && before.trim().length >= 40 && retention < 0.34) {
          throw new Error(`Root route regression blocked in ${path}: this targeted follow-up would discard most of the existing root-route logic. No GitHub commit was made.`);
        }

        // A non-destructive follow-up should not collapse a real root page to a tiny
        // route shell. This catches semantically empty rewrites even when they do not
        // use the exact starter text. Only apply it to critical entry files and only
        // when the request did not explicitly ask to replace/redesign/reset the page.
        const routeResetIntent = /\b(replace|rewrite|redesign|reset|rebuild|start\s+over)\b[\s\S]{0,40}\b(home|homepage|root|route|app|page)\b|\b(home|homepage|root|route|app|page)\b[\s\S]{0,40}\b(replace|rewrite|redesign|reset|rebuild|start\s+over)\b/i.test(request);
        const beforeLooksReal = !beforeFallback && (before.length >= 240 || /(?:from\s+["'][.@/]|<\s*[A-Z][A-Za-z0-9_.:-]*\b|createFileRoute\s*\()/i.test(before));
        const afterTiny = after.length < Math.max(180, before.length * 0.22);
        if (beforeLooksReal && afterTiny && !routeResetIntent && !destructiveIntent) {
          throw new Error(`Root route regression blocked in ${path}: a follow-up edit would collapse the existing page to a much smaller route shell. No GitHub commit was made.`);
        }
      }

      if (destructiveIntent) continue;

      // Only block obvious large-scale loss. A harmless refactor may move or remove
      // one image/reference while adding requested sections, so image count alone is
      // never a reason to reject a client edit.
      if (after.length < before.length * 0.45) {
        throw new Error(`Safety check stopped a destructive rewrite of ${path}: most existing content would disappear. Your project was left unchanged.`);
      }

      const beforeSections = countOccurrences(before, /<section\b/gi);
      const afterSections = countOccurrences(after, /<section\b/gi);
      if (additiveIntent && beforeSections > 0 && afterSections < beforeSections && after.length < before.length * 0.9) {
        throw new Error(`Safety check protected ${path}: an additive request would remove existing sections. Your project was left unchanged.`);
      }
    }
    return previewData;
  }

  async function verifyTargetsUnchangedSinceApply(previewData, baseContentMap, config, maxContextChars, hud) {
    if (!previewData || !Array.isArray(previewData.changes)) return;
    const targets = Array.from(new Set(previewData.changes
      .map(c => String(c.path || "").replace(/^\.\//, "").replace(/^\//, ""))
      .filter(Boolean)))
      .filter(path => typeof baseContentMap[path] === "string");
    if (!targets.length) return;

    const res = await Promise.race([
      callBackground({
        action: "bundlee_git_127hub_github_get_files",
        repository: config.repository,
        branch: config.branch || "main",
        token: config.github_token,
        paths: targets.slice(0, 8),
        maxTotalChars: Math.max(12000, Math.min(60000, Number(maxContextChars || 18000) * 2))
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Pre-commit freshness check timeout")), 15000))
    ]);

    if (!res || !res.ok || !Array.isArray(res.files)) return;
    for (const f of res.files) {
      if (!f || !f.path || typeof f.content !== "string") continue;
      if (typeof baseContentMap[f.path] === "string" && f.content !== baseContentMap[f.path]) {
        if (hud) hud.appendLog(`GitHub changed again while editing ${f.path}; commit cancelled to protect the latest client work.`, "#f59e0b");
        throw new Error(`The project changed while AI was preparing ${f.path}. No GitHub commit was made. Please retry the prompt; the latest client work was preserved.`);
      }
    }
  }

  async function verifyCommittedContents(previewData, config, maxContextChars, hud, committedSha) {
    if (!previewData || !Array.isArray(previewData.changes) || !previewData.changes.length) return { ok: true, checked: 0 };
    const expected = new Map();
    for (const change of previewData.changes) {
      const path = String(change && change.path || "").replace(/^\.\//, "").replace(/^\//, "");
      if (!path || change.action === "delete" || change.content === undefined || change.content === null) continue;
      expected.set(path, String(change.content));
    }
    if (!expected.size) return { ok: true, checked: 0 };

    const paths = Array.from(expected.keys()).slice(0, 8);
    const expectedChars = paths.reduce((n, path) => n + (expected.get(path) || "").length, 0);
    const delays = [0, 1200, 2600];
    const branch = config.branch || "main";
    const refs = committedSha ? [String(committedSha), branch, branch] : [branch, branch, branch];
    let lastReason = "latest files could not be read";

    for (let attempt = 0; attempt < delays.length; attempt++) {
      if (delays[attempt] > 0) await new Promise(r => setTimeout(r, delays[attempt]));
      try {
        const res = await Promise.race([
          callBackground({
            action: "bundlee_git_127hub_github_get_files",
            repository: config.repository,
            branch: refs[attempt],
            token: config.github_token,
            paths,
            maxTotalChars: Math.max(20000, Math.min(220000, expectedChars + 12000, Number(maxContextChars || 18000) * 4))
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Post-commit verification timeout")), 15000))
        ]);
        if (!res || !res.ok || !Array.isArray(res.files)) {
          lastReason = "latest files could not be read";
          continue;
        }

        const normalizeGitContent = value => String(value == null ? "" : value).replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n$/, "");
        const actual = new Map(res.files.filter(Boolean).map(f => [String(f.path || ""), normalizeGitContent(f.content)]));
        let checked = 0;
        let mismatch = "";
        for (const [path, content] of expected.entries()) {
          if (!actual.has(path)) { mismatch = `${path} was not returned by GitHub after commit`; break; }
          checked++;
          if (actual.get(path) !== normalizeGitContent(content)) { mismatch = `${path} does not yet match the committed content`; break; }
        }
        if (!mismatch) {
          if (hud) hud.appendLog(`✓ Verified ${checked} committed file(s) against GitHub HEAD`, "#10b981");
          return { ok: true, checked, attempt: attempt + 1 };
        }
        lastReason = mismatch;
      } catch (err) {
        lastReason = String(err && err.message || err);
      }

      if (hud && attempt < delays.length - 1) {
        hud.appendLog(`GitHub commit is accepted; waiting briefly for branch read consistency (${attempt + 1}/${delays.length})...`, "#94a3b8");
      }
    }

    if (hud) hud.appendLog("Post-commit content verification is still pending: " + lastReason, "#f59e0b");
    return { ok: false, checked: 0, reason: lastReason, attempts: delays.length };
  }

  function formatUsageLine(byokRes, creditValueUsd = 0.01) {
    const u = byokRes && byokRes.usage;
    if (!u) return "";
    const input = Number(u.input_tokens || 0);
    const output = Number(u.output_tokens || 0);
    const cost = u.estimated_cost_usd;
    let line = `API usage: ${input.toLocaleString()} input + ${output.toLocaleString()} output tokens`;
    if (cost !== null && cost !== undefined && Number.isFinite(Number(cost))) {
      const usd = Number(cost);
      const cv = Math.max(0.000001, Number(creditValueUsd || 0.01));
      line += ` · actual est. API cost $${usd.toFixed(usd < 0.01 ? 5 : 4)} · ${(usd / cv).toFixed((usd / cv) < 1 ? 2 : 1)} test credits`;
    }
    return line;
  }

  function recordUsage(byokRes, prompt, repository) {
    const u = byokRes && byokRes.usage;
    if (!u) return;
    try {
      const key = "__127hub_ai_usage_log";
      const rows = JSON.parse(localStorage.getItem(key) || "[]");
      rows.push({
        at: new Date().toISOString(),
        provider: byokRes.provider || "",
        model: byokRes.model || "",
        repository: repository || "",
        prompt_preview: String(prompt || "").slice(0, 140),
        input_tokens: Number(u.input_tokens || 0),
        output_tokens: Number(u.output_tokens || 0),
        cached_input_tokens: Number(u.cached_input_tokens || 0),
        estimated_cost_usd: u.estimated_cost_usd === null || u.estimated_cost_usd === undefined ? null : Number(u.estimated_cost_usd)
      });
      while (rows.length > 200) rows.shift();
      localStorage.setItem(key, JSON.stringify(rows));
    } catch (_) {}
  }

  function parseAiCodeResponse(rawText, fallbackPrompt = "", repoFiles = []) {
    if (!rawText || typeof rawText !== "string") return null;
    let text = rawText.trim();

    function tryRepairAndParse(jsonStr) {
      if (!jsonStr) return null;
      try {
        return JSON.parse(jsonStr);
      } catch (_) {
        // Only repair harmless trailing commas. Never auto-close quotes, arrays or
        // objects: doing that can turn a provider-truncated response into something
        // that looks valid and later overwrite a client's working project.
        const repaired = String(jsonStr).trim()
          .replace(/,\s*([}\]])/g, "$1")
          .replace(/,\s*$/, "");
        try {
          return JSON.parse(repaired);
        } catch (e2) {
          return null;
        }
      }
    }

    // 1. Check for markdown code fences with json
    const jsonFenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (jsonFenceMatch) {
      const candidate = tryRepairAndParse(jsonFenceMatch[1]);
      if (candidate) {
        const parsed = extractFromParsedObject(candidate, fallbackPrompt, repoFiles);
        if (parsed && Array.isArray(parsed.changes)) return parsed;
      }
    }

    // 2. Direct JSON Parse
    const directParsed = tryRepairAndParse(text);
    if (directParsed) {
      const parsed = extractFromParsedObject(directParsed, fallbackPrompt, repoFiles);
      if (parsed && Array.isArray(parsed.changes)) return parsed;
    }

    // 3. Extract substring between first '{' and last '}'
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const candidate = tryRepairAndParse(text.slice(firstBrace, lastBrace + 1));
      if (candidate) {
        const parsed = extractFromParsedObject(candidate, fallbackPrompt, repoFiles);
        if (parsed && Array.isArray(parsed.changes)) return parsed;
      }
    }

    // 4. Extract substring between first '[' and last ']'
    const firstBracket = text.indexOf("[");
    const lastBracket = text.lastIndexOf("]");
    if (firstBracket !== -1 && lastBracket > firstBracket) {
      const candidate = tryRepairAndParse(text.slice(firstBracket, lastBracket + 1));
      if (candidate) {
        const parsed = extractFromParsedObject(candidate, fallbackPrompt, repoFiles);
        if (parsed && Array.isArray(parsed.changes)) return parsed;
      }
    }

    // If the provider started an implementation JSON envelope but it did not parse,
    // stop here. Do not reinterpret fragments from a truncated JSON string as raw
    // TSX/JS code and accidentally commit them as a whole file.
    if (looksLikeJsonImplementationEnvelope(text)) return null;

    // 5. Fallback: Parse markdown code blocks (```tsx ... ```)
    const codeBlockRegex = /```(?:[a-zA-Z0-9_-]+)?\s*([\s\S]*?)```/g;
    let blockMatch;
    const extractedFiles = [];

    while ((blockMatch = codeBlockRegex.exec(text)) !== null) {
      const blockContent = blockMatch[1].trim();
      if (!blockContent || (blockContent.startsWith("{") && blockContent.endsWith("}"))) continue;

      let targetPath = "";
      const firstLine = blockContent.split("\n")[0].trim();
      const pathCommentMatch = firstLine.match(/^(?:\/\/|\/\*|#|<!--)\s*(?:file:?\s*)?([a-zA-Z0-9_\-./]+\.[a-zA-Z0-9]+)/i);
      if (pathCommentMatch) {
        targetPath = pathCommentMatch[1];
      } else {
        const preText = text.slice(Math.max(0, blockMatch.index - 120), blockMatch.index);
        const preMatch = preText.match(/(?:file|path|in|to|filename|file:)\s*[`"']?([a-zA-Z0-9_\-./]+\.[a-zA-Z0-9]+)[`"']?/i)
          || preText.match(/([a-zA-Z0-9_\-./]+\.(?:tsx|ts|jsx|js|css|html|json))/i);
        if (preMatch) {
          targetPath = preMatch[1];
        }
      }

      if (!targetPath) {
        if (/import\s+React|export\s+default|function\s+[A-Z]|\<[a-z]+[\s\>]/i.test(blockContent)) {
          targetPath = "src/App.tsx";
        } else if (/@tailwind|@apply|\{[\s\S]*:[^;]+;\s*\}/.test(blockContent)) {
          targetPath = "src/index.css";
        } else {
          targetPath = "src/components/GeneratedComponent.tsx";
        }
      }

      extractedFiles.push({
        path: targetPath.replace(/^\.\//, "").replace(/^\//, ""),
        action: "update",
        content: blockContent
      });
    }

    if (extractedFiles.length) {
      return {
        summary: fallbackPrompt || "Updated application components",
        changes: extractedFiles
      };
    }

    // 6. Ultimate Fallback: Raw code without any fences
    if (/import\s+|export\s+default|function\s+[A-Z]|const\s+[A-Z]/.test(text)) {
      return {
        summary: fallbackPrompt || "Updated component",
        changes: [{
          path: "src/App.tsx",
          action: "update",
          content: text
        }]
      };
    }

    return null;
  }

  function extractFromParsedObject(obj, fallbackPrompt, repoFiles) {
    if (!obj) return null;

    if (Array.isArray(obj)) {
      const list = obj.map(item => ({
        path: item.path || item.file || item.filename || "src/App.tsx",
        action: item.action || "update",
        content: item.content !== undefined ? item.content : (item.code || item.body || ""),
        replacements: Array.isArray(item.replacements) ? item.replacements : []
      })).filter(c => c.content || (c.replacements && c.replacements.length));
      if (list.length) return { summary: fallbackPrompt || "Applied code changes", changes: list };
    }

    if (Array.isArray(obj.changes) && obj.changes.length === 0) {
      return { summary: obj.summary || fallbackPrompt || "No code changes required", changes: [] };
    }

    if (Array.isArray(obj.changes) && obj.changes.length) {
      const valid = obj.changes.map(item => ({
        path: item.path || item.file || item.filename || "src/App.tsx",
        action: item.action || "update",
        content: item.content !== undefined ? item.content : (item.code || ""),
        replacements: Array.isArray(item.replacements) ? item.replacements : []
      })).filter(c => c.content || (c.replacements && c.replacements.length));
      if (valid.length) return { summary: obj.summary || fallbackPrompt || "Applied code changes", changes: valid };
    }

    if (Array.isArray(obj.files) && obj.files.length) {
      const valid = obj.files.map(item => ({
        path: item.path || item.file || item.filename || "src/App.tsx",
        action: item.action || "update",
        content: item.content !== undefined ? item.content : (item.code || ""),
        replacements: Array.isArray(item.replacements) ? item.replacements : []
      })).filter(c => c.content || (c.replacements && c.replacements.length));
      if (valid.length) return { summary: obj.summary || fallbackPrompt || "Applied code changes", changes: valid };
    }

    if ((obj.path || obj.file) && (obj.content || obj.code || (Array.isArray(obj.replacements) && obj.replacements.length))) {
      return {
        summary: obj.summary || fallbackPrompt || "Applied code update",
        changes: [{
          path: obj.path || obj.file,
          action: obj.action || "update",
          content: obj.content || obj.code || "",
          replacements: Array.isArray(obj.replacements) ? obj.replacements : []
        }]
      };
    }

    // Accept a compact runtime-repair shape as well. Some OpenAI-compatible/free
    // models simplify an explicitly requested one-patch response to top-level
    // search/replace fields even when asked for the normal changes[] envelope.
    if ((obj.path || obj.file) && typeof obj.search === "string" && typeof obj.replace === "string") {
      return {
        summary: obj.summary || fallbackPrompt || "Repaired active build error",
        changes: [{
          path: obj.path || obj.file,
          action: obj.action || "update",
          content: "",
          replacements: [{ search: obj.search, replace: obj.replace }]
        }]
      };
    }

    if ((obj.path || obj.file) && obj.replacement && typeof obj.replacement.search === "string" && typeof obj.replacement.replace === "string") {
      return {
        summary: obj.summary || fallbackPrompt || "Repaired active build error",
        changes: [{
          path: obj.path || obj.file,
          action: obj.action || "update",
          content: "",
          replacements: [{ search: obj.replacement.search, replace: obj.replacement.replace }]
        }]
      };
    }

    const keys = Object.keys(obj);
    const fileKeys = keys.filter(k => /\.(tsx|ts|jsx|js|css|html|json)$/i.test(k));
    if (fileKeys.length) {
      const list = fileKeys.map(k => ({
        path: k,
        action: "update",
        content: typeof obj[k] === "string" ? obj[k] : (obj[k].content || obj[k].code || "")
      })).filter(c => c.content);
      if (list.length) return { summary: obj.summary || fallbackPrompt || "Updated files", changes: list };
    }

    return null;
  }

  // ─────────────────────────────────────────────────────────────────
  // Lovable Preview Sync (safe/native refresh only)
  // ─────────────────────────────────────────────────────────────────
  function findNativeLovablePreviewRefreshButton() {
    const docsToCheck = [document];
    try {
      if (window.top && window.top.document && window.top.document !== document) docsToCheck.push(window.top.document);
    } catch (_) {}

    for (const d of docsToCheck) {
      const explicit = Array.from(d.querySelectorAll(
        'button[aria-label*="refresh" i], button[title*="refresh" i], button[aria-label*="reload" i], button[title*="reload" i], button[data-testid*="refresh" i], button[data-testid*="reload" i]'
      ));
      for (const btn of explicit) {
        const rect = btn.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && rect.top < 180) return btn;
      }

      // Current Lovable UI can render the preview refresh as an icon-only button.
      // Restrict the fallback to the upper-right preview toolbar so we never click
      // unrelated retry/undo buttons elsewhere in the editor.
      const iconButtons = Array.from(d.querySelectorAll('button, div[role="button"]')).filter((btn) => {
        const rect = btn.getBoundingClientRect();
        if (!(rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.top < 120)) return false;
        if (rect.left < (window.innerWidth * 0.45)) return false;
        return !!btn.querySelector('svg.lucide-rotate-cw, svg.lucide-refresh-cw, svg[class*="refresh" i], svg[class*="rotate-cw" i]');
      });
      if (iconButtons.length) return iconButtons[0];
    }
    return null;
  }

  async function waitForLovableExternalCommit(timeoutMs = 10000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      try {
        const d = (window.top && window.top.document) || document;
        const text = String(d.body && d.body.innerText || "").toLowerCase();
        if (text.includes("external commit")) return true;
      } catch (_) {}
      await new Promise(resolve => setTimeout(resolve, 700));
    }
    return false;
  }

  async function refreshLovablePreview(commitSha) {
    const projectId = getActiveProjectId();
    console.log("[LOVABLE AI] Waiting for Lovable GitHub sync before native preview refresh.", {
      commit: commitSha || "",
      projectId: projectId || "detected by Lovable"
    });

    // Lovable's GitHub integration imports external commits itself. Do not call
    // guessed/private /projects/.../git endpoints and do not rewrite iframe.src:
    // both approaches can target stale projects or reset the preview sandbox.
    const sawExternalCommit = await waitForLovableExternalCommit(10000);
    if (!sawExternalCommit) {
      // Give the normal GitHub sync a little time even if the current Lovable UI
      // no longer renders the literal "External commit" label.
      await new Promise(resolve => setTimeout(resolve, 1800));
    }

    const btn = findNativeLovablePreviewRefreshButton();
    if (btn) {
      try {
        btn.click();
        console.log("[LOVABLE AI] ✓ Triggered Lovable native preview refresh.");
        return { requested: true, nativeRefresh: true, sawExternalCommit };
      } catch (err) {
        console.warn("[LOVABLE AI] Native preview refresh click failed:", err);
      }
    }

    console.log("[LOVABLE AI] GitHub commit pushed; Lovable will refresh when its external-commit sync completes.");
    return { requested: true, nativeRefresh: false, sawExternalCommit };
  }

  function findLovableUpdatePreviewButton() {
    try {
      const d = (window.top && window.top.document) || document;
      const nodes = Array.from(d.querySelectorAll('button, [role="button"]'));
      for (const node of nodes) {
        const text = String(node.innerText || node.textContent || '').trim();
        if (!/^update\s+preview$/i.test(text)) continue;
        const r = node.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) return node;
      }
    } catch (_) {}
    return null;
  }

  function normalizePreviewLabel(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function previewLabelsLikelyMatch(expected, actual) {
    const a = normalizePreviewLabel(expected);
    const b = normalizePreviewLabel(actual);
    if (!a || !b) return false;
    if (b.includes(a) || a.includes(b)) return true;
    const stop = new Set(["the","a","an","to","of","for","on","in","and","or","with","from","this","that","my","our","your","page","home","homepage","details","preview","previewing"]);
    const at = a.split(" ").filter(t => t.length > 2 && !stop.has(t));
    const bt = new Set(b.split(" ").filter(t => t.length > 2 && !stop.has(t)));
    if (!at.length) return false;
    const hits = at.filter(t => bt.has(t)).length;
    return hits >= Math.min(3, at.length) && hits / at.length >= 0.45;
  }

  function readLovablePreviewCardState() {
    try {
      const d = (window.top && window.top.document) || document;
      const buttons = Array.from(d.querySelectorAll('button, [role="button"]'));
      for (const btn of buttons) {
        const label = String(btn.innerText || btn.textContent || '').trim();
        if (!/^previewing$/i.test(label)) continue;
        const r = btn.getBoundingClientRect();
        if (!(r.width > 0 && r.height > 0)) continue;
        let node = btn;
        let best = '';
        for (let depth = 0; depth < 7 && node; depth++, node = node.parentElement) {
          const text = String(node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim();
          if (text && text.length >= 8 && text.length <= 700 && /previewing/i.test(text)) {
            best = text;
            if (/details/i.test(text) && text.length >= 20) break;
          }
        }
        return { active: true, text: best || label };
      }
    } catch (_) {}
    return { active: false, text: '' };
  }

  function readLovableBuildState() {
    const state = { state: 'unknown', source: 'none', details: '', ts: Date.now() };
    try {
      const mon = window.__LAA_BUILD_MONITOR && window.__LAA_BUILD_MONITOR.latest;
      if (mon && mon.state) Object.assign(state, mon);
    } catch (_) {}
    try {
      const d = (window.top && window.top.document) || document;
      const raw = String(d.body && d.body.innerText || '');
      const tail = raw.slice(-18000);
      if (/Couldn['’]t update the preview|Runtime error|Transform failed with \d+ error|\[PARSE_ERROR\]|Unexpected token|build failed/i.test(tail)) {
        return { state: 'failed', source: 'dom', details: tail.slice(-6500), ts: Date.now() };
      }
      if (/Preview has not been built yet|preview is currently being built|building preview/i.test(tail)) {
        return { state: 'building', source: 'dom', details: 'Preview has not been built yet / preview is building', ts: Date.now() };
      }
      if (/Preview is out of date/i.test(tail)) {
        return { state: 'stale', source: 'dom', details: 'Preview is out of date', ts: Date.now() };
      }
      const iframe = Array.from(d.querySelectorAll('iframe')).find(f => {
        try {
          const r = f.getBoundingClientRect();
          return r.width > 200 && r.height > 180 && r.left > window.innerWidth * 0.2;
        } catch (_) { return false; }
      });
      if (iframe && !/error/i.test(String(d.title || ''))) {
        state.previewIframeVisible = true;
        state.previewIframeSrc = String(iframe.getAttribute('src') || iframe.src || '');
      }
      const card = readLovablePreviewCardState();
      state.previewCardActive = !!card.active;
      state.previewCardText = String(card.text || '');
    } catch (_) {}
    return state;
  }

  function captureLovableBuildBaseline() {
    const st = readLovableBuildState();
    return {
      state: String(st && st.state || "unknown"),
      source: String(st && st.source || "none"),
      details: String(st && st.details || ""),
      buildEventId: String(st && st.buildEventId || ""),
      previewCardText: String(st && st.previewCardText || ""),
      previewIframeSrc: String(st && st.previewIframeSrc || ""),
      previewIframeVisible: !!(st && st.previewIframeVisible),
      ts: Number(st && st.ts || Date.now())
    };
  }

  async function waitForLovablePreviewOutcome(options) {
    options = options || {};
    const timeoutMs = Math.max(30000, Number(options.timeoutMs || 120000));
    const baseline = options.baseline || {};
    const started = Date.now();
    const baselineBuildEventId = String(baseline.buildEventId || "");
    const baselineDetails = String(baseline.details || "");
    const baselineState = String(baseline.state || "unknown");
    const baselinePreviewCardText = String(baseline.previewCardText || "");
    const baselineIframeSrc = String(baseline.previewIframeSrc || "");
    const expectedLabel = String(options.expectedLabel || "");
    const baselineMatchesExpected = expectedLabel ? previewLabelsLikelyMatch(expectedLabel, baselinePreviewCardText) : false;
    let updateClicked = false;
    let sawFreshProgress = false;
    let uiHealthySince = 0;
    let lastUiSignature = "";
    let lastState = "unknown";
    while (Date.now() - started < timeoutMs) {
      const st = readLovableBuildState();
      lastState = st.state || "unknown";
      const buildEventId = String(st.buildEventId || "");
      const details = String(st.details || "");
      const newBuildEvent = !!buildEventId && buildEventId !== baselineBuildEventId;
      const changedSignal = st.state !== baselineState || (!!details && details !== baselineDetails);
      const previewCardText = String(st.previewCardText || "");
      const previewCardChanged = !!previewCardText && previewCardText !== baselinePreviewCardText;
      const iframeSrc = String(st.previewIframeSrc || "");
      const iframeChanged = !!iframeSrc && iframeSrc !== baselineIframeSrc;
      const previewMatchesExpected = expectedLabel ? previewLabelsLikelyMatch(expectedLabel, previewCardText) : false;
      const currentCommitCardVisible = !!st.previewCardActive && previewMatchesExpected;

      if (newBuildEvent || previewCardChanged || iframeChanged || ((st.state === "building" || st.state === "stale") && changedSignal)) {
        sawFreshProgress = true;
      }

      if (st.state === "failed") {
        // Rollback is only safe when the failure can be tied to activity that
        // happened after this commit. Ignore the same stale error that existed
        // before the commit started.
        const sameAsBaseline = !newBuildEvent && baselineState === "failed" && details === baselineDetails;
        if (!sameAsBaseline && (newBuildEvent || sawFreshProgress)) {
          return { ok: false, state: "failed", details, source: st.source || "", buildEventId, safeToRollback: true, fresh: true };
        }
      }

      // Lovable's current UI sometimes renders the new external commit successfully
      // without exposing a fresh build_event_id to the page. If the card for THIS
      // generated change is visibly in "Previewing" state and a real preview iframe
      // is present, treat a stable UI for several seconds as a successful preview.
      // This avoids leaving users stuck after the requested change is already live.
      if (st.state !== "failed" && st.previewIframeVisible && currentCommitCardVisible) {
        const uiSignature = previewCardText + "|" + iframeSrc;
        if (uiSignature !== lastUiSignature) {
          lastUiSignature = uiSignature;
          uiHealthySince = Date.now();
        } else if (!uiHealthySince) {
          uiHealthySince = Date.now();
        }
        const requiredStableMs = baselineMatchesExpected && !previewCardChanged && !iframeChanged ? 8000 : 5000;
        if (Date.now() - uiHealthySince >= requiredStableMs) {
          return {
            ok: true,
            state: "ready",
            details: "Lovable is visibly previewing the current generated change and the preview remained stable.",
            source: "lovable-preview-ui",
            buildEventId,
            fresh: previewCardChanged || iframeChanged || !baselineMatchesExpected
          };
        }
      } else {
        uiHealthySince = 0;
        lastUiSignature = "";
      }

      if (st.state === "stale" && !updateClicked) {
        const btn = findLovableUpdatePreviewButton();
        if (btn) { try { btn.click(); updateClicked = true; sawFreshProgress = true; } catch (_) {} }
      }

      if (st.state === "ready") {
        // A ready signal is accepted only when it belongs to a new build event or
        // follows fresh building/stale activity from this job. A pre-existing iframe
        // is deliberately not considered proof of success.
        if (newBuildEvent || sawFreshProgress) {
          return { ok: true, state: "ready", details, source: st.source || "", buildEventId, fresh: true };
        }
      }

      await new Promise(r => setTimeout(r, 1000));
    }
    return {
      ok: false,
      state: lastState === "building" ? "building_timeout" : "unverified_timeout",
      details: "Lovable did not provide a fresh build signal for this commit within the verification window. The commit was kept and no automatic rollback was performed.",
      safeToRollback: false,
      fresh: false
    };
  }

  async function latestTargetsStillMatchCommitted(previewData, config, maxContextChars) {
    try {
      const expected = new Map();
      for (const change of (previewData && previewData.changes) || []) {
        const path = String(change && change.path || '').replace(/^\.\//, '').replace(/^\//, '');
        if (!path) continue;
        if (change.action === 'delete') expected.set(path, null);
        else if (change.content !== undefined && change.content !== null) expected.set(path, String(change.content));
      }
      if (!expected.size) return true;
      const paths = Array.from(expected.keys()).slice(0, 8);
      const res = await callBackground({ action: 'bundlee_git_127hub_github_get_files', repository: config.repository, branch: config.branch || 'main', token: config.github_token, paths, maxTotalChars: Math.max(24000, Math.min(220000, Number(maxContextChars || 18000) * 4)) });
      if (!res || !res.ok || !Array.isArray(res.files)) return false;
      const actual = new Map(res.files.filter(Boolean).map(f => [String(f.path || ''), String(f.content || '')]));
      for (const [path, content] of expected.entries()) {
        if (content === null) { if (actual.has(path) && actual.get(path) !== '') return false; }
        else if (!actual.has(path) || actual.get(path) !== content) return false;
      }
      return true;
    } catch (_) { return false; }
  }

  function buildRestoreChanges(previewData, baseContentMap) {
    const out = [];
    const seen = new Set();
    for (const change of (previewData && previewData.changes) || []) {
      const path = String(change && change.path || '').replace(/^\.\//, '').replace(/^\//, '');
      if (!path || seen.has(path)) continue;
      seen.add(path);
      if (Object.prototype.hasOwnProperty.call(baseContentMap || {}, path) && typeof baseContentMap[path] === 'string') out.push({ path, action: 'update', content: baseContentMap[path] });
      else out.push({ path, action: 'delete', content: '' });
    }
    return out;
  }

  async function restorePreEditFiles(previewData, baseContentMap, config, maxContextChars, hud) {
    const safe = await latestTargetsStillMatchCommitted(previewData, config, maxContextChars);
    if (!safe) throw new Error('The project changed after this extension commit, so automatic restore was cancelled to protect newer work.');
    const changes = buildRestoreChanges(previewData, baseContentMap);
    if (!changes.length) throw new Error('No pre-edit files were available for automatic restore.');
    if (hud) hud.appendLog('Lovable could not build the latest change. Restoring the pre-edit working files...', '#f59e0b');
    assertCurrentProjectGitTarget(config, 'Automatic restore');
    const res = await callBackground({ action: 'bundlee_git_127hub_github_commit_direct', repository: config.repository, branch: config.branch || 'main', token: config.github_token, changes, message: 'Restore previous working version after Lovable preview build failure' });
    if (!res || res.ok === false) throw new Error((res && (res.error || res.message)) || 'Automatic restore commit failed');
    try { await refreshLovablePreview(res.sha || ''); } catch (_) {}
    const outcome = await waitForLovablePreviewOutcome({ timeoutMs: 90000 });
    return { commit: res, outcome };
  }

  // ─────────────────────────────────────────────────────────────────
  // Core Prompt Dispatcher: Preview & Confirm (BYOK + Direct GitHub Commit)
  // ─────────────────────────────────────────────────────────────────
  async function previewAndConfirm(prompt, attachments) {
    // Clear any stuck floating toasts from other modes
    try {
      const doc = (window.top && window.top.document) || document;
      doc.querySelectorAll(".lovasiri-toast, [id*='lovasiri-toast']").forEach(t => t.remove());
    } catch (_) {}

    const config = ensureCurrentProjectGitMapping();
    const diagnosticJobId = diagnosticStartJob({
      config,
      prompt,
      attachmentCount: Array.isArray(attachments) ? attachments.length : 0,
      attachmentNames: Array.isArray(attachments) ? attachments.map(a => String(a && (a.name || a.filename) || "image")) : []
    });
    if (!config.repository) {
      diagnosticFinishJob(diagnosticJobId, "blocked_preflight", { error: "Repository required" });
      showGitToast("Please connect your GitHub repository in Git Settings.", "error");
      openGitSettings(() => previewAndConfirm(prompt, attachments));
      return { ok: false, message: "Repository required" };
    }

    if (!config.github_token) {
      diagnosticFinishJob(diagnosticJobId, "blocked_preflight", { error: "GitHub Token required" });
      showGitToast("Please enter your GitHub Token (PAT) in Git Settings.", "error");
      openGitSettings(() => previewAndConfirm(prompt, attachments));
      return { ok: false, message: "GitHub Token required" };
    }

    const provider = config.byok_provider || "xkiro";
    const providerApiKey = resolveProviderApiKey(config);
    if (!providerApiKey) {
      diagnosticFinishJob(diagnosticJobId, "blocked_preflight", { error: "BYOK API Key required", agent: { provider } });
      showGitToast(provider === "xkiro" ? "Please add an xKiro API key in Git Settings." : "Please configure your BYOK API Key in Git Settings.", "error");
      openGitSettings(() => previewAndConfirm(prompt, attachments));
      return { ok: false, message: "BYOK API Key required" };
    }

    try {
      assertCurrentProjectGitTarget(config, "Project start");
    } catch (mappingErr) {
      const msg = mappingErr && mappingErr.message ? mappingErr.message : String(mappingErr);
      diagnosticFinishJob(diagnosticJobId, "blocked_preflight", { error: msg });
      showGitToast(msg, "error", 8000);
      openGitSettings(() => previewAndConfirm(prompt, attachments));
      return { ok: false, message: msg, projectMappingRequired: true };
    }

    const configuredReleaseLevel = config.release_level || "auto";
    const conversationalIntent = isReadOnlyQuestionPrompt(prompt);
    const releaseLevelName = conversationalIntent ? "basic" : inferEffectiveReleaseLevel(prompt, configuredReleaseLevel);
    const changeScope = conversationalIntent ? "feature" : inferChangeScope(prompt, config.change_scope || "auto");
    const strictConsistency = config.strict_consistency !== false;
    diagnosticUpdateJob(diagnosticJobId, {
      agent: {
        provider,
        releaseLevel: releaseLevelName,
        changeScope,
        reasoningEffort: releaseReasoningFor(provider, releaseLevelName),
        strictConsistency,
        consistencyReview: String(config.consistency_review || "smart"),
        autoCommit: config.auto_commit !== false
      }
    }, "preflight_classified", { releaseLevel: releaseLevelName, changeScope, provider });
    const promptContractRules = extractPersistentRulesFromPrompt(prompt);
    const releaseProfile = releaseLevelProfile(releaseLevelName);
    let planModel = releaseModelFor(provider, releaseLevelName, config.byok_custom_model, config.byok_xkiro_model, config.byok_anthropic_model) || config.byok_plan_model;
    let applyModel = releaseModelFor(provider, releaseLevelName, config.byok_custom_model, config.byok_xkiro_model, config.byok_anthropic_model) || config.byok_apply_model || planModel;
    const costSaver = true;
    const creditValueUsd = 0.01;
    let maxPromptChars = releaseProfile.maxPromptChars;
    let maxOutputTokens = releaseProfile.maxOutputTokens;
    let maxContextFiles = releaseProfile.maxContextFiles;
    let maxContextChars = releaseProfile.maxContextChars;
    let powerProfile = null;

    // Lean-patch mode: tiny content/style/image edits should not spend the same
    // context/output budget as a whole feature. This was a major source of 20K-30K
    // token jobs for requests like "make sidebar sticky" or "change USD to INR".
    const narrowEdit = ["content", "style", "image"].includes(changeScope) && String(prompt || "").length < 700;
    const simpleActionEdit = !conversationalIntent && !isBroadAppCreationPrompt(prompt) && String(prompt || "").length < 360 &&
      /\b(remove|delete|hide|rename|move|change|convert)\b/i.test(String(prompt || ""));
    if (narrowEdit || simpleActionEdit) {
      maxContextFiles = Math.min(maxContextFiles, 3);
      maxContextChars = Math.min(maxContextChars, 14000);
      maxOutputTokens = Math.min(maxOutputTokens, 5000);
      maxPromptChars = Math.min(maxPromptChars, 5000);
    }
    if (conversationalIntent) {
      maxContextFiles = Math.min(maxContextFiles, 2);
      maxContextChars = Math.min(maxContextChars, 22000);
      maxOutputTokens = Math.min(maxOutputTokens, 1400);
      maxPromptChars = Math.min(maxPromptChars, 4000);
    }

    if (!applyModel) {
      diagnosticFinishJob(diagnosticJobId, "blocked_preflight", { error: "AI model required" });
      showGitToast("Please choose/configure an AI model in Git Settings.", "error");
      openGitSettings(() => previewAndConfirm(prompt, attachments));
      return { ok: false, message: "AI model required" };
    }

    const originalPrompt = String(prompt || "");
    const visionAttachments = normalizeVisionAttachments(attachments);
    const effectivePrompt = costSaver && originalPrompt.length > maxPromptChars
      ? originalPrompt.slice(0, maxPromptChars) + "\n[The original prompt was larger than this provider pass. Implement every requirement visible above without unrelated rewrites.]"
      : originalPrompt;
    const runtimeErrorContext = conversationalIntent ? null : collectLovableRuntimeErrorContext();
    const runtimeErrorInstruction = runtimeErrorContext
      ? `ACTIVE LOVABLE PREVIEW/BUILD ERROR DETECTED. Repair this error first so the current project can build. Do not answer that a requested feature already exists while this error remains. If the user's requested feature already exists, return the smallest code change that fixes the active build error instead.\n${runtimeErrorContext.path ? `Target file: ${runtimeErrorContext.path}${runtimeErrorContext.line ? `:${runtimeErrorContext.line}${runtimeErrorContext.column ? `:${runtimeErrorContext.column}` : ""}` : ""}\n` : ""}Lovable error details:\n${runtimeErrorContext.text}`
      : "";
    let baselineHealthInstruction = "";
    let baselineSyntaxIssues = [];
    diagnosticUpdateJob(diagnosticJobId, {
      input: {
        prompt: originalPrompt,
        effectivePrompt,
        attachmentCount: visionAttachments.length,
        attachmentNames: visionAttachments.map(a => String(a && a.name || "image"))
      },
      environment: { runtimeErrorAtStart: diagnosticSanitize(runtimeErrorContext || null, "runtimeError", 0) }
    }, runtimeErrorContext ? "runtime_error_detected" : "prompt_ready", runtimeErrorContext || {});

    if (window.__lovableAiGitJobRunning) {
      const started = Number(window.__lovasiriJobStartedAt || 0);
      const elapsed = started ? formatJobElapsed(Date.now() - started) : "00:00";
      showGitToast(`Still working (${elapsed}). Please wait before sending another prompt.`, "info", 5000);
      diagnosticFinishJob(diagnosticJobId, "busy", { error: `Another AI job is still running (${elapsed})` });
      return { ok: false, busy: true, message: `Another AI job is still running (${elapsed})` };
    }
    window.__lovableAiGitJobRunning = true;
    startJobStatus("Preparing your request");
    const recoveryScope = getRecoveryScope(config);
    LOVASIRI_ACTIVE_RECOVERY_SCOPE_KEY = recoveryScope.key;
    persistRecoveryJob({
      scopeKey: recoveryScope.key,
      projectId: recoveryScope.projectId,
      jobId: "job_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
      status: "running",
      stage: "Preparing your request",
      prompt: originalPrompt,
      repository: config.repository,
      branch: config.branch || "main",
      provider,
      attachmentCount: visionAttachments.length,
      attachmentNames: visionAttachments.map(a => a.name),
      createdAt: Date.now()
    });
    let jobHadError = false;
    const hud = showGitProgressHud(prompt);

    try {
      // Step 1: Scan repository structure for context
      updateJobStatus("Reading the latest project files");
      hud.setStep(1, `Reading ${config.repository} repository structure...`);
      hud.appendLog("Connected repository: " + config.repository, "#00f2fe");
      hud.appendLog("Target branch: " + (config.branch || "main"), "#94a3b8");

      let repoFiles = [];
      try {
        const treeRes = await Promise.race([
          callBackground({
            action: "bundlee_git_127hub_github_get_tree",
            repository: config.repository,
            branch: config.branch || "main",
            token: config.github_token
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Tree timeout")), 3000))
        ]);
        if (treeRes && treeRes.ok && Array.isArray(treeRes.files)) {
          repoFiles = treeRes.files;
          diagnosticUpdateJob(diagnosticJobId, { context: { repositoryFileCount: repoFiles.length, repositoryTree: diagnosticDeepEnabled(config) ? repoFiles.slice(0, 5000) : [] } }, "repository_tree_loaded", { fileCount: repoFiles.length });
          console.log(`[LOVABLE AI] 📁 Repository context loaded: ${repoFiles.length} files`);
          hud.appendLog("Repository context: " + repoFiles.length + " files mapped", "#10b981");
        }
      } catch (treeErr) {
        diagnosticUpdateJob(diagnosticJobId, null, "repository_tree_error", { error: treeErr && treeErr.message || String(treeErr) });
        console.warn("[LOVABLE AI] Repo tree skipped or timed out:", treeErr.message);
        hud.appendLog("Repository tree skipped: " + treeErr.message, "#f59e0b");
      }

      // Load only the most relevant existing source files. This prevents the AI from
      // guessing the router/entry structure and keeps token cost predictable.
      let repoContextFiles = [];
      let relevantPaths = selectRelevantRepoFiles(
        runtimeErrorInstruction ? `${effectivePrompt}\n${runtimeErrorInstruction}` : effectivePrompt,
        repoFiles,
        maxContextFiles
      );
      const recentHotPaths = conversationalIntent ? [] : getProjectHistory(config, config.repository).flatMap(r => Array.isArray(r.paths) ? r.paths : []);
      for (const hot of recentHotPaths) {
        if (relevantPaths.length >= maxContextFiles) break;
        if (repoFiles.includes(hot) && !relevantPaths.includes(hot)) relevantPaths.push(hot);
      }
      if (runtimeErrorContext && runtimeErrorContext.path && repoFiles.includes(runtimeErrorContext.path)) {
        relevantPaths = [runtimeErrorContext.path, ...relevantPaths.filter(p => p !== runtimeErrorContext.path)].slice(0, maxContextFiles);
      }
      if (relevantPaths.length) {
        try {
          const contentRes = await Promise.race([
            callBackground({
              action: "bundlee_git_127hub_github_get_files",
              repository: config.repository,
              branch: config.branch || "main",
              token: config.github_token,
              paths: relevantPaths,
              maxTotalChars: runtimeErrorContext && runtimeErrorContext.path
                ? Math.max(maxContextChars, 90000)
                : maxContextChars
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error("File context timeout")), 7000))
          ]);
          if (contentRes && contentRes.ok && Array.isArray(contentRes.files)) {
            repoContextFiles = contentRes.files;
            hud.appendLog(`Loaded ${repoContextFiles.length} relevant source file(s) (${Number(contentRes.total_chars || 0).toLocaleString()} chars)`, "#10b981");
          }
        } catch (ctxErr) {
          hud.appendLog("Relevant file context skipped: " + ctxErr.message, "#f59e0b");
        }
      }
      repoContextFiles = await expandContextWithDependencies(repoContextFiles, repoFiles, config, maxContextFiles, maxContextChars, hud);
      repoContextFiles = constrainLoadedContextToBudget(repoContextFiles, maxContextChars, hud);
      diagnosticUpdateJob(diagnosticJobId, {
        stage: "context_loaded",
        context: {
          relevantPaths: repoContextFiles.map(f => f.path),
          relevantFileCount: repoContextFiles.length,
          relevantChars: repoContextFiles.reduce((n, f) => n + String(f && f.content || "").length, 0)
        }
      }, "context_loaded", { paths: repoContextFiles.map(f => f.path), count: repoContextFiles.length });
      const repoContentMap = {};
      repoContextFiles.forEach(f => { repoContentMap[f.path] = f.content; });
      baselineSyntaxIssues = conversationalIntent ? [] : await findCriticalBaselineSyntaxIssues(repoContextFiles);
      if (baselineSyntaxIssues.length) {
        const first = baselineSyntaxIssues[0];
        baselineHealthInstruction = `EXISTING PROJECT BASELINE ERROR DETECTED BEFORE THIS REQUEST. Repair this existing source error first, then satisfy the user's request only if it remains safe. Do not stack a new feature on top of invalid TS/JS.\nTarget: ${first.path}${first.line ? `:${first.line}${first.column ? `:${first.column}` : ""}` : ""}\nError: ${first.error}`;
        hud.appendLog(`⚠ Existing project syntax issue detected in ${first.path}${first.line ? `:${first.line}` : ""}; repair is required before a new feature can be safely committed.`, "#f59e0b");
        diagnosticUpdateJob(diagnosticJobId, { environment: { baselineSyntaxIssues: diagnosticSanitize(baselineSyntaxIssues, "baselineSyntaxIssues", 0) } }, "baseline_syntax_issue", { issues: baselineSyntaxIssues });
      }
      const architectureContractRules = inferArchitectureRules(repoFiles, repoContextFiles, effectivePrompt);
      const projectContractContext = buildProjectContractContext(config, config.repository, promptContractRules, architectureContractRules);
      const projectHistoryContext = (narrowEdit || simpleActionEdit || conversationalIntent) ? "" : buildProjectHistoryContext(config, config.repository);
      hud.appendLog(`Agent scope: ${CHANGE_SCOPE_LABELS[changeScope] || changeScope} · quality ${releaseLevelName.toUpperCase()}`, "#a7f3d0");
      if (projectContractContext) hud.appendLog(`Project Contract active (${projectContractContext.split("\n").length - 1} rule line(s)).`, "#38bdf8");
      if (runtimeErrorContext) {
        hud.appendLog(
          `Lovable build error detected${runtimeErrorContext.path ? ` in ${runtimeErrorContext.path}${runtimeErrorContext.line ? `:${runtimeErrorContext.line}` : ""}` : ""}; repair will be prioritized.`,
          "#f59e0b"
        );
      }

      if (visionAttachments.length) {
        hud.appendLog(`🖼 Vision: ${visionAttachments.length} attached image${visionAttachments.length === 1 ? "" : "s"} will be sent to the AI model.`, "#38bdf8");
      }
      const imageAudit = await auditCurrentProjectImages(repoContextFiles, effectivePrompt, config, hud, repoFiles);
      const imageSafetyContext = buildImageSafetyContext(effectivePrompt, imageAudit, visionAttachments, repoFiles);

      // Fresh Lovable starter pages often need a full root-route replacement. Give
      // that one operation enough room to finish instead of committing a response
      // cut off mid-TSX. If the provider itself has a smaller cap, validation below
      // will reject any truncated result and retry once with a compact implementation.
      const hasLovableBlankStarter = repoContextFiles.some(f => /data-lovable-blank-page-placeholder|blank-app-v1\.svg/i.test(String(f && f.content || "")));
      const isMajorPageBuild = /\b(create|build|make|generate|design|replace|complete)\b[\s\S]{0,80}\b(home|homepage|landing|website|site|store|shop|ecommerce|e-commerce|page)\b|\b(home|homepage|landing|website|store|shop|ecommerce|e-commerce)\b[\s\S]{0,60}\b(create|build|make|generate|design|complete)\b/i.test(effectivePrompt);
      if (hasLovableBlankStarter && isMajorPageBuild) {
        maxOutputTokens = Math.max(maxOutputTokens, 8192);
        hud.appendLog("Starter page detected: using a larger completion allowance for one complete root-page replacement.", "#a7f3d0");
      }

      if (hud.isCancelled()) { diagnosticFinishJob(diagnosticJobId, "cancelled", { error: "Cancelled by user" }); return { ok: false, message: "Cancelled by user" }; }

      // Step 2: Generate a context-aware edit via BYOK. Cost Saver uses the Apply Model
      // directly (one AI call per user prompt) instead of paying for a separate planning call.
      const activeModel = applyModel || planModel;
      const activeModelDisplay = releaseModelDisplay(provider, activeModel);
      updateJobStatus(`Generating with ${releaseProviderLabel(provider)}`);
      hud.setStep(2, `Reading code & applying request with ${provider} (${activeModelDisplay})...`);
      hud.appendLog("AI Provider: " + provider.toUpperCase() + " · Apply Model: " + activeModelDisplay, "#00f2fe");
      hud.appendLog(`🎚 Mode: ${releaseProfile.label} · ${activeModelDisplay}`, "#a7f3d0");
      if (provider === "xkiro" && /^auto/i.test(String(activeModelDisplay || ""))) {
        hud.appendLog("xKiro Auto: choosing the best-fit healthy free model for this task; automatic fallback is enabled.", "#a7f3d0");
      }
      hud.appendLog("Prompt: " + (effectivePrompt.length > 55 ? effectivePrompt.slice(0, 55) + "..." : effectivePrompt), "#cbd5e1");
      if (effectivePrompt.length < String(prompt || "").length) hud.appendLog(`Prompt capped at ${maxPromptChars.toLocaleString()} characters for cost control`, "#f59e0b");
      if (costSaver) hud.appendLog(`💰 Cost Saver: max ${maxOutputTokens} output tokens · ${maxContextFiles} context files`, "#10b981");
      console.log(`[LOVABLE AI BYOK] Dispatching prompt to ${provider} (${activeModel})...`);

      const treeSummary = repoFiles.length && !narrowEdit
        ? `Repository file map (partial):\n${repoFiles.slice(0, 45).join("\n")}\n\n`
        : "";
      const sourceContext = repoContextFiles.length
        ? repoContextFiles.map(f => {
            const body = runtimeErrorContext && runtimeErrorContext.path === f.path
              ? buildRuntimeErrorSourceExcerpt(f.content, runtimeErrorContext.line)
              : f.content;
            return `--- FILE: ${f.path} ---\n${body}\n--- END FILE ---`;
          }).join("\n\n") + "\n\n"
        : "";

      const readOnlyInstruction = conversationalIntent
        ? "READ-ONLY QUESTION MODE: The user is asking for information/explanation, not requesting a code change. Answer directly from the supplied project context in concise plain text. Do NOT return JSON, patches or file changes."
        : "";
      const definitionOfDoneInstruction = conversationalIntent ? "" : buildFeatureDefinitionOfDone(effectivePrompt, repoFiles);
      const navigationPromptHint = isNavigationFeaturePrompt(effectivePrompt)
        ? "Navigation request: use only routes shown in the supplied repository unless this same change creates a missing route. Preserve the router shell/<Outlet />. Prefer the project's existing/plain UI approach over introducing a new global provider."
        : "";
      const systemPrompt = `You are a senior coding agent modifying an EXISTING Lovable project.
${readOnlyInstruction ? `${readOnlyInstruction}\n` : ""}For implementation requests:
- Treat the supplied repository files as the source of truth. Do not invent files, routes, packages, APIs, or architecture that are not supported by the context.
- Implement the user's request with the smallest complete change and preserve unrelated working code, data, routes, images, handlers, and UI.
- Scope is a HINT, not a reason to omit required behavior: ${changeScopeInstruction(changeScope)}
- If an active build/preview error is supplied, repair the proven error first and do not stack a new feature on a broken baseline.
- Keep existing router/export conventions. Never edit generated router files such as src/routeTree.gen.ts.
- Never replace a working root/home page with a starter, Hello World, TODO, placeholder, or blank shell.
${navigationPromptHint ? `- ${navigationPromptHint}\n` : ""}- Use existing dependencies unless the request clearly requires a new one.
- Prefer exact SEARCH/REPLACE patches for small edits. Search text must be a verbatim contiguous excerpt from the supplied file.
- For a genuinely new file or a major root-page build, full file content is allowed.
- Return complete syntactically valid code. Do not stop mid-file, mid-string, mid-JSX, or mid-JSON.
- Do not output chain-of-thought, <think> blocks, markdown fences, or implementation commentary.

For implementation requests return STRICT JSON:
{
  "summary": "short commit summary",
  "changes": [
    {
      "path": "src/App.tsx",
      "action": "update",
      "replacements": [
        {"search": "EXACT CURRENT SOURCE", "replace": "UPDATED SOURCE"}
      ]
    }
  ]
}
Use "content" instead of "replacements" only when a full-file replacement is truly appropriate.
For a read-only question, answer directly in plain text and do not return changes.`;

      const userContent = `${treeSummary}${sourceContext}${projectContractContext ? `${projectContractContext}\n\n` : ""}${projectHistoryContext ? `${projectHistoryContext}\n\n` : ""}${imageSafetyContext ? `${imageSafetyContext}\n\n` : ""}${runtimeErrorInstruction ? `${runtimeErrorInstruction}\n\n` : ""}${baselineHealthInstruction ? `${baselineHealthInstruction}\n\n` : ""}${definitionOfDoneInstruction ? `${definitionOfDoneInstruction}\n\n` : ""}USER REQUEST:\n${effectivePrompt}\n\n${conversationalIntent ? "Answer only. Do not create, edit, or commit code." : `Scope hint: ${CHANGE_SCOPE_LABELS[changeScope] || changeScope}. Implement the request completely while preserving unrelated working behavior.`}`;
      const primaryMessageContent = buildVisionUserContent(userContent, visionAttachments);
      diagnosticUpdateJob(diagnosticJobId, {
        stage: "generating",
        context: {
          systemPrompt: diagnosticRedactString(systemPrompt),
          exactUserContent: diagnosticDeepEnabled(config) ? diagnosticModelContent(primaryMessageContent) : diagnosticRedactString(`User Request:\n${effectivePrompt}`),
          sourceContext: diagnosticDeepEnabled(config) ? diagnosticRedactString(sourceContext) : "[Deep diagnostics disabled]",
          projectContract: diagnosticRedactString(projectContractContext || ""),
          projectHistory: diagnosticRedactString(projectHistoryContext || ""),
          imageSafetyContext: diagnosticRedactString(imageSafetyContext || ""),
          relevantPaths: repoContextFiles.map(f => f.path)
        },
        agent: { requestedModel: activeModel, modelDisplay: activeModelDisplay, maxOutputTokens, maxContextFiles, maxContextChars }
      }, "model_request_ready", { provider, model: activeModel, maxOutputTokens, relevantFileCount: repoContextFiles.length });
      const primaryCallStartedAt = Date.now();

      // Snapshot the exact source context used for generation. If a full-file response
      // targets a file that changes before application, regenerate once instead of
      // overwriting newer client work with stale content.
      const generationContextMap = Object.assign({}, repoContentMap);

      const byokRes = await callBackground({
        action: "bundlee_git_lovable_public_byok_chat",
        provider: provider,
        apiKey: providerApiKey,
        apiBase: config.byok_api_base || "",
        workspaceId: provider === "anthropic" ? String(config.byok_anthropic_workspace_id || "").trim() : "",
        model: activeModel,
        messages: [{ role: "user", content: primaryMessageContent }],
        systemPrompt: systemPrompt,
        maxOutputTokens: maxOutputTokens,
        reasoningEffort: releaseReasoningFor(provider, releaseLevelName),
        forceJson: false
      });

      if (hud.isCancelled()) { diagnosticFinishJob(diagnosticJobId, "cancelled", { error: "Cancelled by user" }); return { ok: false, message: "Cancelled by user" }; }

      if (!byokRes || !byokRes.ok) {
        throw new Error(byokRes?.error || "BYOK AI generation failed");
      }

      const rawResponse = String(byokRes.text || "").trim();
      diagnosticAddModelCall(diagnosticJobId, {
        purpose: "primary_generation",
        startedAt: primaryCallStartedAt,
        endedAt: Date.now(),
        durationMs: Date.now() - primaryCallStartedAt,
        provider,
        requestedModel: activeModel,
        modelUsed: byokRes.model || activeModel,
        fallbackUsed: !!byokRes.fallbackUsed,
        attemptedModels: Array.isArray(byokRes.attemptedModels) ? byokRes.attemptedModels : [],
        usage: byokRes.usage || null,
        systemPrompt: diagnosticRedactString(systemPrompt),
        userContent: diagnosticDeepEnabled(config) ? diagnosticModelContent(primaryMessageContent) : diagnosticRedactString(`User Request:\n${effectivePrompt}`),
        responseText: diagnosticRedactString(rawResponse)
      });
      diagnosticUpdateJob(diagnosticJobId, { stage: "response_received", agent: { modelUsed: byokRes.model || activeModel, attemptedModels: byokRes.attemptedModels || [], fallbackUsed: !!byokRes.fallbackUsed }, usage: byokRes.usage || null }, "model_response_received", { chars: rawResponse.length, model: byokRes.model || activeModel });
      if (provider === "xkiro" && byokRes.model) {
        if (byokRes.fallbackUsed && Array.isArray(byokRes.attemptedModels) && byokRes.attemptedModels.length > 1) {
          hud.appendLog("xKiro fallback succeeded: " + byokRes.attemptedModels.join(" → "), "#10b981");
        } else {
          hud.appendLog("xKiro free model selected: " + byokRes.model, "#10b981");
        }
      }

      // Cost Saver never requests hidden/visible chain-of-thought. Strip a legacy block if a provider emits one anyway.
      const thinkMatch = rawResponse.match(/<think>([\s\S]*?)<\/think>/i);
      const thinking = "";
      const contentAfterThink = rawResponse.replace(/<think>[\s\S]*?<\/think>/i, "").trim();
      const usageLine = formatUsageLine(byokRes, creditValueUsd);
      if (usageLine) hud.appendLog("💵 " + usageLine, "#fbbf24");
      recordUsage(byokRes, effectivePrompt, config.repository);

      // Check if code changes exist. A JSON-looking implementation response that
      // cannot be parsed is treated as incomplete, never as a successful chat reply.
      let previewData = parseAiCodeResponse(contentAfterThink, prompt, repoFiles);
      diagnosticUpdateJob(diagnosticJobId, { parsed: {
        responseKind: previewData && Array.isArray(previewData.changes) && previewData.changes.length ? "code_changes" : "chat_or_invalid",
        summary: previewData && previewData.summary || "",
        changes: previewData && Array.isArray(previewData.changes) ? diagnosticSanitize(previewData.changes, "changes", 0) : [],
        rawResponseChars: rawResponse.length
      } }, "response_parsed", { changeCount: previewData && Array.isArray(previewData.changes) ? previewData.changes.length : 0 });
      let autoRetryUsed = false;

      async function regenerateOnceForSafety(reason, targetPaths) {
        if (autoRetryUsed) throw new Error(reason || "AI generation validation failed after the safe retry.");
        autoRetryUsed = true;
        diagnosticUpdateJob(diagnosticJobId, null, "safe_retry_started", { reason: String(reason || "Generated edit was unsafe/incomplete"), targetPaths: targetPaths || [] });
        hud.appendLog("↻ " + (reason || "Generated edit was unsafe/incomplete") + " Retrying once with latest GitHub code...", "#f59e0b");

        const isRuntimeRepairRetry = !!(runtimeErrorContext && runtimeErrorContext.path);
        const requestedRetryPaths = targetPaths && targetPaths.length ? targetPaths : relevantPaths;
        const normalizedRetryPaths = Array.from(new Set(requestedRetryPaths
          .map(p => String(p || "").replace(/^\.\//, "").replace(/^\//, ""))
          .filter(Boolean)));
        const paths = isRuntimeRepairRetry
          ? [runtimeErrorContext.path, ...normalizedRetryPaths.filter(p => p !== runtimeErrorContext.path)].slice(0, 2)
          : normalizedRetryPaths.slice(0, 8);
        if (paths.length) {
          try {
            const latestRes = await Promise.race([
              callBackground({
                action: "bundlee_git_127hub_github_get_files",
                repository: config.repository,
                branch: config.branch || "main",
                token: config.github_token,
                paths,
                maxTotalChars: Math.max(16000, Math.min(70000, Number(maxContextChars || 18000) * 2))
              }),
              new Promise((_, reject) => setTimeout(() => reject(new Error("Safe retry latest-file fetch timeout")), 15000))
            ]);
            if (latestRes && latestRes.ok && Array.isArray(latestRes.files)) {
              latestRes.files.forEach(f => { if (f && f.path && typeof f.content === "string") repoContentMap[f.path] = f.content; });
            }
          } catch (latestErr) {
            throw new Error("Could not refresh the latest GitHub files for the safe retry. No commit was made. " + (latestErr.message || latestErr));
          }
        }

        const latestContext = paths.map(path => {
          if (repoContentMap[path] === undefined) return "";
          const body = isRuntimeRepairRetry && path === runtimeErrorContext.path
            ? buildRuntimeRepairPatchContext(repoContentMap[path], runtimeErrorContext.line)
            : repoContentMap[path];
          return `--- LATEST FILE: ${path} ---\n${body}\n--- END FILE ---`;
        }).filter(Boolean).join("\n\n");

        let candidateRepairContext = "";
        if (!isRuntimeRepairRetry && previewData && Array.isArray(previewData.changes)) {
          let budget = 30000;
          const parts = [];
          for (const c of previewData.changes) {
            const cp = String(c && c.path || "").replace(/^\.\//, "").replace(/^\//, "");
            if (!cp || (paths.length && !paths.includes(cp)) || budget <= 0) continue;
            let body = "";
            if (Array.isArray(c.replacements) && c.replacements.length) {
              body = c.replacements.slice(0, 10).map((r, i) =>
                `PATCH ${i + 1}\nSEARCH:\n${String(r && r.search || "")}\nREPLACE:\n${String(r && r.replace || "")}`
              ).join("\n\n");
            } else if (c.content !== undefined && c.content !== null) {
              const full = String(c.content);
              body = full.length <= 18000
                ? full
                : `${full.slice(0, 11000)}\n\n/* [middle omitted only from repair context] */\n\n${full.slice(-5000)}`;
            }
            body = body.slice(0, budget);
            budget -= body.length;
            parts.push(`--- GENERATED CANDIDATE TO REPAIR: ${cp} ---\n${body}\n--- END GENERATED CANDIDATE ---`);
          }
          candidateRepairContext = parts.join("\n\n");
        }

        const runtimeRepairSystemPrompt = `You are a deterministic TypeScript/TSX build-error repair engine.
Return STRICT JSON only. No prose, markdown or explanation.
The current GitHub source excerpt is authoritative and comes from the failing file.
Fix the ACTIVE Lovable syntax/transform error with the SMALLEST possible edit.
Do not add or duplicate requested UI features unless required to repair the build.
Do not return changes: [].
Do not return a whole-file rewrite.
Return exactly one update change for the target file using replacements[].
Each search value MUST be an exact contiguous verbatim snippet copied from the supplied latest source, preferably 1-12 lines around the error.
The replace value must contain only the corrected version of that snippet.
Preserve all unrelated code.
Required JSON shape:
{
  "summary": "Fix active Lovable build error",
  "changes": [
    {
      "path": "${runtimeErrorContext && runtimeErrorContext.path ? runtimeErrorContext.path : "src/routes/index.tsx"}",
      "action": "update",
      "replacements": [
        {"search": "EXACT CURRENT SOURCE", "replace": "CORRECTED SOURCE"}
      ]
    }
  ]
}`;

        const retryUserContent = isRuntimeRepairRetry
          ? `${latestContext}\n\n${runtimeErrorInstruction}\n\nRepair the active build error now. Focus on the reported location and nearby source. The previous response did not provide a usable repair patch. Return only the strict JSON patch described by the system instructions.`
          : `${latestContext}\n\n${candidateRepairContext ? `${candidateRepairContext}\n\n` : ""}${projectContractContext ? `${projectContractContext}\n\n` : ""}${imageSafetyContext ? `${imageSafetyContext}\n\n` : ""}${runtimeErrorInstruction ? `${runtimeErrorInstruction}\n\n` : ""}Original User Request:\n${effectivePrompt}\n\nSafety/validation failure from the previous attempt:\n${String(reason || "Generated edit was unsafe or incomplete")}\n\nRepair the candidate instead of starting over. Preserve every already-correct feature from the generated candidate and change only what is necessary to fix the specific validation failure. Return STRICT JSON. Prefer exact replacements against the latest GitHub source for small fixes; if a full generated file itself needs syntax repair, return the corrected complete file without dropping requested functionality. Do not silently reduce the user's requested scope. If this is a fresh Lovable blank starter page, replace the root page with ONE complete full-file content value. Keep the implementation complete and syntactically valid. Never restore a broken image URL or blank-app-v1.svg/REMOVE_THIS after creating a real page. Preserve unrelated existing client work.`;
        const retryMessageContent = buildVisionUserContent(retryUserContent, visionAttachments);
        const retryCallStartedAt = Date.now();
        const retryRes = await callBackground({
          action: "bundlee_git_lovable_public_byok_chat",
          provider: provider,
          apiKey: providerApiKey,
          apiBase: config.byok_api_base || "",
          workspaceId: provider === "anthropic" ? String(config.byok_anthropic_workspace_id || "").trim() : "",
          model: activeModel,
          messages: [{ role: "user", content: retryMessageContent }],
          systemPrompt: isRuntimeRepairRetry ? runtimeRepairSystemPrompt : systemPrompt,
          maxOutputTokens: isRuntimeRepairRetry
            ? Math.max(2048, Math.min(4096, Number(maxOutputTokens || 2048)))
            : Math.max(maxOutputTokens, hasLovableBlankStarter && isMajorPageBuild ? 8192 : maxOutputTokens),
          reasoningEffort: releaseReasoningFor(provider, releaseLevelName),
          forceJson: isRuntimeRepairRetry
        });
        if (!retryRes || !retryRes.ok) throw new Error(retryRes?.error || "Automatic safe retry failed");
        diagnosticAddModelCall(diagnosticJobId, {
          purpose: isRuntimeRepairRetry ? "runtime_repair_retry" : "validation_repair_retry",
          startedAt: retryCallStartedAt,
          endedAt: Date.now(),
          durationMs: Date.now() - retryCallStartedAt,
          provider,
          requestedModel: activeModel,
          modelUsed: retryRes.model || activeModel,
          fallbackUsed: !!retryRes.fallbackUsed,
          attemptedModels: Array.isArray(retryRes.attemptedModels) ? retryRes.attemptedModels : [],
          usage: retryRes.usage || null,
          reason: String(reason || ""),
          systemPrompt: diagnosticRedactString(isRuntimeRepairRetry ? runtimeRepairSystemPrompt : systemPrompt),
          userContent: diagnosticDeepEnabled(config) ? diagnosticModelContent(retryMessageContent) : diagnosticRedactString(`Original User Request:\n${effectivePrompt}\n\nRepair reason: ${String(reason || "")}`),
          responseText: diagnosticRedactString(String(retryRes.text || ""))
        });
        const retryLine = formatUsageLine(retryRes, creditValueUsd);
        if (retryLine) hud.appendLog("💵 Retry " + retryLine, "#fbbf24");
        recordUsage(retryRes, effectivePrompt + " [client-safe retry]", config.repository);
        const retryText = String(retryRes.text || "").replace(/<think>[\s\S]*?<\/think>/i, "").trim();
        const parsed = parseAiCodeResponse(retryText, prompt, repoFiles);
        if (!parsed || !Array.isArray(parsed.changes) || !parsed.changes.length) {
          throw new Error(isRuntimeRepairRetry
            ? "The AI could not produce a valid minimal repair patch for the active Lovable build error. No GitHub commit was made."
            : "Automatic safe retry did not return complete code changes. No GitHub commit was made.");
        }
        if (looksLikeJsonImplementationEnvelope(retryText)) {
          // parseAiCodeResponse no longer auto-closes truncated JSON; if it parsed,
          // the envelope is complete enough to proceed to code validation.
          validateChangePlanShape(parsed);
        }
        return parsed;
      }

      if (runtimeErrorContext && (!previewData || !Array.isArray(previewData.changes) || previewData.changes.length === 0)) {
        const repairTargets = runtimeErrorContext.path ? [runtimeErrorContext.path] : relevantPaths;
        previewData = await regenerateOnceForSafety(
          "Lovable currently has an active preview/build error, so a no-op response is not sufficient.",
          repairTargets
        );
      } else if (!previewData && looksLikeJsonImplementationEnvelope(contentAfterThink)) {
        previewData = await regenerateOnceForSafety("The provider returned incomplete/invalid JSON.", relevantPaths);
      }

      if (previewData && Array.isArray(previewData.changes) && previewData.changes.length) {
        if (runtimeErrorContext && runtimeErrorContext.path) {
          const fixesErrorFile = previewData.changes.some(c => String(c.path || "").replace(/^\.\//, "").replace(/^\//, "") === runtimeErrorContext.path);
          if (!fixesErrorFile && !autoRetryUsed) {
            previewData = await regenerateOnceForSafety(
              `The active Lovable build error is in ${runtimeErrorContext.path}, but the generated edit did not repair that file.`,
              [runtimeErrorContext.path]
            );
          }
        }
        const prepareAndValidate = async (data) => {
          diagnosticAddValidation(diagnosticJobId, "validation_started", true, { changeCount: data && data.changes && data.changes.length || 0 });
          validateChangePlanShape(data);
          validateIntentAlignment(data, effectivePrompt, repoFiles);
          await ensurePatchTargetContents(data, repoContentMap, config, maxContextChars, hud);
          for (const c of data.changes) {
            const p = String(c.path || "").replace(/^\.\//, "").replace(/^\//, "");
            if (c.content !== undefined && c.content !== null &&
                typeof generationContextMap[p] === "string" &&
                typeof repoContentMap[p] === "string" &&
                generationContextMap[p] !== repoContentMap[p] && !autoRetryUsed) {
              throw new Error(`Stale full-file generation detected for ${p}`);
            }
          }
          let applied = applyPatchChanges(data, repoContentMap);
          applied = validatePreservation(applied, repoContentMap, effectivePrompt);
          applied = await validateGeneratedCode(applied, repoContentMap, effectivePrompt);
          applied = await validateCriticalBaselineAfterChanges(applied, repoContentMap);
          if (strictConsistency) applied = validateLocalImportGraph(applied, repoContentMap, repoFiles);
          if (strictConsistency) applied = validateNavigationRouteSafety(applied, repoContentMap, repoFiles, effectivePrompt);
          if (strictConsistency) applied = validateNavigationImplementationSafety(applied, repoContentMap, repoFiles, effectivePrompt);
          if (strictConsistency) applied = validateCommonFeatureCompletion(applied, repoContentMap, effectivePrompt);
          applied = await validateImageSafety(applied, repoContentMap, effectivePrompt, imageAudit, config);
          diagnosticAddValidation(diagnosticJobId, "deterministic_validation", true, { paths: applied && applied.changes ? applied.changes.map(c => c.path) : [] });
          return applied;
        };

        try {
          previewData = await prepareAndValidate(previewData);
        } catch (generationErr) {
          const message = String(generationErr && generationErr.message || generationErr);
          diagnosticAddValidation(diagnosticJobId, "deterministic_validation", false, { error: message });
          // Spend a second AI call only for hard structural failures that can be
          // repaired deterministically. Do not burn credits retrying advisory/image/
          // freshness issues that are better shown to the user as-is.
          const canRetry = /Patch could not be safely matched|Could not load .* safe patch|AI response validation failed|Project consistency check failed|Root route regression blocked|starter placeholder was not replaced|provider response may have been truncated|appears truncated|Intent alignment failed|Baseline project syntax check failed|Navigation route safety failed|Navigation safety failed|Feature completion check failed/i.test(message);
          if (!canRetry || autoRetryUsed) throw generationErr;

          let targetPaths = Array.from(new Set(previewData.changes
            .map(c => String(c.path || "").replace(/^\.\//, "").replace(/^\//, ""))
            .filter(Boolean)));
          const baselinePathMatch = message.match(/Baseline project syntax check failed for ([^:]+)(?::|$)/i);
          if (baselinePathMatch && baselinePathMatch[1] && repoFiles.includes(baselinePathMatch[1])) {
            targetPaths = Array.from(new Set([baselinePathMatch[1], ...targetPaths])).slice(0, maxContextFiles);
          }
          if (/Navigation route safety failed|Navigation safety failed/i.test(message)) {
            const navTargets = ["src/routes/index.tsx", "src/routes/__root.tsx"].filter(p => repoFiles.includes(p));
            targetPaths = Array.from(new Set([...navTargets, ...targetPaths])).slice(0, maxContextFiles);
          }
          if (/Intent alignment failed/i.test(message) && isBroadAppCreationPrompt(effectivePrompt)) {
            const entry = repoFiles.includes("src/routes/index.tsx") ? "src/routes/index.tsx"
              : (repoFiles.includes("src/App.tsx") ? "src/App.tsx" : (repoFiles.includes("src/App.jsx") ? "src/App.jsx" : ""));
            targetPaths = Array.from(new Set([entry, repoFiles.includes("src/routes/__root.tsx") ? "src/routes/__root.tsx" : "", ...targetPaths].filter(Boolean))).slice(0, maxContextFiles);
          }
          previewData = await regenerateOnceForSafety(message, targetPaths);
          // The retry gets one chance only. If it is still invalid, abort without commit.
          previewData = await prepareAndValidate(previewData);
        }
      }
      if (previewData && Array.isArray(previewData.changes) && previewData.changes.length && strictConsistency && !autoRetryUsed && shouldRunConsistencyReview(config.consistency_review || "smart", effectivePrompt, architectureContractRules, changeScope)) {
        updateJobStatus("Cross-checking connected features");
        hud.appendLog("🔎 Consistency review: checking routes, shared data and connected feature behavior before commit...", "#38bdf8");
        let proposedBudget = releaseLevelName === "super" ? 36000 : releaseLevelName === "medium" ? 28000 : 22000;
        const proposedParts = [];
        for (const c of previewData.changes.slice(0, 8)) {
          if (proposedBudget <= 0) break;
          let body = "";
          if (Array.isArray(c.replacements) && c.replacements.length) {
            body = c.replacements.slice(0, 8).map((r, i) => {
              const search = String(r && r.search || "").slice(0, 2400);
              const replace = String(r && r.replace || "").slice(0, 3000);
              return `PATCH ${i + 1}\nSEARCH:\n${search}\nREPLACE:\n${replace}`;
            }).join("\n\n");
          } else {
            const full = String(c.content || "");
            if (full.length <= 12000) body = full;
            else {
              const head = full.slice(0, 7000);
              const tail = full.slice(-3500);
              body = `${head}\n\n/* [middle omitted from advisory review only; full generated file is preserved and deterministic validation used the complete content] */\n\n${tail}`;
            }
          }
          body = body.slice(0, proposedBudget);
          proposedBudget -= body.length;
          proposedParts.push(`--- PROPOSED CHANGE: ${c.path} ---\n${body}\n--- END PROPOSED CHANGE ---`);
        }
        const proposedFiles = proposedParts.join("\n\n");
        const currentReviewContext = sourceContext.length <= 22000
          ? sourceContext
          : `${sourceContext.slice(0, 14000)}\n\n/* [older context omitted from advisory review] */\n\n${sourceContext.slice(-6000)}`;
        const reviewPrompt = `${projectContractContext ? `${projectContractContext}\n\n` : ""}Original user request:\n${effectivePrompt}\n\nCurrent relevant project context:\n${currentReviewContext}\n\nProposed changed files:\n${proposedFiles}\n\nReview ONLY for concrete integration/regression problems. Especially verify that newly added products/entities participate in the same shared data, links/slugs, dynamic routes/detail lookup and image rules as existing ones. Verify the request did not create a card that is non-clickable or a route that resolves to Product Not Found. Return strict JSON only: {"ok":true,"issues":[],"targetPaths":[]} when consistent, otherwise {"ok":false,"issues":["specific issue"],"targetPaths":["path/to/file"]}. Do not suggest cosmetic improvements.`;
        try {
          const reviewCallStartedAt = Date.now();
          const reviewRes = await callBackground({
            action: "bundlee_git_lovable_public_byok_chat",
            provider,
            apiKey: providerApiKey,
            apiBase: config.byok_api_base || "",
            workspaceId: provider === "anthropic" ? String(config.byok_anthropic_workspace_id || "").trim() : "",
            model: activeModel,
            messages: [{ role: "user", content: buildVisionUserContent(reviewPrompt, []) }],
            systemPrompt: "You are a strict integration reviewer. Report only concrete functional inconsistencies. Output JSON only.",
            maxOutputTokens: 900,
            reasoningEffort: releaseReasoningFor(provider, releaseLevelName),
            forceJson: true
          });
          if (reviewRes && reviewRes.ok) {
            diagnosticAddModelCall(diagnosticJobId, {
              purpose: "consistency_review",
              startedAt: reviewCallStartedAt,
              endedAt: Date.now(),
              durationMs: Date.now() - reviewCallStartedAt,
              provider,
              requestedModel: activeModel,
              modelUsed: reviewRes.model || activeModel,
              usage: reviewRes.usage || null,
              systemPrompt: "You are a strict integration reviewer. Report only concrete functional inconsistencies. Output JSON only.",
              userContent: diagnosticDeepEnabled(config) ? diagnosticModelContent(buildVisionUserContent(reviewPrompt, [])) : diagnosticRedactString(`Review for request: ${effectivePrompt}`),
              responseText: diagnosticRedactString(String(reviewRes.text || ""))
            });
            recordUsage(reviewRes, effectivePrompt + " [consistency review]", config.repository);
            const review = parseSmallJsonObject(reviewRes.text);
            if (review && review.ok === false && Array.isArray(review.issues) && review.issues.length) {
              const issueText = review.issues.slice(0, 4).join("; ");
              // Advisory only. Never destroy a deterministic-valid generation because
              // a second model review *suspects* an issue. The user can inspect the
              // completed output and send a precise follow-up prompt if needed.
              hud.appendLog("⚠ Advisory consistency warning: " + issueText, "#f59e0b");
              diagnosticAddValidation(diagnosticJobId, "advisory_consistency_review", true, {
                warning: issueText,
                targetPaths: Array.isArray(review.targetPaths) ? review.targetPaths.filter(Boolean).slice(0, 6) : []
              });
            } else {
              hud.appendLog("✓ Advisory consistency review passed", "#10b981");
            }
          } else {
            hud.appendLog("Consistency review unavailable; deterministic safety checks still passed.", "#f59e0b");
          }
        } catch (reviewErr) {
          const reviewMessage = String(reviewErr && reviewErr.message || reviewErr);
          if (/after the safe retry|validation failed/i.test(reviewMessage)) throw reviewErr;
          hud.appendLog("Consistency review skipped: " + sanitizeProviderUiError(reviewMessage), "#f59e0b");
        }
      }

      const commitBaseContentMap = {};
      if (previewData && Array.isArray(previewData.changes)) {
        previewData.changes.forEach(c => {
          const p = String(c.path || "").replace(/^\.\//, "").replace(/^\//, "");
          if (!p) return;
          commitBaseContentMap[p] = typeof repoContentMap[p] === "string" ? repoContentMap[p] : null;
        });
      }
      let hasCodeChanges = previewData && Array.isArray(previewData.changes) && previewData.changes.length > 0;

      // Read-only questions can never mutate GitHub. If a provider disobeys and
      // returns a patch, discard it rather than changing the project.
      if (conversationalIntent && hasCodeChanges) {
        const attemptedPaths = previewData.changes.map(c => String(c && c.path || "")).filter(Boolean);
        diagnosticUpdateJob(diagnosticJobId, { parsed: { responseKind: "question_patch_blocked", attemptedPaths } }, "question_patch_blocked", { attemptedPaths });
        previewData = { summary: String(previewData.summary || "Read-only question answered; no project changes were applied."), changes: [] };
        hasCodeChanges = false;
        hud.appendLog("Read-only question detected — provider patch discarded; no GitHub change made.", "#f59e0b");
      }

      // ── CONVERSATIONAL MODE: Greetings, questions, planning discussions ──
      if (!hasCodeChanges) {
        const replyText = previewData && Array.isArray(previewData.changes) && previewData.changes.length === 0 && previewData.summary
          ? String(previewData.summary)
          : (contentAfterThink || rawResponse || "I'm ready! Please let me know what you'd like to build.");

        updateJobStatus("Finishing response");
        hud.setStep(3, "AI response delivered");
        hud.appendLog("✓ AI answered conversationally in Lovable Chat", "#10b981");

        // Deliver conversational response directly into Lovable Chat
        hud.setConversationalResponse(replyText, thinking);
        showGitToast("✓ LOVABLE AI replied in chat!", "success");

        diagnosticFinishJob(diagnosticJobId, "completed_chat", { usage: byokRes.usage || null, parsed: { responseKind: "chat_reply", reply: diagnosticRedactString(replyText) } });
        return { ok: true, isChatReply: true, reply: replyText, thinking: thinking, usage: byokRes.usage || null };
      }

      // ── CODE GENERATION MODE: Code modifications & GitHub commit ──
      previewData.preview_token = "byok_" + Date.now();
      previewData.summary = previewData.summary || prompt;

      hud.appendLog("✓ AI generated " + previewData.changes.length + " modified file(s)", "#10b981");
      previewData.changes.forEach(c => {
        hud.appendLog("  • [" + (c.action || "update").toUpperCase() + "] " + c.path, "#a5f3fc");
      });

      const shouldAutoCommit = config.auto_commit !== false;

      if (shouldAutoCommit) {
        // Step 3: Auto-commit & push directly to GitHub
        updateJobStatus("Updating GitHub safely");
        hud.setStep(3, `Auto-committing ${previewData.changes.length} file(s) to GitHub (${config.branch || "main"})...`);
        hud.appendLog(`Pushing commit to ${config.repository}@${config.branch || "main"}...`, "#00f2fe");

        // Final race-condition guard: if GitHub/Lovable changed any target after we
        // generated/applied the edit, cancel rather than overwrite newer client work.
        await verifyTargetsUnchangedSinceApply(previewData, commitBaseContentMap, config, maxContextChars, hud);
        assertCurrentProjectGitTarget(config, 'Auto-commit');
        diagnosticUpdateJob(diagnosticJobId, { stage: "committing", parsed: { changes: diagnosticSanitize(previewData.changes, "changes", 0), summary: previewData.summary || prompt } }, "git_commit_started", { repository: config.repository, branch: config.branch || "main", paths: previewData.changes.map(c => c.path) });

        const commitData = await callBackground({
          action: "bundlee_git_127hub_github_commit_direct",
          repository: config.repository,
          branch: config.branch || "main",
          token: config.github_token,
          changes: previewData.changes,
          message: previewData.summary || prompt
        });

        if (!commitData || commitData.ok === false) {
          throw new Error((commitData && (commitData.error || commitData.message)) || "GitHub commit failed");
        }

        const shortSha = (commitData.sha || "").slice(0, 7) || "HEAD";
        diagnosticUpdateJob(diagnosticJobId, { git: { committed: true, sha: commitData.sha || "", shortSha, repository: config.repository, branch: config.branch || "main", verification: null } }, "git_commit_success", { sha: commitData.sha || "" });
        hud.appendLog(`✓ Commit ${shortSha} pushed to GitHub successfully!`, "#10b981");
        if (config.project_memory !== false) saveProjectContractRules(config, config.repository, [...promptContractRules, ...architectureContractRules]);
        const commitVerification = await verifyCommittedContents(previewData, config, maxContextChars, hud, commitData.sha || "");
        diagnosticUpdateJob(diagnosticJobId, { git: { verification: diagnosticSanitize(commitVerification, "verification", 0) } }, "git_verification", commitVerification);
        if (!commitVerification.ok) {
          hud.appendLog("GitHub accepted the commit, but immediate content verification is still pending. The previous version remains available in Git history.", "#f59e0b");
        }

        let previewOutcome = null;
        try {
          const sha = commitData.sha;
          updateJobStatus("Waiting for Lovable preview", { timeoutMs: 120000, resetStageTimer: true });
          hud.setStep(3, "Code committed — waiting for Lovable preview build...");
          hud.appendLog("Waiting for Lovable GitHub sync and preview build confirmation...", "#38bdf8");
          const buildBaseline = captureLovableBuildBaseline();
          await refreshLovablePreview(sha);
          previewOutcome = await waitForLovablePreviewOutcome({ timeoutMs: 120000, baseline: buildBaseline, expectedLabel: previewData.summary || prompt });
        } catch (watchErr) {
          previewOutcome = { ok: false, state: "watchdog_error", details: String(watchErr && watchErr.message || watchErr) };
        }

        diagnosticUpdateJob(diagnosticJobId, { preview: diagnosticSanitize(previewOutcome || { state: "unknown" }, "preview", 0) }, "preview_outcome", previewOutcome || { state: "unknown" });
        if (!previewOutcome || !previewOutcome.ok) {
          hud.appendLog(`Lovable preview was not confirmed healthy (${previewOutcome && previewOutcome.state || "unknown"}).`, "#f59e0b");
          const confirmedFreshFailure = !!(previewOutcome && previewOutcome.state === "failed" && previewOutcome.safeToRollback === true && previewOutcome.fresh === true);
          if (!confirmedFreshFailure) {
            const msg = `Commit ${shortSha} was pushed successfully, but Lovable did not provide a fresh build confirmation for this commit. The change was kept and no rollback was performed. Refresh the preview or retry verification if needed.`;
            hud.appendLog("Safety rule: unknown/timeout build state never triggers rollback.", "#10b981");
            hud.setConversationalResponse(msg, thinking);
            showGitToast("Commit saved; preview verification is still pending", "info", 8000);
            diagnosticFinishJob(diagnosticJobId, "completed_with_warning", { git: { committed: true, sha: commitData.sha || "" }, preview: diagnosticSanitize(previewOutcome, "preview", 0), usage: byokRes.usage || null });
            return { ok: true, verificationPending: true, data: commitData, previewOutcome, changes: previewData.changes, thinking, usage: byokRes.usage || null };
          }
          try {
            updateJobStatus("Restoring the previous working version");
            const restored = await restorePreEditFiles(previewData, commitBaseContentMap, config, maxContextChars, hud);
            const restoreSha = restored && restored.commit && restored.commit.sha ? restored.commit.sha.slice(0, 7) : "HEAD";
            const restoreHealthy = !!(restored && restored.outcome && restored.outcome.ok);
            const msg = restoreHealthy
              ? `A fresh Lovable build failure was confirmed for this commit, so the previous working version was restored automatically (${restoreSha}).`
              : `A fresh Lovable build failure was confirmed. Previous files were restored in GitHub (${restoreSha}); Lovable is still rebuilding the restored version.`;
            hud.setConversationalResponse(msg, thinking);
            showGitToast("⚠ Confirmed build failure — previous version restored", "error", 8000);
            diagnosticFinishJob(diagnosticJobId, "restored_after_failure", { git: { committed: true, sha: commitData.sha || "", restoreSha }, preview: diagnosticSanitize(previewOutcome, "preview", 0), usage: byokRes.usage || null });
            return { ok: false, restored: true, data: restored && restored.commit, previewOutcome, changes: previewData.changes, thinking, usage: byokRes.usage || null };
          } catch (restoreErr) {
            const msg = "Lovable confirmed a fresh build failure, but automatic restore was not safe to run: " + (restoreErr.message || restoreErr);
            hud.setConversationalResponse(msg, thinking);
            showGitToast("⚠ Build failed; automatic restore was cancelled to protect newer work", "error", 9000);
            diagnosticFinishJob(diagnosticJobId, "failed_restore_unsafe", { error: msg, git: { committed: true, sha: commitData.sha || "" }, preview: diagnosticSanitize(previewOutcome, "preview", 0), usage: byokRes.usage || null });
            return { ok: false, restored: false, previewOutcome, error: msg, changes: previewData.changes, thinking, usage: byokRes.usage || null };
          }
        }

        hud.appendLog("✓ Lovable preview build confirmed healthy", "#10b981");
        recordProjectHistory(config, config.repository, effectivePrompt, previewData.summary || prompt, previewData.changes);
        showGitToast(`✓ Change applied and preview updated (${shortSha})`, "success", 6000);

        hud.setSuccess(
          commitData.sha,
          previewData.changes,
          previewData.summary || prompt,
          config.branch || "main",
          () => showDiffPreviewModal(previewData, null, null, true),
          thinking
        );

        diagnosticFinishJob(diagnosticJobId, "completed", { git: { committed: true, sha: commitData.sha || "", repository: config.repository, branch: config.branch || "main" }, preview: diagnosticSanitize(previewOutcome, "preview", 0), usage: byokRes.usage || null });
        return { ok: true, data: commitData, previewOutcome, changes: previewData.changes, thinking: thinking, usage: byokRes.usage || null };
      } else {
        // Manual mode: open Diff Preview Modal
        hud.setStep(3, `Reviewing ${previewData.changes.length} modified file(s)...`);
        await new Promise(r => setTimeout(r, 400));
        hud.close();
        diagnosticUpdateJob(diagnosticJobId, { stage: "waiting_user_review", parsed: { changes: diagnosticSanitize(previewData.changes, "changes", 0), summary: previewData.summary || prompt } }, "manual_diff_opened", { changeCount: previewData.changes.length });

        injectMessageIntoLovableChat({
          isPending: false,
          promptText: prompt,
          thinking: thinking,
          replyText: `Generated modifications for ${previewData.changes.length} file(s). Reviewing diff modal...`
        });

        console.log("[LOVABLE AI] ⚡ Opening Diff Preview Modal with", previewData.changes.length, "changes");

        return await new Promise((resolve, reject) => {
          showDiffPreviewModal(
            previewData,
            async () => {
              console.log("[LOVABLE AI] ⚡ Committing BYOK changes directly to GitHub API...");
              showGitToast("🐙 Committing changes to GitHub...", "info", 4000);

              await verifyTargetsUnchangedSinceApply(previewData, commitBaseContentMap, config, maxContextChars, hud);
              assertCurrentProjectGitTarget(config, 'Manual commit');

              const commitData = await callBackground({
                action: "bundlee_git_127hub_github_commit_direct",
                repository: config.repository,
                branch: config.branch || "main",
                token: config.github_token,
                changes: previewData.changes,
                message: previewData.summary || prompt
              });

              if (!commitData || commitData.ok === false) {
                throw new Error((commitData && (commitData.error || commitData.message)) || "GitHub commit failed");
              }

              if (config.project_memory !== false) saveProjectContractRules(config, config.repository, [...promptContractRules, ...architectureContractRules]);
              recordProjectHistory(config, config.repository, effectivePrompt, previewData.summary || prompt, previewData.changes);

              const commitVerification = await verifyCommittedContents(previewData, config, maxContextChars, hud, commitData.sha || "");
              if (!commitVerification.ok) {
                showGitToast("Commit pushed, but immediate GitHub verification is still pending. The previous version remains in Git history.", "info", 6000);
              }

              try {
                const sha = commitData.sha;
                await refreshLovablePreview(sha);
              } catch (_) {}

              injectMessageIntoLovableChat({
                isPending: false,
                promptText: prompt,
                thinking: thinking,
                replyText: previewData.summary || "Committed code updates to GitHub.",
                commitSha: commitData.sha,
                filesCount: previewData.changes.length
              });

              diagnosticFinishJob(diagnosticJobId, "completed_manual", { git: { committed: true, sha: commitData.sha || "", repository: config.repository, branch: config.branch || "main" }, usage: byokRes.usage || null });
              resolve({ ok: true, data: commitData, changes: previewData.changes, thinking: thinking });
            },
            () => {
              diagnosticFinishJob(diagnosticJobId, "discarded", { error: "User discarded generated diff" });
              resolve({ ok: false, discarded: true });
            },
            false
          );
        });
      }
    } catch (error) {
      jobHadError = true;
      const safeError = sanitizeProviderUiError(error && error.message ? error.message : String(error));
      diagnosticFinishJob(diagnosticJobId, "failed", { error: safeError });
      persistRecoveryJob({ status: "failed", stage: "Stopped safely", error: safeError, prompt: originalPrompt });
      console.error("[LOVABLE AI BYOK] Error:", safeError);
      hud.setError("Generation Failed", safeError);
      showGitToast(safeError || "BYOK generation failed", "error");
      const safeWrapped = new Error(safeError);
      throw safeWrapped;
    } finally {
      const finishedRecoveryScopeKey = LOVASIRI_ACTIVE_RECOVERY_SCOPE_KEY;
      if (!jobHadError) clearRecoveryJob(finishedRecoveryScopeKey);
      LOVASIRI_ACTIVE_RECOVERY_SCOPE_KEY = "";
      window.__lovableAiGitJobRunning = false;
      finishJobStatus(jobHadError ? "Prompt saved — ready to retry" : "Ready for your next prompt");
    }
  }

  // Public Interface
  const _gitModeApi = {
    openSettings: openGitSettings,
    previewAndConfirm: previewAndConfirm,
    getConfig: getGitConfig,
    saveConfig: saveGitConfig,
    isConfigured: isGitConfigured,
    getLovableProjectName: getLovableProjectName,
    getDeviceId: getConsistentDeviceId,
    getRecoveryJob,
    retryLastPrompt: () => {
      const job = getRecoveryJob();
      if (job && job.prompt) return previewAndConfirm(job.prompt, []);
      return Promise.resolve({ ok: false, message: getForeignRecoveryJobs().length ? "Saved prompt belongs to another project" : "No saved prompt" });
    },
    refreshPreview: refreshLovablePreview,
    exportDiagnostics: exportDeveloperDiagnostics,
    diagnosticStats: diagnosticStatsForCurrentProject
  };

  window.__127hubGitMode = _gitModeApi;
  try {
    if (window.top && window.top !== window) {
      window.top.__127hubGitMode = _gitModeApi;
    }
  } catch (_) {}

  // Keyboard shortcut (Alt+G) - Global across all contexts & frames
  function handleAltGShortcut(e) {
    if (e.altKey && (e.key === "g" || e.key === "G" || e.code === "KeyG")) {
      e.preventDefault();
      e.stopPropagation();
      openGitSettings();
    }
  }

  window.addEventListener("keydown", handleAltGShortcut, { capture: true });
  document.addEventListener("keydown", handleAltGShortcut, { capture: true });
  try {
    if (window.top && window.top !== window) {
      window.top.addEventListener("keydown", handleAltGShortcut, { capture: true });
      window.top.document.addEventListener("keydown", handleAltGShortcut, { capture: true });
    }
  } catch (_) {}

  // First-time setup check: Auto-open settings if git_mode is active but unconfigured
  function checkFirstTimeSetup() {
    try {
      const activeMethod = (document.documentElement && document.documentElement.getAttribute("data-lovasiri-method")) 
        || localStorage.getItem("lovasiriMethod")
        || window.__lovasiri_native_method;
      if (activeMethod === "git_mode" && !isGitConfigured()) {
        setTimeout(() => {
          if (!document.getElementById("127hub-git-settings-backdrop")) {
            console.log("[LOVABLE AI Git Mode] 1st-time / Unconfigured Git Mode detected — automatically opening setup panel.");
            openGitSettings();
          }
        }, 1200);
      }
    } catch (_) {}
  }

  // Listen for method switch to git_mode
  window.addEventListener("message", (ev) => {
    try {
      if (ev.data && (ev.data.type === "lovasiriNativeIntercept" || ev.data.items?.pk_active_method || ev.data.method)) {
        const m = ev.data.method || (ev.data.items && ev.data.items.pk_active_method);
        if (m === "git_mode" && !isGitConfigured()) {
          setTimeout(() => {
            if (!document.getElementById("127hub-git-settings-backdrop")) {
              openGitSettings();
            }
          }, 300);
        }
      }
    } catch (_) {}
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(checkFirstTimeSetup, 1000));
  } else {
    setTimeout(checkFirstTimeSetup, 1000);
  }

})();
