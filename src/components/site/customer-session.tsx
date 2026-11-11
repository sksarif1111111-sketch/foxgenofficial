import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const CustomerContext = createContext<{ user: User | null; ready: boolean; refresh: () => Promise<void> }>({ user: null, ready: false, refresh: async () => {} });
export function CustomerSession({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const refresh = async () => { const { data } = await supabase.auth.getUser(); setUser(data.user); setReady(true); };
  useEffect(() => { void refresh(); const update = () => void refresh(); window.addEventListener("foxgen-session-change", update); return () => window.removeEventListener("foxgen-session-change", update); }, []);
  return <CustomerContext.Provider value={{ user, ready, refresh }}>{children}</CustomerContext.Provider>;
}
export const useCustomerSession = () => useContext(CustomerContext);