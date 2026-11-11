export type SupplierId = 'reseller' | 'digihup';
export function supplierOf(id: string | null | undefined): SupplierId | null { return !id ? null : id.startsWith('digihup:') ? 'digihup' : 'reseller'; }
export function supplierEnabled(id: SupplierId, settings: Record<string, string>) { return settings[`supplier_disabled_${id}`] !== 'true'; }