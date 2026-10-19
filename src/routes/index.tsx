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
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-6 py-14">
        <nav className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/foxgen-logo.png" alt="FoxGEN" width={44} height={44} className="h-11 w-11 rounded-xl" />
            <span className="text-lg font-black tracking-wide">FOXGEN STORE</span>
          </div>
          <div className="flex gap-5 text-sm font-semibold">
            <Link to="/shop" className="hover:text-primary">Store</Link>
            <Link to="/extension" className="hover:text-primary">Extension</Link>
          </div>
        </nav>

        <header className="flex flex-col gap-4">
          <h1 className="text-4xl font-black tracking-tight sm:text-6xl">
            Everything FoxGEN, <span className="text-primary">one store.</span>
          </h1>
          <p className="max-w-2xl text-muted-foreground">
            Extension licences and digital products. Buy here or in our Telegram bot — same stock, same orders.
          </p>
        </header>

        <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading && <p className="text-muted-foreground">Loading products…</p>}
          {products.map((p) => (
            <article key={p.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6">
              <div className="text-3xl">{p.emoji ?? "📦"}</div>
              <h2 className="text-lg font-bold">{p.name}</h2>
              {p.short_description && <p className="text-sm text-muted-foreground">{p.short_description}</p>}
              <div className="mt-auto flex items-center justify-between pt-3 text-sm">
                <span className="font-bold">{p.price_label}</span>
                <span className="text-muted-foreground">{p.stock_label}</span>
              </div>
              <Link
                to="/shop"
                className="rounded-xl bg-primary px-4 py-3 text-center text-sm font-bold text-primary-foreground hover:brightness-110"
              >
                View in store
              </Link>
            </article>
          ))}
        </section>

        <footer className="flex justify-between border-t border-border pt-6 text-sm text-muted-foreground">
          <span>© FoxGEN</span>
          <a href="/admin" className="font-semibold text-primary hover:underline">Admin panel</a>
        </footer>
      </div>
    </main>
  );
}
