import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/telegram/avatar")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = new URL(request.url).searchParams.get("t")?.trim() ?? "";
        if (token.length < 10) return new Response("Not found", { status: 404 });

        const { botToken, profileByToken, tg } = await import("@/lib/hub.server");
        const profile = await profileByToken(token);
        if (!profile) return new Response("Not found", { status: 404 });

        const photos = await tg<{ photos: Array<Array<{ file_id: string }>> }>("getUserProfilePhotos", {
          user_id: profile.telegram_user_id,
          offset: 0,
          limit: 1,
        });
        const photo = photos.result?.photos[0]?.at(-1);
        if (!photos.ok || !photo) return new Response("Not found", { status: 404 });

        const file = await tg<{ file_path?: string }>("getFile", { file_id: photo.file_id });
        const filePath = file.result?.file_path;
        if (!file.ok || !filePath) return new Response("Not found", { status: 404 });

        const image = await fetch(`https://api.telegram.org/file/bot${botToken()}/${filePath}`);
        if (!image.ok || !image.body) return new Response("Not found", { status: 404 });

        return new Response(image.body, {
          headers: {
            "Content-Type": image.headers.get("content-type") || "image/jpeg",
            "Cache-Control": "private, max-age=300",
            "X-Content-Type-Options": "nosniff",
          },
        });
      },
    },
  },
});