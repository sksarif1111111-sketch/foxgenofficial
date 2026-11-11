import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { BRAND } from "@/lib/brand";

export function CustomerAuthShell({ children }: { children: ReactNode }) {
  return <main className="customer-auth-stage min-h-dvh px-4 pb-4 pt-16 sm:py-6 text-foreground">
    <Link to="/shop" className="absolute left-4 top-4 z-10 text-sm font-medium sm:left-6 sm:top-6">← Back to store</Link>
    <div aria-hidden="true" className="auth-square auth-square-one" /><div aria-hidden="true" className="auth-square auth-square-two" /><div aria-hidden="true" className="auth-square auth-square-three" />
    <section className="customer-auth-panel relative z-10 mx-auto w-full max-w-[336px] rounded-lg p-4 sm:max-w-[368px] sm:p-6">
      <Link to="/" className="mb-3 flex min-w-0 items-center justify-center gap-2 sm:mb-4 sm:gap-3"><img src={BRAND.mark} alt="" width={36} height={36} className="size-8 shrink-0 rounded-lg object-cover sm:size-9" /><span className="title-4 min-w-0 font-bold">{BRAND.name}</span></Link>
      {children}
    </section>
  </main>;
}