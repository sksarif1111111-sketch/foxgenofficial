import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const LICENSE_SERVER = "https://foxgen-license-server-fd39.vercel.app";

export type LicenseResult = {
  valid: boolean;
  status: string;
  message: string;
  downloadUrl?: string;
};

const inputSchema = z.object({
  key: z.string().trim().min(4).max(200),
  deviceId: z.string().trim().min(1).max(200).optional(),
});

export const checkLicense = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<LicenseResult> => {
    let payload: Record<string, unknown> = { status: "error" };

    try {
      const res = await fetch(`${LICENSE_SERVER}/check-license`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: data.key, deviceId: data.deviceId ?? "web" }),
      });
      payload = (await res.json()) as Record<string, unknown>;
    } catch (error) {
      console.error("license server unreachable", error);
      return {
        valid: false,
        status: "unreachable",
        message: "License server is not responding. Please try again in a moment.",
      };
    }

    const status = String(payload["status"] ?? "unknown").toLowerCase();
    const valid = status === "active" || status === "valid" || payload["valid"] === true;

    const messages: Record<string, string> = {
      active: "License activated. Your download is ready.",
      valid: "License activated. Your download is ready.",
      invalid: "This license key is not valid.",
      expired: "This license key has expired.",
      revoked: "This license key has been revoked.",
      used: "This license key is already in use on another device.",
    };

    return {
      valid,
      status,
      message: messages[status] ?? (valid ? "License activated." : "This license key is not valid."),
            ...(valid ? {} : {}),
    };
  });
