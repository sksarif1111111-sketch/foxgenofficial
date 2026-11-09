import { createFileRoute } from "@tanstack/react-router";

const KEY = /^(offers|products)\/[a-f0-9-]{36}\.(png|jpe?g|webp|gif)$/;
const TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif" };

/** Serves admin-uploaded store images from the private media bucket (read-only, images only). */
export const Route = createFileRoute("/api/public/media/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const key = params._splat ?? "";
        if (!KEY.test(key)) return new Response("Not found", { status: 404 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.storage.from("store-media").download(key);
        if (error || !data) return new Response("Not found", { status: 404 });
        const ext = key.split(".").pop()!.toLowerCase();
        return new Response(data, {
          headers: {
            "Content-Type": TYPES[ext] ?? "application/octet-stream",
            "Cache-Control": "public, max-age=31536000, immutable",
            "X-Content-Type-Options": "nosniff",
          },
        });
      },
    },
  },
});
