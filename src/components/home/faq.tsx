import * as Accordion from "@radix-ui/react-accordion";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";

export type FaqItem = { q: string; a: ReactNode };

export function Faq({ items }: { items: FaqItem[] }) {
  return (
    <Accordion.Root type="single" collapsible className="divide-y divide-border rounded-2xl border border-border bg-card">
      {items.map((item, i) => (
        <Accordion.Item key={item.q} value={`q${i}`} className="group">
          <Accordion.Header asChild>
            <h3>
              <Accordion.Trigger className="title-3 flex w-full items-center justify-between gap-4 rounded-2xl px-6 py-4 text-left transition duration-300 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                {item.q}
                <Plus size={18} className="shrink-0 text-muted-foreground transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-data-[state=open]:rotate-45" />
              </Accordion.Trigger>
            </h3>
          </Accordion.Header>
          <Accordion.Content className="overflow-hidden">
            <div className="body-6 px-6 pb-6 text-muted-foreground">{item.a}</div>
          </Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}
