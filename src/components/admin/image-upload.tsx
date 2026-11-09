import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ImagePlus, Loader2, X } from "lucide-react";
import { adminUploadMedia } from "@/lib/offers.functions";

const TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}

/** Upload or paste an image URL. Uploads go to private storage and are served read-only. */
export function ImageUpload({
  value,
  onChange,
  folder,
  label = "Image",
}: {
  value: string;
  onChange: (url: string) => void;
  folder: "offers" | "products";
  label?: string;
}) {
  const upload = useServerFn(adminUploadMedia);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    if (!TYPES.includes(file.type as (typeof TYPES)[number])) return setError("Use a PNG, JPG, WebP or GIF image.");
    if (file.size > 5 * 1024 * 1024) return setError("Images must be 5 MB or smaller.");
    setBusy(true);
    try {
      const res = await upload({ data: { folder, contentType: file.type as (typeof TYPES)[number], dataBase64: await toBase64(file) } });
      onChange(res.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex items-start gap-3">
        <div className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
          {value ? <img src={value} alt="" className="h-full w-full object-cover" /> : <ImagePlus className="size-5 text-muted-foreground" />}
          {value && (
            <button type="button" aria-label="Remove image" onClick={() => onChange("")} className="absolute right-1 top-1 inline-flex size-5 items-center justify-center rounded-full bg-card/90 text-foreground shadow-soft">
              <X className="size-3" />
            </button>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://… or upload"
            className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
          />
          <input ref={input} type="file" accept={TYPES.join(",")} className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
          <button
            type="button"
            disabled={busy}
            onClick={() => input.current?.click()}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium hover:bg-muted disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <ImagePlus className="size-3.5" />}
            {busy ? "Uploading…" : "Upload image"}
          </button>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      </div>
    </div>
  );
}
