import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, CaretRight, Package, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import { shopProductDetail } from "@/lib/shop.functions";
import { SiteNav } from "@/components/site/site-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { ProductLogo } from "@/components/site/product-logo";
import { PriceTag, ProductCard, StockPill } from "@/components/site/product-card";
import { categoryLabel, categoryOf } from "@/lib/store-categories";
import { Button } from "@/components/ui/button";
import { ProductDocumentation } from "@/components/site/product-documentation";
import { cleanProductText, productSections, deliveryMethodLabel } from "@/lib/product-content";
import { BRAND } from "@/lib/brand";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/product/$productId")({
  loader: async ({ params }) => {
    if (!UUID.test(params.productId)) throw notFound();
    const detail = await shopProductDetail({ data: { id: params.productId } });
    if (!detail) throw notFound();
    return detail;
  },
  head: ({ loaderData }) => {
    const p = loaderData?.product;
    const title = p ? `${cleanProductText(p.name)} — ${BRAND.name}` : `Product unavailable — ${BRAND.name}`;
    const description = cleanProductText(p?.short_description) || (p ? `Explore ${cleanProductText(p.name)} at ${BRAND.name} with owner-verified delivery.` : "This product is not available.");
    const meta = [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "product" },
      { name: "twitter:card", content: "summary_large_image" },
    ];
    if (!p) meta.push({ name: "robots", content: "noindex" });
    if (p?.image_url && /^https:\/\//.test(p.image_url)) {
      meta.push({ property: "og:image", content: p.image_url }, { name: "twitter:image", content: p.image_url });
    }
    return { meta };
  },
  errorComponent: ProductError,
  notFoundComponent: ProductMissing,
  component: ProductPage,
});

function ProductError({ reset }: { reset: () => void }) {
  return <div className="min-h-screen bg-background"><SiteNav /><main className="container-page py-16"><h1 className="heading-5">This product could not be loaded</h1><p className="body-5 mt-4 text-muted-foreground">Please try again.</p><Button className="mt-6" onClick={() => { window.location.reload(); reset(); }}>Try again</Button></main><SiteFooter /></div>;
}

function ProductMissing() {
  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main id="main" className="container-page flex flex-col items-center py-24 text-center">
        <Package className="size-12 text-muted-foreground" />
        <h1 className="heading-5 mt-5">This product isn't available</h1>
        <p className="body-5 mt-2 max-w-md text-muted-foreground">It may have been removed or is no longer listed. Browse the store for current offers.</p>
        <Button asChild className="mt-8"><Link to="/shop"><ArrowLeft /> Back to the shop</Link></Button>
      </main>
      <SiteFooter />
    </div>
  );
}

function ProductPage() {
  const { product: p, related, methods, reviewMinutes } = Route.useLoaderData();
  const category = categoryOf(p.name);
  const name = cleanProductText(p.name);
  const summary = cleanProductText(p.short_description);
  const sections = productSections(p);
  const delivery = deliveryMethodLabel(p.delivery_method);
  if (delivery) {
    const configured = sections.find(s => s.id === "delivery");
    const information = `## Delivery method\n${delivery}\n\nYour order is confirmed after the payment is checked.\n\nDelivery is guaranteed within 30 minutes after successful payment confirmation, subject to product availability and order verification.`;
    if (configured) configured.text += `\n\n${information}`;
    else sections.push({ id: "delivery", title: "Delivery information", text: information });
  }
  if (p.tutorial_url && /^https?:\/\//.test(p.tutorial_url) && !sections.some(s => s.id === "activation")) {
    sections.push({ id: "activation", title: "Activation guide", text: "" });
  }
  const order = ["overview", "how", "activation", "delivery", "warranty", "terms"];
  sections.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));

  const purchase = p.purchasable ? (
    <Button asChild className="h-12 w-full rounded-lg shadow-ember"><Link to="/shop" search={{ product: p.id, buy: true }}>Buy now</Link></Button>
  ) : (
    <Button disabled className="h-12 w-full rounded-lg">{p.availability === "coming_soon" ? "Coming soon" : p.price_usdt === null ? "Price on request" : "Currently sold out"}</Button>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />
      <div className="border-b border-border bg-card">
        <nav aria-label="Breadcrumb" className="container-page flex min-w-0 items-center gap-2 py-4 caption-4 text-muted-foreground">
          <Link to="/shop" className="shrink-0 hover:text-primary">Shop</Link><CaretRight className="size-3 shrink-0" />
          <Link to="/shop" search={{ category }} className="hidden shrink-0 hover:text-primary sm:inline">{categoryLabel(category)}</Link>
          <CaretRight className="hidden size-3 shrink-0 sm:block" /><span className="min-w-0 truncate text-foreground">{name}</span>
        </nav>
      </div>
      <main id="main" className="container-page py-6 pb-28 sm:py-10 sm:pb-10">
        <div className="grid min-w-0 items-start gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-10 lg:gap-12">
          <div className="product-detail-image">
            {p.image_url ? <img src={p.image_url} alt={name} className="h-full w-full object-contain" /> : <ProductLogo name={name} logoUrl={p.logo_url} emoji={null} size="showcase" />}
          </div>
          <div className="min-w-0" data-robot-point="">
            <div className="flex flex-wrap items-center gap-3"><span className="caption-3 text-primary">{categoryLabel(category)}</span><StockPill product={p} /></div>
            <h1 className="heading-5 mt-4 break-words sm:heading-4">{name}</h1>
            {summary && <p className="body-5 mt-4 whitespace-pre-line text-muted-foreground">{summary}</p>}
            <div className="my-6 border-y border-border py-5"><PriceTag product={p} size="lg" />
              {p.duration_label && <p className="body-6 mt-2 text-muted-foreground">{cleanProductText(p.duration_label)}</p>}
              {p.stock_label.includes("available") && <p className="caption-3 mt-2 text-muted-foreground">{cleanProductText(p.stock_label)}</p>}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">{purchase}<Button asChild variant="outline" className="h-12 rounded-lg"><Link to="/support">Contact support</Link></Button></div>
            <p className="caption-3 mt-4 flex items-start gap-2 text-muted-foreground"><ShieldCheck className="mt-0.5 size-4 shrink-0" />Every payment is checked before your order is confirmed.</p>
            {methods.length > 0 && <p className="caption-4 mt-3 text-muted-foreground">Payment: {methods.map(cleanProductText).join(", ")}</p>}
            {reviewMinutes > 0 && <p className="caption-4 mt-2 text-muted-foreground">Typical payment review: {reviewMinutes} minutes</p>}
          </div>
        </div>
        <ProductDocumentation sections={sections} tutorialUrl={p.tutorial_url} />
        {related.length > 0 && <section className="mt-10 border-t border-border pt-8 sm:mt-16"><div className="mb-6 flex items-center justify-between gap-4"><h2 className="heading-6">You may also like</h2><Button asChild variant="ghost" size="sm"><Link to="/shop" search={{ category }}>View all</Link></Button></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">{related.map(r => <ProductCard key={r.id} product={r} />)}</div></section>}
      </main>
      <div className="product-mobile-purchase"><div className="container-page grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-4"><div className="min-w-0"><span className="caption-4 block truncate text-muted-foreground">{name}</span><span className="title-4 tabular-nums">{p.price_usdt === null ? "Price on request" : `${p.price_usdt.toFixed(2)} USDT`}</span></div>{purchase}</div></div>
      <SiteFooter />
    </div>
  );
}
