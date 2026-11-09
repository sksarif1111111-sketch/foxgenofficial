import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { lockAdmin } from "@/lib/admin-access.functions";

export function AdminSessionBar() {
  const lock = useServerFn(lockAdmin);
  const navigate = useNavigate();
  const cache = useQueryClient();
  return <div className="flex justify-end border-b border-border bg-background px-4 py-2">
    <Button size="sm" variant="outline" onClick={async () => {
      await lock();
      await cache.cancelQueries();
      cache.clear();
      await navigate({ to: "/admin-access", search: { redirect: "/hub-admin" } });
    }}><LogOut className="mr-2 h-4 w-4" />Sign out</Button>
  </div>;
}