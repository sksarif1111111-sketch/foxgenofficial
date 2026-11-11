import { z } from "zod";
export const topupAmount = z.coerce.number().positive().max(100000).refine(n => Number.isInteger(Math.round(n * 100) * 100) && Math.abs(n * 100 - Math.round(n * 100)) < 0.00001, "Use at most two decimals.");
export const topupReference = z.string().trim().min(3).max(200);
export const topupEvidence = z.string().url().max(2000).refine(s => s.startsWith("https://"));
export const walletReviewSchema = z.object({ id: z.string().uuid(), approve: z.boolean(), note: z.string().trim().min(3).max(200), creditUsd: topupAmount.optional() });
export const walletDeductSchema = z.object({ profileId: z.string().uuid(), amount: topupAmount, note: z.string().trim().min(3).max(200) });