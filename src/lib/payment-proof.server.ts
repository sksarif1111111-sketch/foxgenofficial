import { db, tg, botToken } from "./hub.server";

export const PROOF_BUCKET = "payment-proofs";
export const PROOF_MAX_BYTES = 5 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };

/** Sniff the real type from magic bytes; never trust upstream headers. */
export function sniffProofType(bytes: Uint8Array): string | null {
  const b = bytes;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "application/pdf";
  return null;
}

/** Download a Telegram file server-side. Token and file URL never leave this function. */
export async function downloadTelegramFile(fileId: string): Promise<{ bytes: Uint8Array; type: string } | null> {
  if (!/^[A-Za-z0-9_-]{10,200}$/.test(fileId)) return null;
  const file = await tg<{ file_path?: string; file_size?: number }>("getFile", { file_id: fileId });
  const path = file.ok ? file.result?.file_path : undefined;
  if (!path || (file.result?.file_size ?? 0) > PROOF_MAX_BYTES) return null;
  const res = await fetch(`https://api.telegram.org/file/bot${botToken()}/${path}`, { redirect: "manual" });
  if (!res.ok) return null;
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > PROOF_MAX_BYTES) return null;
  const type = sniffProofType(bytes);
  return type ? { bytes, type } : null;
}

/** Copy a Telegram photo into private storage; falls back to the legacy telegram-file: value on failure. */
export async function storeTelegramProof(kind: "orders" | "topups", ownerId: string, fileId: string): Promise<string> {
  const fallback = `telegram-file:${fileId}`;
  try {
    const file = await downloadTelegramFile(fileId);
    if (!file) return fallback;
    const path = `${kind}/${ownerId}/${crypto.randomUUID()}.${TYPES[file.type]}`;
    const { error } = await db.storage.from(PROOF_BUCKET).upload(path, file.bytes, { contentType: file.type, upsert: false });
    if (error) { console.error("payment proof upload failed", error.message); return fallback; }
    return `storage:${path}`;
  } catch (e) {
    console.error("payment proof store failed", e instanceof Error ? e.message : e);
    return fallback;
  }
}

export type ProofResult = { ok: true; bytes: Uint8Array; type: string } | { ok: false; status: 404 | 502 };

/** Resolve a stored evidence value to bytes. Only private storage keys and Telegram file IDs — never arbitrary URLs. */
export async function loadProof(evidence: string | null | undefined): Promise<ProofResult> {
  if (!evidence) return { ok: false, status: 404 };
  if (evidence.startsWith("storage:")) {
    const path = evidence.slice(8);
    if (!/^(orders|topups)\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$/.test(path)) return { ok: false, status: 404 };
    const { data, error } = await db.storage.from(PROOF_BUCKET).download(path);
    if (error || !data) return { ok: false, status: 502 };
    const bytes = new Uint8Array(await data.arrayBuffer());
    const type = sniffProofType(bytes);
    if (!type || bytes.byteLength > PROOF_MAX_BYTES) return { ok: false, status: 502 };
    return { ok: true, bytes, type };
  }
  if (evidence.startsWith("telegram-file:")) {
    const file = await downloadTelegramFile(evidence.slice(14)).catch(() => null);
    return file ? { ok: true, ...file } : { ok: false, status: 502 };
  }
  return { ok: false, status: 404 };
}

export const proofHeaders = (type: string) => ({ "Content-Type": type, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline" });
