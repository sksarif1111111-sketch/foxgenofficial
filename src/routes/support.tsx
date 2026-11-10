import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bot, ExternalLink, Globe, MessageCircle, PlayCircle, Send, Sparkles, Users } from "lucide-react";
import { publicSiteInfo } from "@/lib/site.functions";
import { SiteNav } from "@/components/site/site-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { openAssistant } from "@/lib/assistant-events";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "Support — Foxgen AI Store" },
      { name: "description", content: "Contact Foxgen AI Store support on WhatsApp or Telegram, join our community and get help with orders." },
      { property: "og:title", content: "Support — Foxgen AI Store" },
      { property: "og:description", content: "Get help with orders, licences and the FoxGEN Pro extension." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SupportPage,
});

const STEPS = [
  ["Choose a product", "Open any product and press Buy now."],
  ["Pay with your method", "Send the exact amount and submit your payment reference."],
  ["Owner verification", "The owner checks the receiving account — a typed reference alone never confirms payment."],
  ["Delivery", "Access details arrive by email (website) or in Telegram (bot orders)."],
];

function SupportPage() {
  const load = useServerFn(publicSiteInfo);
  const { data, isLoading } = useQuery({ queryKey: ["site-info"], queryFn: () => load() });
  const l = data?.links ?? {};
  const bot = l.bot_username ? `https://t.me/${l.bot_username.replace(/^@/, "")}` : null;

  const primary = [
    l.whatsapp_support_url && { href: l.whatsapp_support_url, icon: MessageCircle, title: "WhatsApp support", text: "Message the owner directly" },
    l.support_url && { href: l.support_url, icon: Send, title: "Telegram support", text: "Chat with support on Telegram" },
    bot && { href: bot, icon: Bot, title: `@${l.bot_username?.replace(/^@/, "")}`, text: "Order, track and earn rewards in the bot" },
  ].filter(Boolean) as Array<{ href: string; icon: typeof Send; title: string; text: string }>;

  const community = [
    l.telegram_channel_1 && { href: l.telegram_channel_1, icon: Send, title: l.telegram_channel_1_name ?? "Telegram channel" },
    l.telegram_channel_2 && { href: l.telegram_channel_2, icon: Send, title: l.telegram_channel_2_name ?? "Telegram channel" },
    l.whatsapp_url && { href: l.whatsapp_url, icon: MessageCircle, title: "WhatsApp channel" },
    l.community_url && { href: l.community_url, icon: Users, title: "Community group" },
    l.youtube_url && { href: l.youtube_url, icon: PlayCircle, title: "YouTube" },
    l.facebook_url && { href: l.facebook_url, icon: Globe, title: "Facebook" },
  ].filter(Boolean) as Array<{ href: string; icon: typeof Send; title: string }>;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />
      <header className="border-b border-border bg-card">
        <div className="container-page py-10 sm:py-14">
          <p className="eyebrow text-primary">Support</p>
          <h1 className="mt-2 text-3xl font-bold sm:text-5xl">We're here to help</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">Questions about an order, a licence or the extension? Reach us on the channel you prefer.</p>
        </div>
      </header>
      <main id="main" className="container-page space-y-14 py-10 sm:py-14">
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading && Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl border border-border bg-card" />)}
          {primary.map((c) => (
            <a key={c.href} href={c.href} target="_blank" rel="noreferrer" className="group flex items-start gap-4 rounded-2xl border border-border bg-card p-5 shadow-soft transition hover:-translate-y-0.5 hover:border-primary/40">
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground"><c.icon className="size-5" /></span>
              <span className="min-w-0 flex-1"><span className="block font-semibold">{c.title}</span><span className="text-sm text-muted-foreground">{c.text}</span></span>
              <ExternalLink className="size-4 text-muted-foreground" />
            </a>
          ))}
          <button type="button" onClick={openAssistant} className="flex items-start gap-4 rounded-2xl bg-ink p-5 text-left text-ink-foreground shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="flex size-11 items-center justify-center rounded-xl bg-card/10"><Sparkles className="size-5" /></span>
            <span><span className="block font-semibold">Ask Foxgen AI</span><span className="text-sm opacity-80">Instant answers about products and prices</span></span>
          </button>
        </section>

        <section>
          <h2 className="text-2xl font-bold">How ordering works</h2>
          <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(([title, text], i) => (
              <li key={title} className="rounded-2xl border border-border bg-card p-5">
                <span className="font-display text-sm font-bold text-primary">0{i + 1}</span>
                <p className="mt-2 font-semibold">{title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{text}</p>
              </li>
            ))}
          </ol>
        </section>

        {community.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold">Join the community</h2>
            <div className="mt-6 flex flex-wrap gap-3">
              {community.map((c) => (
                <a key={c.href} href={c.href} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-medium hover:border-primary/40">
                  <c.icon className="size-4 text-primary" /> {c.title}
                </a>
              ))}
            </div>
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
