import { useEffect, useState } from "react";
import { ImagePlus, X } from "lucide-react";

export type ProofFile = { base64: string; previewUrl: string; name: string };
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
const MAX = 5 * 1024 * 1024;

async function compress(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
  if (!blob) throw new Error("compress");
  return blob.size < file.size ? blob : file;
}

const toBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

export function ProofUpload({ value, onChange, disabled }: { value: ProofFile | null; onChange: (v: ProofFile | null) => void; disabled?: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  useEffect(() => () => { if (value) URL.revokeObjectURL(value.previewUrl); }, [value]);

  const pick = async (file: File | undefined) => {
    setError(null);
    if (!file) return;
    if (!ALLOWED.includes(file.type)) return setError("Choose a JPEG, PNG or WebP image.");
    if (file.size > MAX) return setError("The screenshot must be smaller than 5 MB.");
    setWorking(true);
    try {
      const blob = await compress(file).catch(() => file);
      if (blob.size > MAX) return setError("The screenshot must be smaller than 5 MB.");
      onChange({ base64: await toBase64(blob), previewUrl: URL.createObjectURL(blob), name: file.name });
    } catch {
      setError("Could not read that image. Try another screenshot.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="text-sm font-medium">
      Payment screenshot
      {value ? (
        <div className="relative mt-2 overflow-hidden rounded-xl border border-border bg-muted">
          <img src={value.previewUrl} alt="Payment screenshot preview" className="mx-auto max-h-64 w-auto object-contain" />
          <button type="button" disabled={disabled} onClick={() => onChange(null)} aria-label="Remove screenshot"
            className="absolute right-2 top-2 inline-flex size-8 items-center justify-center rounded-full bg-background/90 text-foreground shadow-soft hover:bg-background">
            <X className="size-4" />
          </button>
          <p className="truncate border-t border-border bg-card px-3 py-2 text-xs font-normal text-muted-foreground">{value.name}</p>
        </div>
      ) : (
        <label className={`mt-2 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/40 px-4 py-6 text-center hover:border-primary/50 ${disabled || working ? "pointer-events-none opacity-60" : ""}`}>
          <ImagePlus className="size-6 text-muted-foreground" />
          <span className="font-medium">{working ? "Preparing image…" : "Upload screenshot"}</span>
          <span className="text-xs font-normal text-muted-foreground">JPEG, PNG or WebP · up to 5 MB</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={disabled || working}
            onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
      )}
      {error && <p role="alert" className="mt-1.5 text-xs font-normal text-destructive">{error}</p>}
    </div>
  );
}
