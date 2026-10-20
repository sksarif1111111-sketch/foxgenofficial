import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { shopCatalog } from "@/lib/shop.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FoxGEN Store — Extensions, Licences & Digital Products" },
      {
        name: "description",
        content: "Shop FoxGEN Pro extension licences and digital products on the website or in our Telegram bot.",
      },
      { property: "og:title", content: "FoxGEN Store — Extensions, Licences & Digital Products" },
      { property: "og:description", content: "FoxGEN Pro licences and digital products, in one store." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StoreHome,
});

function StoreHome() {
  const load = useServerFn(shopCatalog);
  const { data, isLoading } = useQuery({ queryKey: ["home-catalog"], queryFn: () => load() });
  const products = data?.products ?? [];

  return (
    <main className="theme-light min-h-screen bg-background text-foreground">
      <SiteNav
        right={
          <Link
            to="/shop"
            className="hidden rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition hover:opacity-90 sm:inline-flex"
          >
            Shop now
          </Link>
        }
      />
      <div className="mx-auto flex max-w-6xl flex-col gap-14 px-4 py-14 sm:px-6">
        <header className="flex flex-col items-start gap-5">
          <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-primary">
            Website + Telegram bot
          </span>
          <h1 className="max-w-3xl text-4xl font-black tracking-tight sm:text-6xl">
            Everything FoxGEN, <span className="text-primary">one store.</span>
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            Extension licences and digital products. Buy here or in our Telegram bot — same stock, same orders.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/shop"
              className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-lift transition hover:-translate-y-0.5"
            >
              Browse store
            </Link>
            <Link
              to="/extension"
              className="rounded-xl border border-border bg-card px-6 py-3 text-sm font-bold shadow-soft transition hover:border-primary/50"
            >
              Get the extension
            </Link>
          </div>
        </header>

        <section className="flex flex-col gap-5">
          <div className="flex items-end justify-between">
            <h2 className="text-2xl font-black tracking-tight">Products</h2>
            <Link to="/shop" className="text-sm font-semibold text-primary hover:underline">
              See all →
            </Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {isLoading && <p className="text-muted-foreground">Loading products…</p>}
            {products.map((p) => (
              <article
                key={p.id}
                className="group flex flex-col gap-3 rounded-2xl border border-border bg-card p-6 shadow-soft transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lift"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-2xl">
                  {p.emoji ?? "📦"}
                </div>
                <h3 className="text-lg font-bold">{p.name}</h3>
                {p.short_description && (
                  <p className="line-clamp-2 text-sm text-muted-foreground">{p.short_description}</p>
                )}
                <div className="mt-auto flex items-center justify-between pt-3 text-sm">
                  <span className="text-base font-black text-primary">{p.price_label}</span>
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                    {p.stock_label}
                  </span>
                </div>
                <Link
                  to="/shop"
                  className="rounded-xl bg-foreground px-4 py-3 text-center text-sm font-bold text-background transition group-hover:bg-primary group-hover:text-primary-foreground"
                >
                  View in store
                </Link>
              </article>
            ))}
          </div>
        </section>

        <footer className="flex justify-between border-t border-border pt-6 text-sm text-muted-foreground">
          <span>© FoxGEN</span>
          <a href="/admin" className="font-semibold text-primary hover:underline">Admin panel</a>
        </footer>
      </div>
    </main>
  );
}
