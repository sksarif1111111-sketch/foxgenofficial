import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUpRight, CircleCheck, RefreshCw, Users, ShoppingBag, PackageCheck, KeyRound, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { adminDashboard } from "@/lib/admin-dashboard.functions";

const money = (n:number, currency:string) => `${currency} ${n.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;
export function ManagementDashboard({ onOpen }: { onOpen:(section:"Buying"|"Users"|"Referrals"|"Licenses"|"Bot"|"Extension")=>void }) {
  const load = useServerFn(adminDashboard);
  const {data,error,isFetching,refetch} = useQuery({queryKey:["admin-management-dashboard"],queryFn:()=>load(),refetchOnWindowFocus:false});
  const [period,setPeriod] = useState("today");
  if(error) return <div role="alert" className="py-8"><p className="text-destructive">হিসাব লোড করা যায়নি।</p><Button variant="outline" onClick={()=>void refetch()}>আবার চেষ্টা করুন</Button></div>;
  if(!data) return <p role="status" className="py-12 text-muted-foreground">হিসাব লোড হচ্ছে…</p>;
  const summary = period === "today" ? data.today : data.month;
  return <div className="space-y-8">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div><p className="text-xs font-semibold uppercase text-primary">FoxGEN • Operations</p><h2 className="mt-2 text-2xl font-bold">বিক্রি ও Bot Management</h2><p className="mt-2 text-sm text-muted-foreground">শেষ আপডেট: {new Date(data.checkedAt).toLocaleString("bn-BD",{timeZone:"Asia/Kolkata"})} · কলকাতা সময়</p></div>
      <Button variant="outline" disabled={isFetching} onClick={()=>void refetch()}><RefreshCw className={isFetching?"animate-spin":""}/>রিফ্রেশ</Button>
    </header>
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4"><h3 className="text-lg font-semibold">বিক্রি, খরচ ও আনুমানিক লাভ</h3><Tabs value={period} onValueChange={setPeriod}><TabsList><TabsTrigger value="today">আজ</TabsTrigger><TabsTrigger value="month">এই মাস</TabsTrigger></TabsList></Tabs></div>
    <p className="text-sm text-muted-foreground">পরিশোধিত অর্ডার: {summary.orders} · Website, Bot ও Manual</p>
    {summary.totals.length === 0 ? <div className="border-l-2 border-primary py-4 pl-5"><h4 className="font-semibold">এখনও কোনো পরিশোধিত বিক্রি নেই</h4><p className="mt-1 text-sm text-muted-foreground">বিক্রি ০ · খরচ ০ · লাভ ০</p></div> : summary.totals.map(row=><section key={row.currency} className="space-y-3"><p className="font-semibold text-primary">{row.currency}</p><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[["বিক্রি",row.sales],["পাইকারি খরচ",row.cost],["অন্যান্য খরচ",row.expenses],["পেমেন্ট ফি",row.fees],["ফেরত",row.refunds],["আনুমানিক নিট লাভ",row.net]].map(([label,value])=><div key={label} className="rounded-lg border border-border bg-card p-5"><p className="text-sm text-muted-foreground">{label}</p><p className={`mt-3 break-words text-2xl font-bold ${label === "আনুমানিক নিট লাভ" ? "text-primary":""}`}>{money(Number(value),row.currency)}</p></div>)}</div></section>)}
    <details className="border-b border-border pb-4 text-sm text-muted-foreground"><summary className="cursor-pointer">হিসাবের ভিত্তি</summary><p className="pt-3">নিট লাভ = পরিশোধিত বিক্রি − বিক্রির সময় সংরক্ষিত পাইকারি খরচ − অন্যান্য খরচ − পেমেন্ট ফি − সম্পন্ন ফেরত। ভিন্ন মুদ্রার হিসাব আলাদা। Stars-এর বিক্রি CRM-এ সংরক্ষিত USD মূল্যে দেখানো হয়; এটি প্রকৃত payout নয়।</p></details>
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[
      {label:"পেমেন্ট অপেক্ষায় / যাচাই",value:data.pending,icon:ShoppingBag,section:"Buying" as const},
      {label:"ডেলিভারি অপেক্ষায়",value:data.delivery,icon:PackageCheck,section:"Buying" as const},
      {label:"মোট সদস্য",value:data.members,icon:Users,section:"Users" as const},
      {label:"সক্রিয় সদস্য",value:data.active,icon:CircleCheck,section:"Users" as const},
      {label:"রেফারেল",value:data.referrals,icon:Users,section:"Referrals" as const},
      {label:"যাচাইকৃত রেফারেল",value:data.verified,icon:CircleCheck,section:"Referrals" as const},
      {label:"রিডিম করা লাইসেন্স",value:data.licenses,icon:KeyRound,section:"Licenses" as const},
      {label:"পরিশোধিত Shop অর্ডার",value:data.paid,icon:ShoppingBag,section:"Buying" as const},
    ].map(item=><div key={item.label} className="rounded-lg border border-border bg-card p-5"><div className="flex items-center justify-between"><item.icon className="size-5 text-primary"/><Button size="icon" variant="ghost" title={item.label} aria-label={item.label} onClick={()=>onOpen(item.section)}><ArrowUpRight/></Button></div><p className="mt-3 text-3xl font-bold tabular-nums">{item.value}</p><p className="mt-2 text-sm text-muted-foreground">{item.label}</p></div>)}</section>
    <section className="border-y border-border py-6"><div className="flex items-center gap-3"><Database className="size-5 text-primary"/><h3 className="text-lg font-semibold">সংরক্ষিত CRM</h3></div><p className="mt-3 text-sm">পরিশোধিত Shop অর্ডার {data.paid} · CRM-এ Shop রেকর্ড {data.crmLinked}</p><p className="mt-2 text-sm text-muted-foreground">পেমেন্ট নিশ্চিত হলে Website ও Bot-এর বিক্রি একবার করে যোগ হয়। পেমেন্ট অপেক্ষায় থাকা অর্ডার বিক্রির হিসাবে নেই।</p></section>
    <section><div className="mb-4 flex items-center justify-between gap-3"><h3 className="text-lg font-semibold">সাম্প্রতিক অর্ডার</h3><Button variant="ghost" onClick={()=>onOpen("Buying")}>সব অর্ডার<ArrowUpRight/></Button></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-border text-muted-foreground"><tr>{["অর্ডার","ক্রেতা","উৎস","মোট","অবস্থা","CRM"].map(t=><th className="whitespace-nowrap px-3 py-3 font-medium" key={t}>{t}</th>)}</tr></thead><tbody>{data.recent.map(order=><tr key={order.id} className="border-b border-border"><td className="whitespace-nowrap px-3 py-4 font-medium">{order.order_number}</td><td className="px-3 py-4">{order.customer_name || "—"}</td><td className="px-3 py-4">{order.channel}</td><td className="whitespace-nowrap px-3 py-4">{money(Number(order.total),order.currency)}</td><td className="px-3 py-4">{order.status.replaceAll("_"," ")}</td><td className="whitespace-nowrap px-3 py-4 text-muted-foreground">{order.crmLinked ? "যোগ হয়েছে":"পেমেন্ট নিশ্চিত নয়"}</td></tr>)}</tbody></table>{!data.recent.length && <p className="py-8 text-center text-muted-foreground">কোনো অর্ডার নেই</p>}</div></section>
  </div>;
}