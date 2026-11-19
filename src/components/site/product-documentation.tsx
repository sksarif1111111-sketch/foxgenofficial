import { Fragment } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ProductSection } from "@/lib/product-content";

/** Escaped text only: supplier HTML is never executed. */
export function DocumentText({ text }: { text: string }) {
  const lines = text.split("\n");
  const nodes = [];
  for (let i = 0; i < lines.length;) {
    const line = lines[i] ?? "";
    if (!line.trim()) { i++; continue; }
    if (/^#{1,6}\s/.test(line)) {
      nodes.push(<h3 key={i} className="title-4 pt-2 text-foreground">{line.replace(/^#{1,6}\s*/, "")}</h3>); i++; continue;
    }
    const ordered = /^\d+[.)]\s+/.test(line);
    const bullet = /^[-*•▪]\s*/.test(line);
    if (ordered || bullet) {
      const items = []; const start = Number(line.match(/^\d+/)?.[0] ?? 1); const key = i;
      while (i < lines.length && (ordered ? /^\d+[.)]\s+/.test(lines[i] ?? "") : /^[-*•▪]\s*/.test(lines[i] ?? ""))) {
        const value = (lines[i] ?? "").replace(ordered ? /^\d+[.)]\s+/ : /^[-*•▪]\s*/, "");
        items.push(<li key={i}>{value}</li>); i++;
      }
      nodes.push(ordered ? <ol key={key} start={start} className="list-decimal space-y-2 pl-6">{items}</ol> : <ul key={key} className="list-disc space-y-2 pl-6">{items}</ul>);
      continue;
    }
    nodes.push(<p key={i}>{line}</p>); i++;
  }
  return <div className="product-document body-5 space-y-3 text-muted-foreground">{nodes.map((node, i) => <Fragment key={i}>{node}</Fragment>)}</div>;
}

export function ProductDocumentation({ sections, tutorialUrl }: { sections: ProductSection[]; tutorialUrl?: string | null }) {
  const first = sections[0];
  if (!first) return null;
  const content = (s: ProductSection) => <><DocumentText text={s.text} />{s.id === "activation" && tutorialUrl && /^https?:\/\//.test(tutorialUrl) && <a href={tutorialUrl} target="_blank" rel="noreferrer" className="body-5 mt-4 inline-block text-primary underline underline-offset-4">View activation tutorial</a>}</>;
  return (
    <section aria-label="Product information" className="mt-8 border-t border-border sm:mt-12">
      <div className="md:hidden">
        <Accordion type="single" collapsible defaultValue={first.id}>
          {sections.map(s => <AccordionItem key={s.id} value={s.id}><AccordionTrigger className="title-4 py-5">{s.title}</AccordionTrigger><AccordionContent className="pb-6">{content(s)}</AccordionContent></AccordionItem>)}
        </Accordion>
      </div>
      <Tabs defaultValue={first.id} className="hidden md:block">
        <TabsList aria-label="Product information" className="h-auto w-full flex-wrap justify-start gap-2 rounded-none border-b border-border bg-transparent p-0 py-4">
          {sections.map(s => <TabsTrigger key={s.id} value={s.id} className="button-sm min-h-10 rounded-lg px-4 py-2 data-[state=active]:bg-accent data-[state=active]:text-primary data-[state=active]:shadow-none">{s.title}</TabsTrigger>)}
        </TabsList>
        {sections.map(s => <TabsContent key={s.id} value={s.id} className="max-w-[880px] py-6"><h2 className="heading-6 mb-6">{s.title}</h2>{content(s)}</TabsContent>)}
      </Tabs>
    </section>
  );
}