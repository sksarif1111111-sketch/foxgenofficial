import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FacebookLogo, TelegramLogo, WhatsappLogo, YoutubeLogo } from "@phosphor-icons/react/dist/ssr";
import { BrandMark } from "@/components/site/site-nav";
import { AdminAccessDialog } from "@/components/admin/admin-access-form";
import { publicSiteInfo } from "@/lib/site.functions";
import { BRAND } from "@/lib/brand";

const COLUMNS = [
  {
    title: "Store",
    links: [
      { to: "/shop", label: "Explore offers" },
      { to: "/offers", label: "Latest offers" },
      { to: "/extension", label: "FoxGEN Pro extension" },
    ],
  },
  {
    title: "Members",
    links: [
      { to: "/hub", label: "Free rewards" },
      { to: "/account", label: "My account" },
      { to: "/chat", label: "Ask Foxgen AI" },
    ],
  },
  {
    title: "Help",
    links: [
      { to: "/tutorials", label: "Tutorials" },
      { to: "/support", label: "Customer support" },
      { to: "/privacy", label: "Privacy policy" },
      { to: "/terms", label: "Terms and conditions" },
    ],
  },
] as const;

export function SiteFooter() {
  const load = useServerFn(publicSiteInfo);
  const { data } = useQuery({ queryKey: ["site-info"], queryFn: () => load() });
  const l = data?.links ?? {};
  const social = [
    l.telegram_channel_1 && { href: l.telegram_channel_1, label: l.telegram_channel_1_name ?? "Telegram", Icon: TelegramLogo },
    l.whatsapp_url && { href: l.whatsapp_url, label: "WhatsApp channel", Icon: WhatsappLogo },
    l.youtube_url && { href: l.youtube_url, label: "YouTube", Icon: YoutubeLogo },
    l.facebook_url && { href: l.facebook_url, label: "Facebook", Icon: FacebookLogo },
  ].filter(Boolean) as Array<{ href: string; label: string; Icon: typeof TelegramLogo }>;

  return (
    <footer className="surface-ink mt-24">
      <div className="container-page grid gap-12 py-16 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="max-w-sm space-y-4">
          <BrandMark tone="inverse" />
          <p className="body-6 text-muted-foreground">
            Software offers for Lovable, ChatGPT, Gemini and other tools. Order on the website or in our Telegram bot; every payment is checked by a person before delivery.
          </p>
          {social.length > 0 && (
            <ul className="flex gap-2" aria-label="Social links">
              {social.map((s) => (
                <li key={s.href}>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={s.label}
                    className="inline-flex size-10 items-center justify-center rounded-full border border-border text-muted-foreground transition duration-300 hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <s.Icon size={18} />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
        {COLUMNS.map((c) => (
          <div key={c.title} className="space-y-3">
            <p className="caption-3 uppercase tracking-wider text-muted-foreground">{c.title}</p>
            <ul className="space-y-2">
              {c.links.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="body-6 text-foreground/90 transition duration-300 hover:text-primary">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="container-page flex flex-col gap-2 py-6 sm:flex-row sm:items-center sm:justify-between">
          <span className="caption-5 text-muted-foreground">© {new Date().getFullYear()} {BRAND.name}</span>
          <div className="flex items-center gap-4">
            <span className="caption-5 text-muted-foreground">A typed payment reference never marks an order as paid.</span>
            <AdminAccessDialog trigger={<button type="button" className="caption-5 text-muted-foreground hover:text-foreground">Admin</button>} />
          </div>
        </div>
      </div>
    </footer>
  );
}
