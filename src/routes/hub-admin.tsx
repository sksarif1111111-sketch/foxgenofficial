import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  adminAdjustCredits,
  adminApproveReferral,
  adminBotStatus,
  adminBroadcast,
  adminImportLicenses,
  adminInventory,
  adminOverview,
  adminReferrals,
  adminRejectReferral,
  adminRewards,
  adminSaveReward,
  adminSaveSettings,
  adminResetUserTasks,
  adminSaveTask,
  adminSetUserStatus,
  adminSetWebhook,
  adminSettings,
  adminTasks,
  adminUsers,
  type AdminOverview,
} from "@/lib/hubadmin.functions";

export const Route = createFileRoute("/hub-admin")({
  head: () => ({
    meta: [
      { title: "Rewards Hub Admin — FoxGEN PRO" },
      {
        name: "description",
        content: "Manage members, referrals, credits, license inventory, tasks, rewards and the Telegram bot.",
      },
      { property: "og:title", content: "Rewards Hub Admin — FoxGEN PRO" },
      { property: "og:description", content: "Full control panel for the FoxGEN PRO Rewards Hub." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HubAdmin,
});

const SECTIONS = ["Overview", "Users", "Referrals", "Licenses", "Rewards", "Tasks", "Links", "Bot"] as const;
type Section = (typeof SECTIONS)[number];

const LINK_FIELDS = [
  "brand_name",
  "brand_description",
  "site_url",
  "extension_name",
  "extension_version",
  "extension_download_url",
  "installation_guide_url",
  "tutorial_url",
  "youtube_url",
  "whatsapp_url",
  "facebook_url",
  "telegram_channel_1",
  "telegram_channel_1_name",
  "telegram_channel_2",
  "telegram_channel_2_name",

  "support_url",
  "referral_message",
  "min_inventory_alert",
];

type UserRow = Awaited<ReturnType<typeof adminUsers>>[number];
type RewardRow = Awaited<ReturnType<typeof adminRewards>>[number];
type TaskRow = Awaited<ReturnType<typeof adminTasks>>[number];
type InvRow = Awaited<ReturnType<typeof adminInventory>>[number];
type RefRow = Awaited<ReturnType<typeof adminReferrals>>[number];
type BotInfo = Awaited<ReturnType<typeof adminBotStatus>>;

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-5">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-black">{value}</p>
    </div>
  );
}

function HubAdmin() {
  const fOverview = useServerFn(adminOverview);
  const fUsers = useServerFn(adminUsers);
  const fStatus = useServerFn(adminSetUserStatus);
  const fCredits = useServerFn(adminAdjustCredits);
  const fRewards = useServerFn(adminRewards);
  const fSaveReward = useServerFn(adminSaveReward);
  const fTasks = useServerFn(adminTasks);
  const fSaveTask = useServerFn(adminSaveTask);
  const fResetTasks = useServerFn(adminResetUserTasks);
  const fImport = useServerFn(adminImportLicenses);
  const fInventory = useServerFn(adminInventory);
  const fSettings = useServerFn(adminSettings);
  const fSaveSettings = useServerFn(adminSaveSettings);
  const fBot = useServerFn(adminBotStatus);
  const fWebhook = useServerFn(adminSetWebhook);
  const fBroadcast = useServerFn(adminBroadcast);
  const fReferrals = useServerFn(adminReferrals);
  const fApproveReferral = useServerFn(adminApproveReferral);
  const fRejectReferral = useServerFn(adminRejectReferral);

  const [section, setSection] = useState<Section>("Overview");
  const [flash, setFlash] = useState<string | null>(null);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");
  const [rewards, setRewards] = useState<RewardRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [inventory, setInventory] = useState<InvRow[]>([]);
  const [referrals, setReferrals] = useState<RefRow[]>([]);
  const [referralSearch, setReferralSearch] = useState("");
  const [referralStatus, setReferralStatus] = useState<"all" | "pending" | "verified" | "rejected" | "suspicious">("all");
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [bot, setBot] = useState<BotInfo | null>(null);
  const [keys, setKeys] = useState("");
  const [days, setDays] = useState(30);
  const [broadcast, setBroadcast] = useState("");

  const loadSection = useCallback(
    async (s: Section) => {
      try {
        if (s === "Overview") setOverview(await fOverview({ data: undefined }));
        if (s === "Users") setUsers(await fUsers({ data: { search } }));
        if (s === "Referrals") setReferrals(await fReferrals({ data: { search: referralSearch, status: referralStatus } }));
        if (s === "Licenses") setInventory(await fInventory({ data: undefined }));
        if (s === "Rewards") setRewards(await fRewards({ data: undefined }));
        if (s === "Tasks") setTasks(await fTasks({ data: undefined }));
        if (s === "Links") setSettings(await fSettings({ data: undefined }));
        if (s === "Bot") {
          setSettings(await fSettings({ data: undefined }));
          setBot(await fBot({ data: undefined }));
        }
      } catch (err) {
        setFlash(err instanceof Error ? err.message : "Could not load data.");
      }
    },
    [fOverview, fUsers, fReferrals, fInventory, fRewards, fTasks, fSettings, fBot, search, referralSearch, referralStatus],
  );

  useEffect(() => {
    void loadSection(section);
  }, [section, loadSection]);

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <h1 className="text-3xl font-black">🦊 Rewards Hub Admin</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Everything below is live data. Changes apply to the website and the Telegram bot instantly.
      </p>

      <nav className="mb-6 flex flex-wrap gap-2">
        {SECTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setSection(s)}
            className={`rounded-full border px-4 py-2 text-xs font-bold ${
              section === s ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"
            }`}
          >
            {s}
          </button>
        ))}
        <a href="/admin" className="rounded-full border border-border px-4 py-2 text-xs font-bold text-muted-foreground">
          License generator
        </a>
      </nav>

      {flash && <p className="mb-4 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm">{flash}</p>}

      {section === "Overview" && overview && (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Total users" value={overview.totalUsers} />
          <Stat label="New today" value={overview.newToday} />
          <Stat label="Active users" value={overview.activeUsers} />
          <Stat label="Referrals" value={overview.totalReferrals} />
          <Stat label="Verified referrals" value={overview.verifiedReferrals} />
          <Stat label="Pending referrals" value={overview.pendingReferrals} />
          <Stat label="Credits issued" value={overview.creditsIssued} />
          <Stat label="Credits spent" value={overview.creditsSpent} />
          <Stat label="Licenses redeemed" value={overview.redemptions} />
          {overview.inventory.map((i) => (
            <Stat key={i.duration_days} label={`${i.duration_days}d available`} value={i.available} />
          ))}
        </section>
      )}

      {section === "Users" && (
        <section className="space-y-3">
          <div className="flex gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search username, name or code"
              className="flex-1 rounded-xl border border-border bg-background px-4 py-2 text-sm"
            />
            <button
              onClick={() => void loadSection("Users")}
              className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
            >
              Search
            </button>
          </div>
          {users.map((u) => (
            <div key={u.id} className="rounded-2xl border border-border bg-card/60 p-4 text-sm">
              <p className="font-bold">
                {u.telegram_username ? `@${u.telegram_username}` : (u.first_name ?? "Member")}{" "}
                <span className="text-xs text-muted-foreground">
                  · TG {u.telegram_user_id} · {u.referral_code} · {u.status}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                Credits {u.credits_available} (earned {u.credits_earned}, spent {u.credits_spent})
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(["active", "banned", "suspicious", "pending"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={async () => {
                      await fStatus({ data: { id: u.id, status: s } });
                      setFlash(`Status set to ${s}`);
                      void loadSection("Users");
                    }}
                    className="rounded-lg border border-border px-3 py-1 text-xs font-semibold"
                  >
                    {s}
                  </button>
                ))}
                {[1, 5, -1, -5].map((amount) => (
                  <button
                    key={amount}
                    onClick={async () => {
                      await fCredits({ data: { id: u.id, amount, reason: "Admin adjustment" } });
                      setFlash(`${amount > 0 ? "+" : ""}${amount} credits applied`);
                      void loadSection("Users");
                    }}
                    className="rounded-lg border border-border px-3 py-1 text-xs font-semibold"
                  >
                    {amount > 0 ? `+${amount}` : amount} credit
                  </button>
                ))}
                <button
                  onClick={async () => {
                    await fResetTasks({ data: { userId: u.id } });
                    setFlash("Task progress reset");
                    void loadSection("Users");
                  }}
                  className="rounded-lg border border-border px-3 py-1 text-xs font-semibold"
                >
                  Reset tasks
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {section === "Referrals" && (
        <section className="space-y-2 text-sm">
          <div className="flex flex-wrap gap-2">
            <input value={referralSearch} onChange={(e) => setReferralSearch(e.target.value)} placeholder="Search referral code or member" className="min-w-64 flex-1 rounded-xl border border-border bg-background px-4 py-2 text-sm" />
            <select value={referralStatus} onChange={(e) => setReferralStatus(e.target.value as typeof referralStatus)} className="rounded-xl border border-border bg-background px-3 py-2 text-sm">
              {(["all", "pending", "verified", "rejected", "suspicious"] as const).map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
            <button onClick={() => void loadSection("Referrals")} className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground">Search</button>
          </div>
          {referrals.map((r) => (
            <div key={r.id} className="rounded-xl border border-border bg-card/60 p-4">
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <p className="font-bold">{profileLabel(r.referrer)} <span className="text-muted-foreground">→</span> {profileLabel(r.referred)}</p>
                  <p className="text-xs text-muted-foreground">Code: {profileCode(r.referrer)} · {new Date(r.created_at).toLocaleString()}</p>
                </div>
                <span className="font-bold">{r.status} {r.credit_awarded ? "· credited" : "· not credited"}</span>
              </div>
              {r.status === "pending" && !r.credit_awarded && (
                <div className="mt-3 flex gap-2">
                  <button onClick={async () => { try { await fApproveReferral({ data: { id: r.id } }); setFlash("Referral approved and one credit awarded"); } catch (err) { setFlash(err instanceof Error ? err.message : "Approval failed"); } void loadSection("Referrals"); }} className="rounded-lg bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">Approve</button>
                  <button onClick={async () => { try { await fRejectReferral({ data: { id: r.id } }); setFlash("Referral rejected"); } catch (err) { setFlash(err instanceof Error ? err.message : "Rejection failed"); } void loadSection("Referrals"); }} className="rounded-lg border border-destructive px-3 py-1 text-xs font-bold text-destructive">Reject</button>
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {section === "Licenses" && (
        <section className="space-y-4">
          <div className="rounded-2xl border border-border bg-card/60 p-5">
            <p className="font-bold">Bulk import</p>
            <textarea
              value={keys}
              onChange={(e) => setKeys(e.target.value)}
              rows={6}
              placeholder={"LICENSE-ABC-123\nLICENSE-DEF-456"}
              className="mt-2 w-full rounded-xl border border-border bg-background p-3 font-mono text-xs"
            />
            <div className="mt-2 flex items-center gap-2">
              <select
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
              >
                {[15, 30, 60].map((d) => (
                  <option key={d} value={d}>
                    {d} days
                  </option>
                ))}
              </select>
              <button
                onClick={async () => {
                  const res = await fImport({ data: { keys, durationDays: days } });
                  setFlash(`Imported ${res.imported}, duplicates skipped ${res.duplicates}`);
                  setKeys("");
                  void loadSection("Licenses");
                }}
                className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
              >
                Import
              </button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Inventory is optional — if a category is empty, a fresh key is generated automatically on redemption.
            </p>
          </div>
          <div className="space-y-1 text-sm">
            {inventory.map((l) => (
              <div key={l.id} className="flex justify-between rounded-xl border border-border bg-card/60 p-3">
                <span className="font-mono text-xs">{l.license_key}</span>
                <span>
                  {l.duration_days}d · {l.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {section === "Rewards" && (
        <section className="space-y-3">
          {rewards.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card/60 p-4">
              <span className="flex-1 font-bold">
                {r.name} ({r.duration_days} days)
              </span>
              <input
                type="number"
                defaultValue={r.credit_cost}
                onBlur={async (e) => {
                  await fSaveReward({
                    data: { id: r.id, credit_cost: Number(e.target.value), enabled: r.enabled },
                  });
                  setFlash("Reward price saved");
                }}
                className="w-24 rounded-xl border border-border bg-background px-3 py-2 text-sm"
              />
              <button
                onClick={async () => {
                  await fSaveReward({ data: { id: r.id, credit_cost: r.credit_cost, enabled: !r.enabled } });
                  void loadSection("Rewards");
                }}
                className="rounded-lg border border-border px-3 py-1 text-xs font-semibold"
              >
                {r.enabled ? "Disable" : "Enable"}
              </button>
            </div>
          ))}
        </section>
      )}

      {section === "Tasks" && (
        <section className="space-y-3">
          {tasks.map((t) => (
            <div key={t.id} className="space-y-2 rounded-2xl border border-border bg-card/60 p-4">
              <input
                defaultValue={t.name}
                placeholder="▶️ Task name (icon + text)"
                onBlur={(e) => void fSaveTask({ data: { ...toTaskInput(t), name: e.target.value } })}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-bold"
              />
              <textarea
                defaultValue={t.description ?? ""}
                rows={2}
                placeholder="Description shown to members"
                onBlur={(e) => void fSaveTask({ data: { ...toTaskInput(t), description: e.target.value } })}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              />
              <input
                defaultValue={t.url ?? ""}
                placeholder="https://…"
                onBlur={(e) => void fSaveTask({ data: { ...toTaskInput(t), url: e.target.value } })}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              />
              <input
                type="number"
                defaultValue={t.display_order}
                placeholder="Display order"
                onBlur={async () => {
                  void 0;
                }}
                onChange={(e) => {
                  const order = Number(e.target.value);
                  if (Number.isFinite(order)) void fSaveTask({ data: { ...toTaskInput(t), display_order: order } });
                }}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              />
              {t.verification_type === "telegram_auto_verification" && (
                <input
                  defaultValue={t.telegram_chat_id ?? ""}
                  placeholder="@channelusername or -100…"
                  onBlur={(e) => void fSaveTask({ data: { ...toTaskInput(t), telegram_chat_id: e.target.value } })}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                />
              )}

              <div className="flex flex-wrap gap-2 text-xs">
                <button
                  onClick={async () => {
                    await fSaveTask({ data: { ...toTaskInput(t), enabled: !t.enabled } });
                    void loadSection("Tasks");
                  }}
                  className="rounded-lg border border-border px-3 py-1 font-semibold"
                >
                  {t.enabled ? "Enabled" : "Disabled"}
                </button>
                <button
                  onClick={async () => {
                    await fSaveTask({ data: { ...toTaskInput(t), required: !t.required } });
                    void loadSection("Tasks");
                  }}
                  className="rounded-lg border border-border px-3 py-1 font-semibold"
                >
                  {t.required ? "Required" : "Optional"}
                </button>
                <button
                  onClick={async () => {
                    await fSaveTask({
                      data: {
                        ...toTaskInput(t),
                        verification_type:
                          t.verification_type === "manual_confirmation"
                            ? "telegram_auto_verification"
                            : "manual_confirmation",
                      },
                    });
                    void loadSection("Tasks");
                  }}
                  className="rounded-lg border border-border px-3 py-1 font-semibold"
                >
                  {t.verification_type === "manual_confirmation" ? "Manual check" : "Telegram auto-check"}
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {section === "Links" && (
        <section className="grid gap-3 sm:grid-cols-2">
          {LINK_FIELDS.map((key) => (
            <label key={key} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {key.replace(/_/g, " ")}
              <input
                defaultValue={settings[key] ?? ""}
                onBlur={async (e) => {
                  await fSaveSettings({ data: { values: { [key]: e.target.value } } });
                  setFlash("Saved");
                }}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-normal normal-case text-foreground"
              />
            </label>
          ))}
        </section>
      )}

      {section === "Bot" && (
        <section className="space-y-4">
          <div className="rounded-2xl border border-border bg-card/60 p-5 text-sm">
            <p className="font-bold">Telegram bot</p>
            <p className="text-muted-foreground">
              Status: {bot?.connected ? "connected" : "not connected"}
              {bot?.username ? ` · @${bot.username}` : ""}
            </p>
            <p className="break-all text-xs text-muted-foreground">Webhook: {bot?.webhookUrl || "not set"}</p>
            {bot?.lastError && <p className="text-xs text-destructive">Last error: {bot.lastError}</p>}
            <p className="mt-2 text-xs text-muted-foreground">The bot token is stored securely and never shown.</p>
            <button
              onClick={async () => {
                const res = await fWebhook({ data: { baseUrl: window.location.origin } });
                setFlash(res.ok ? `Webhook connected: ${res.url}` : `Failed: ${res.description}`);
                void loadSection("Bot");
              }}
              className="mt-3 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
            >
              Connect / refresh webhook
            </button>
          </div>
          <div className="rounded-2xl border border-border bg-card/60 p-5">
            <p className="font-bold">Broadcast to all members</p>
            <textarea
              value={broadcast}
              onChange={(e) => setBroadcast(e.target.value)}
              rows={4}
              className="mt-2 w-full rounded-xl border border-border bg-background p-3 text-sm"
            />
            <button
              onClick={async () => {
                const res = await fBroadcast({ data: { message: broadcast } });
                setFlash(`Sent to ${res.sent}/${res.total} members`);
                setBroadcast("");
              }}
              className="mt-2 rounded-xl bg-accent px-4 py-2 text-xs font-bold text-primary-foreground"
            >
              Send broadcast
            </button>
          </div>
        </section>
      )}
    </main>
  );
}

function toTaskInput(t: TaskRow) {
  return {
    id: t.id,
    name: t.name,
    description: t.description ?? "",
    url: t.url ?? "",
    telegram_chat_id: t.telegram_chat_id ?? "",
    verification_type: t.verification_type as "manual_confirmation" | "telegram_auto_verification",
    display_order: t.display_order,
    required: t.required,
    enabled: t.enabled,
  };
}

function relatedProfile(value: unknown) {
  const profile = Array.isArray(value) ? value[0] : value;
  return profile && typeof profile === "object" ? profile as Record<string, unknown> : null;
}

function profileLabel(value: unknown) {
  const profile = relatedProfile(value);
  if (!profile) return "Unknown member";
  return profile.telegram_username ? `@${String(profile.telegram_username)}` : String(profile.first_name ?? "Member");
}

function profileCode(value: unknown) {
  return String(relatedProfile(value)?.referral_code ?? "—");
}

