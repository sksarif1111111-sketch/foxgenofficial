import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { BRAND } from "@/lib/brand";

export function CustomerAuthShell({ children }: { children: ReactNode }) {
  return <main className="customer-auth-stage min-h-screen px-4 py-6 text-foreground">
    <Link to="/shop" className="absolute left-6 top-6 z-10 text-sm font-medium">← Back to store</Link>
    <div aria-hidden="true" className="auth-square auth-square-one" /><div aria-hidden="true" className="auth-square auth-square-two" /><div aria-hidden="true" className="auth-square auth-square-three" />
    <section className="customer-auth-panel relative z-10 mx-auto w-full max-w-[368px] rounded-lg p-6">
      <Link to="/" className="mb-4 flex items-center justify-center gap-3"><img src={BRAND.mark} alt="" width={36} height={36} className="size-9 rounded-lg object-cover" /><span className="title-4 font-bold">{BRAND.name}</span></Link>
      {children}
    </section>
  </main>;
}