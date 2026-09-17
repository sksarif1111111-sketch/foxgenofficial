import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  adminAdjustCredits,
  adminApproveReferral,
  adminBotStatus,
  adminBroadcast,
  adminClearLogs,
  adminDeleteReward,
  adminDeleteTask,
  adminLicenseDurations,
  adminLogs,
  adminRedemptions,
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
  adminGuidePages,
  adminSaveGuidePage,
  adminDeleteGuidePage,
  adminTasks,
  adminTestTelegramChannels,
  adminUsers,
  type AdminOverview,
} from "@/lib/hubadmin.functions";
import { ActivityPanel, CatalogPanel, ProductFilesPanel, ProductsPanel } from "@/components/admin/catalog-panels";
import { BuyingPanel, ShopProductsPanel, WalletPanel } from "@/components/admin/shop-panels";

export const Route = createFileRoute("/hub-admin")({
  head: () => ({
    meta: [
      { title: "Rewards Hub Admin — FoxGEN PRO" },
      {
        name: "description",
        content: "Manage members, referrals, credits, generated licenses, tasks, rewards and the Telegram bot.",
      },
      { property: "og:title", content: "Rewards Hub Admin — FoxGEN PRO" },
      { property: "og:description", content: "Full control panel for the FoxGEN PRO Rewards Hub." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HubAdmin,
});

const SECTIONS = [
  "Overview",
  "Shop",
  "Buying",
  "Products",
  "Catalog",
  "Users",
  "Referrals",
  "Licenses",
  "Rewards",
  "Tasks",
  "Extension",
  "Instructions",
  "Branding",
  "Links",

  "Bot",
  "Activity",
  "Logs",
] as const;
type Section = (typeof SECTIONS)[number];

const EXTENSION_FIELDS = [
  "extension_name",
  "extension_version",
  "extension_release_date",
  "extension_file_size",
  "extension_description",
  "extension_download_url",
  "extension_file_url",
  "extension_telegram_file_id",
  "installation_guide_url",
  "tutorial_url",
];

const LINK_FIELDS = [
  "brand_name",
  "brand_description",
  "site_url",
  "logo_url",
  "youtube_url",
  "whatsapp_url",
  "whatsapp_official_url",
  "community_url",
  "facebook_url",
  "telegram_channel_1",
  "telegram_channel_1_name",
  "telegram_channel_1_id",
  "telegram_channel_2",
  "telegram_channel_2_name",
  "telegram_channel_2_id",
  "support_url",
  "pricing_url",
  "official_website_url",
  "whatsapp_support_url",
  "pricing_message",
  "extension_download_url",
  "installation_guide_url",
  "tutorial_url",
  "referral_message",
];

const BRAND_FIELDS = ["store_name", "store_tagline", "brand_name", "brand_description", "logo_url"];

const EMOJI_FIELDS = [
  "emoji_brand",
  "emoji_shop",
  "emoji_rewards",
  "emoji_profile",
  "emoji_invite",
  "emoji_support",
  "emoji_community",
  "emoji_tasks",
  "emoji_extension",
  "emoji_credits",
  "emoji_license",
  "emoji_rank",
  "emoji_help",
  "emoji_back",
  "emoji_success",
  "emoji_error",
  "emoji_loading",
];




type UserRow = Awaited<ReturnType<typeof adminUsers>>[number];
type RewardRow = Awaited<ReturnType<typeof adminRewards>>[number];
type TaskRow = Awaited<ReturnType<typeof adminTasks>>[number];
type RedemptionRow = Awaited<ReturnType<typeof adminRedemptions>>[number];
type RefRow = Awaited<ReturnType<typeof adminReferrals>>[number];
type BotInfo = Awaited<ReturnType<typeof adminBotStatus>>;
type LogRow = Awaited<ReturnType<typeof adminLogs>>[number];


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
  const fDeleteReward = useServerFn(adminDeleteReward);
  const fDurations = useServerFn(adminLicenseDurations);
  const fTasks = useServerFn(adminTasks);
  const fSaveTask = useServerFn(adminSaveTask);
  const fDeleteTask = useServerFn(adminDeleteTask);
  const fTestChannels = useServerFn(adminTestTelegramChannels);
  const fResetTasks = useServerFn(adminResetUserTasks);
  const fRedemptions = useServerFn(adminRedemptions);
  const fSettings = useServerFn(adminSettings);
  const fSaveSettings = useServerFn(adminSaveSettings);
  const fBot = useServerFn(adminBotStatus);
  const fWebhook = useServerFn(adminSetWebhook);
  const fBroadcast = useServerFn(adminBroadcast);
  const fReferrals = useServerFn(adminReferrals);
  const fApproveReferral = useServerFn(adminApproveReferral);
  const fRejectReferral = useServerFn(adminRejectReferral);
  const fLogs = useServerFn(adminLogs);
  const fClearLogs = useServerFn(adminClearLogs);
  const fGuidePages = useServerFn(adminGuidePages);
  const fSaveGuidePage = useServerFn(adminSaveGuidePage);
  const fDeleteGuidePage = useServerFn(adminDeleteGuidePage);
  const [guidePages, setGuidePages] = useState<
    Array<{ id: string; heading: string; body: string; display_order: number; published: boolean; updated_at: string }>
  >([]);
  const [newGuidePage, setNewGuidePage] = useState({ heading: "", body: "", display_order: 10 });
  const [guidePreview, setGuidePreview] = useState(false);

  const [section, setSection] = useState<Section>("Overview");
  const [flash, setFlash] = useState<string | null>(null);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");
  const [rewards, setRewards] = useState<RewardRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [newTask, setNewTask] = useState({ name: "", platform: "youtube", url: "", description: "", telegram_chat_id: "", verification_type: "manual_confirmation" as "manual_confirmation" | "telegram_auto_verification", required: true, enabled: true, display_order: 10 });
  const [channelTests, setChannelTests] = useState<Awaited<ReturnType<typeof adminTestTelegramChannels>> | null>(null);
  const [redemptions, setRedemptions] = useState<RedemptionRow[]>([]);
  const [durations, setDurations] = useState<number[]>([15, 30, 60]);
  const [newReward, setNewReward] = useState({ name: "", duration_days: 15, credit_cost: 5 });
  const [referrals, setReferrals] = useState<RefRow[]>([]);
  const [referralSearch, setReferralSearch] = useState("");
  const [referralStatus, setReferralStatus] = useState<"all" | "pending" | "verified" | "rejected" | "suspicious">("all");
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [bot, setBot] = useState<BotInfo | null>(null);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [logCategory, setLogCategory] = useState("all");
  const [broadcast, setBroadcast] = useState("");

  const loadSection = useCallback(
    async (s: Section) => {
      try {
        if (s === "Overview") setOverview(await fOverview({ data: undefined }));
        if (s === "Users") setUsers(await fUsers({ data: { search } }));
        if (s === "Referrals") setReferrals(await fReferrals({ data: { search: referralSearch, status: referralStatus } }));
        if (s === "Licenses") {
          setRedemptions(await fRedemptions({ data: undefined }));
          setDurations(await fDurations({ data: undefined }));
        }
        if (s === "Rewards") {
          setRewards(await fRewards({ data: undefined }));
          setDurations(await fDurations({ data: undefined }));
        }
        if (s === "Tasks") setTasks(await fTasks({ data: undefined }));
        if (s === "Links" || s === "Extension" || s === "Branding" || s === "Instructions") {
          setSettings(await fSettings({ data: undefined }));
        }
        if (s === "Instructions") setGuidePages(await fGuidePages({ data: undefined }));
        if (s === "Logs") setLogs(await fLogs({ data: { category: logCategory } }));
        if (s === "Bot") {
          setSettings(await fSettings({ data: undefined }));
          setBot(await fBot({ data: undefined }));
        }
      } catch (err) {
        setFlash(err instanceof Error ? err.message : "Could not load data.");
      }
    },
    [fOverview, fUsers, fReferrals, fRedemptions, fRewards, fDurations, fTasks, fSettings, fBot, fLogs, fGuidePages, logCategory, search, referralSearch, referralStatus],
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
          <Stat label="Total products" value={overview.totalProducts} />
          <Stat label="Active products" value={overview.activeProducts} />
          <Stat label="Generated licenses" value={overview.generatedLicenses} />
          {overview.generatedByDuration.map((i) => (
            <Stat key={i.duration_days} label={`${i.duration_days}d generated`} value={i.total} />
          ))}
        </section>
      )}

      {section === "Shop" && <ShopProductsPanel notify={setFlash} />}
      {section === "Buying" && (
        <div className="space-y-6">
          <BuyingPanel notify={setFlash} />
          <WalletPanel notify={setFlash} />
        </div>
      )}
      {section === "Products" && <ProductsPanel notify={setFlash} />}
      {section === "Catalog" && <CatalogPanel notify={setFlash} />}
      {section === "Activity" && <ActivityPanel notify={setFlash} />}

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
            <p className="font-bold">Automatic license generation</p>
            <p className="mt-2 text-sm text-muted-foreground">When a member redeems a reward, a unique FoxGEN license is created instantly in the main license system. No key upload or inventory refill is required.</p>
          </div>
          <div><h2 className="mb-2 text-lg font-black">Generated license history</h2><div className="space-y-1">{redemptions.map((r) => <div key={r.id} className="grid gap-1 rounded-xl border border-border bg-card/60 p-3 text-xs sm:grid-cols-[1fr_auto]"><div><p className="font-mono text-primary">{r.license_key}</p><p className="text-muted-foreground">{profileLabel(r.user)} · {r.reward_name}</p></div><p>{r.duration_days}d · {r.credits_used} credits · {new Date(r.redeemed_at).toLocaleString()}</p></div>)}</div></div>
        </section>
      )}

      {section === "Rewards" && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card/60 p-4">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reward name
              <input value={newReward.name} onChange={(e) => setNewReward({ ...newReward, name: e.target.value })} className="mt-1 w-56 rounded-xl border border-border bg-background px-3 py-2 text-sm font-normal normal-case text-foreground" />
            </label>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Days
              <input type="number" value={newReward.duration_days} onChange={(e) => setNewReward({ ...newReward, duration_days: Number(e.target.value) })} className="mt-1 w-24 rounded-xl border border-border bg-background px-3 py-2 text-sm font-normal text-foreground" />
            </label>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Credits
              <input type="number" value={newReward.credit_cost} onChange={(e) => setNewReward({ ...newReward, credit_cost: Number(e.target.value) })} className="mt-1 w-24 rounded-xl border border-border bg-background px-3 py-2 text-sm font-normal text-foreground" />
            </label>
            <button
              onClick={async () => {
                try {
                  await fSaveReward({ data: { name: newReward.name, duration_days: newReward.duration_days, credit_cost: newReward.credit_cost, enabled: true } });
                  setNewReward({ name: "", duration_days: 15, credit_cost: 5 });
                  setFlash("Reward created");
                  void loadSection("Rewards");
                } catch (err) {
                  setFlash(err instanceof Error ? err.message : "Could not create reward.");
                }
              }}
              className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
            >
              + Add Reward
            </button>
          </div>
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
              <button
                onClick={async () => {
                  await fDeleteReward({ data: { id: r.id } });
                  setFlash("Reward removed");
                  void loadSection("Rewards");
                }}
                className="rounded-lg border border-destructive px-3 py-1 text-xs font-bold text-destructive"
              >
                Delete
              </button>
            </div>
          ))}
        </section>
      )}

      {section === "Tasks" && (
        <section className="space-y-3">
          <div className="space-y-3 rounded-2xl border border-primary/40 bg-card/60 p-4">
            <p className="font-bold">Add Task</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <input value={newTask.name} onChange={(e) => setNewTask({ ...newTask, name: e.target.value })} placeholder="Task name" className="rounded-xl border border-border bg-background px-3 py-2 text-sm" />
              <input value={newTask.platform} onChange={(e) => setNewTask({ ...newTask, platform: e.target.value })} placeholder="Platform" className="rounded-xl border border-border bg-background px-3 py-2 text-sm" />
              <input value={newTask.url} onChange={(e) => setNewTask({ ...newTask, url: e.target.value })} placeholder="https://…" className="rounded-xl border border-border bg-background px-3 py-2 text-sm" />
              <input value={newTask.telegram_chat_id} onChange={(e) => setNewTask({ ...newTask, telegram_chat_id: e.target.value })} placeholder="Telegram @username or -100…" className="rounded-xl border border-border bg-background px-3 py-2 text-sm" />
            </div>
            <textarea value={newTask.description} onChange={(e) => setNewTask({ ...newTask, description: e.target.value })} placeholder="Description" className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
            <div className="flex flex-wrap gap-2">
              <select value={newTask.verification_type} onChange={(e) => setNewTask({ ...newTask, verification_type: e.target.value as typeof newTask.verification_type })} className="rounded-xl border border-border bg-background px-3 py-2 text-sm">
                <option value="manual_confirmation">Manual confirmation</option>
                <option value="telegram_auto_verification">Telegram auto-check</option>
              </select>
              <button onClick={async () => { await fSaveTask({ data: newTask }); setNewTask({ ...newTask, name: "", url: "", description: "", telegram_chat_id: "", display_order: newTask.display_order + 1 }); setFlash("Task added"); void loadSection("Tasks"); }} className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground">Add Task</button>
            </div>
          </div>
          {tasks.map((t) => (
            <div key={t.id} className="space-y-2 rounded-2xl border border-border bg-card/60 p-4">
              <input
                defaultValue={t.name}
                placeholder="▶️ Task name (icon + text)"
                onBlur={(e) => void fSaveTask({ data: { ...toTaskInput(t), name: e.target.value } })}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-bold"
              />
              <input
                defaultValue={t.platform}
                placeholder="Platform"
                onBlur={(e) => void fSaveTask({ data: { ...toTaskInput(t), platform: e.target.value } })}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
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
                <button onClick={async () => { await fDeleteTask({ data: { id: t.id } }); setFlash("Task removed"); void loadSection("Tasks"); }} className="rounded-lg border border-destructive px-3 py-1 font-semibold text-destructive">Delete</button>
              </div>
            </div>
          ))}
        </section>
      )}

      {section === "Extension" && (
        <section className="space-y-4">
          <div className="rounded-2xl border border-border bg-card/60 p-5">
            <p className="font-bold">🦊 FoxGEN PRO Extension management</p>
            <p className="text-xs text-muted-foreground">
              Everything here is used by the website and the Telegram bot instantly — no code changes needed. Leave the
              Telegram file ID empty to disable in-chat file delivery.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {EXTENSION_FIELDS.map((key) => (
              <label key={key} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {key.replace(/^extension_/, "").replace(/_/g, " ")}
                <input
                  defaultValue={settings[key] ?? ""}
                  onBlur={async (e) => {
                    await fSaveSettings({ data: { values: { [key]: e.target.value } } });
                    setFlash("💾 Saved");
                  }}
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-normal normal-case text-foreground"
                />
              </label>
            ))}
          </div>
          <ProductFilesPanel notify={setFlash} />
        </section>
      )}

      {section === "Logs" && (
        <section className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <select
              value={logCategory}
              onChange={(e) => setLogCategory(e.target.value)}
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
            >
              {["all", "webhook", "telegram_api", "channel_verification", "redemption", "callback", "verification"].map(
                (c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ),
              )}
            </select>
            <button
              onClick={() => void loadSection("Logs")}
              className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
            >
              Refresh
            </button>
            <button
              onClick={async () => {
                await fClearLogs({ data: undefined });
                setFlash("Logs cleared");
                void loadSection("Logs");
              }}
              className="rounded-xl border border-destructive px-4 py-2 text-xs font-bold text-destructive"
            >
              Clear logs
            </button>
          </div>
          {logs.length === 0 && <p className="text-sm text-muted-foreground">No errors recorded. 🎉</p>}
          {logs.map((l) => (
            <div key={l.id} className="rounded-xl border border-border bg-card/60 p-3 text-xs">
              <p className="font-bold">
                {l.category}
                {l.telegram_user_id ? ` · TG ${l.telegram_user_id}` : ""}{" "}
                <span className="text-muted-foreground">{new Date(l.created_at).toLocaleString()}</span>
              </p>
              <p className="break-all text-destructive">{l.message}</p>
              {l.context && <p className="text-muted-foreground">{l.context}</p>}
            </div>
          ))}
        </section>
      )}

      {section === "Instructions" && (
        <section className="space-y-5">
          <div className="rounded-2xl border border-border bg-card/60 p-5">
            <p className="font-bold">📘 Extension Instructions</p>
            <p className="text-xs text-muted-foreground">
              The setup &amp; usage guide shown in the bot after a license redemption. Edits reach new and existing
              licenses immediately and never affect license validity or credits.
            </p>
            {!settings["tutorial_url"] && (
              <p className="mt-2 text-xs text-amber-500">
                ⚠️ No tutorial video URL configured yet — add <b>tutorial_url</b> in the Extension tab. The written guide
                still works.
              </p>
            )}
          </div>

          <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Guide title
            <input
              defaultValue={settings["guide_title"] ?? "Lovable Extension — Setup & Usage Guide"}
              onBlur={async (e) => {
                await fSaveSettings({ data: { values: { guide_title: e.target.value } } });
                setFlash("💾 Saved");
              }}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-normal normal-case text-foreground"
            />
          </label>

          <button
            type="button"
            onClick={() => setGuidePreview((v) => !v)}
            className="rounded-xl border border-border px-4 py-2 text-xs font-bold uppercase tracking-wider"
          >
            {guidePreview ? "Close preview" : "Preview guide"}
          </button>

          {guidePreview && (
            <div className="rounded-2xl border border-border bg-background p-5 text-sm">
              <p className="font-bold">{settings["guide_title"] ?? "Lovable Extension — Setup & Usage Guide"}</p>
              {guidePages
                .filter((p) => p.published)
                .map((p, i) => (
                  <div key={p.id} className="mt-4">
                    <p className="font-semibold">{p.heading}</p>
                    <p className="whitespace-pre-wrap text-muted-foreground">{p.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Page {i + 1} of {guidePages.filter((x) => x.published).length}
                    </p>
                  </div>
                ))}
            </div>
          )}

          <div className="space-y-3">
            {guidePages.map((p) => (
              <div key={p.id} className="rounded-2xl border border-border bg-card/60 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    defaultValue={p.heading}
                    onBlur={async (e) => {
                      await fSaveGuidePage({
                        data: { id: p.id, heading: e.target.value, body: p.body, display_order: p.display_order, published: p.published },
                      });
                      setFlash("💾 Saved");
                      setGuidePages(await fGuidePages({ data: undefined }));
                    }}
                    className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold"
                  />
                  <input
                    type="number"
                    defaultValue={p.display_order}
                    onBlur={async (e) => {
                      await fSaveGuidePage({
                        data: { id: p.id, heading: p.heading, body: p.body, display_order: Number(e.target.value) || 0, published: p.published },
                      });
                      setGuidePages(await fGuidePages({ data: undefined }));
                    }}
                    className="w-20 rounded-xl border border-border bg-background px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      await fSaveGuidePage({
                        data: { id: p.id, heading: p.heading, body: p.body, display_order: p.display_order, published: !p.published },
                      });
                      setGuidePages(await fGuidePages({ data: undefined }));
                    }}
                    className="rounded-xl border border-border px-3 py-2 text-xs font-bold uppercase"
                  >
                    {p.published ? "Published" : "Draft"}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await fDeleteGuidePage({ data: { id: p.id } });
                      setGuidePages(await fGuidePages({ data: undefined }));
                    }}
                    className="rounded-xl border border-destructive px-3 py-2 text-xs font-bold uppercase text-destructive"
                  >
                    Delete
                  </button>
                </div>
                <textarea
                  defaultValue={p.body}
                  rows={6}
                  onBlur={async (e) => {
                    await fSaveGuidePage({
                      data: { id: p.id, heading: p.heading, body: e.target.value, display_order: p.display_order, published: p.published },
                    });
                    setFlash("💾 Saved");
                    setGuidePages(await fGuidePages({ data: undefined }));
                  }}
                  className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                />
                <p className="mt-1 text-xs text-muted-foreground">Last updated: {new Date(p.updated_at).toLocaleString()}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-dashed border-border p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Add a section</p>
            <input
              placeholder="Heading"
              value={newGuidePage.heading}
              onChange={(e) => setNewGuidePage({ ...newGuidePage, heading: e.target.value })}
              className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
            <textarea
              placeholder="Section text"
              rows={4}
              value={newGuidePage.body}
              onChange={(e) => setNewGuidePage({ ...newGuidePage, body: e.target.value })}
              className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={async () => {
                if (!newGuidePage.heading.trim() || !newGuidePage.body.trim()) {
                  setFlash("Heading and text are required.");
                  return;
                }
                await fSaveGuidePage({ data: { ...newGuidePage, published: true } });
                setNewGuidePage({ heading: "", body: "", display_order: 10 });
                setGuidePages(await fGuidePages({ data: undefined }));
                setFlash("💾 Section added");
              }}
              className="mt-3 rounded-xl bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground"
            >
              Add section
            </button>
          </div>
        </section>
      )}

      {section === "Branding" && (
        <section className="space-y-5">
          <div className="rounded-2xl border border-border bg-card/60 p-5">
            <p className="font-bold">🦊 Store branding</p>
            <p className="text-xs text-muted-foreground">
              Store name, tagline and every bot icon. Changes apply to the Telegram bot instantly.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {BRAND_FIELDS.map((key) => (
              <label key={key} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {key.replace(/_/g, " ")}
                <input
                  defaultValue={settings[key] ?? ""}
                  onBlur={async (e) => {
                    await fSaveSettings({ data: { values: { [key]: e.target.value } } });
                    setFlash("💾 Saved");
                  }}
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-normal normal-case text-foreground"
                />
              </label>
            ))}
          </div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Emoji manager</p>
          <div className="grid gap-3 sm:grid-cols-4">
            {EMOJI_FIELDS.map((key) => (
              <label key={key} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {key.replace(/^emoji_/, "")}
                <input
                  defaultValue={settings[key] ?? ""}
                  onBlur={async (e) => {
                    await fSaveSettings({ data: { values: { [key]: e.target.value } } });
                    setFlash("💾 Saved");
                  }}
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-lg font-normal normal-case text-foreground"
                />
              </label>
            ))}
          </div>
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
            <p className="mt-2 text-xs text-muted-foreground">
              Required channel 1: {settings["telegram_channel_1_id"] || settings["telegram_channel_1"] || "not set"}
              <br />
              Required channel 2: {settings["telegram_channel_2_id"] || settings["telegram_channel_2"] || "not set"}
              <br />
              Pending updates: {bot?.pending ?? 0} · Last checked: {new Date().toLocaleString()}
            </p>

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
            <button
              onClick={async () => setChannelTests(await fTestChannels({ data: undefined }))}
              className="ml-2 mt-3 rounded-xl border border-border px-4 py-2 text-xs font-bold"
            >
              Test channel connection
            </button>
          </div>
          {channelTests && (
            <div className="space-y-3">
              <p className="font-bold">{channelTests.botOk ? "🟢 Bot Token Valid" : "🔴 Bot Token Invalid"}</p>
              {channelTests.channels.map((channel) => (
                <div key={channel.id} className="rounded-2xl border border-border bg-card/60 p-4 text-sm">
                  <p className="font-bold">{channel.ready ? "🟢" : "🔴"} {channel.name}</p>
                  <p>Channel ID: {channel.chatId || "not configured"}</p>
                  <p>Channel Found: {channel.channelFound ? "Yes" : "No"} · Bot Access: {channel.botHasAccess ? "Yes" : "No"} · Bot Role: {channel.botStatus}</p>
                  {!channel.ready && <p className="mt-2 text-destructive">⚠️ Add @FoxicGEN_BOT as an administrator in this channel, save, then test again. {channel.reason}</p>}
                </div>
              ))}
            </div>
          )}
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
    platform: t.platform,
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

