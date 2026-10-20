import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db, downloadCsv, type Row } from "@/lib/crm";

export type Field = {
  key: string;
  label: string;
  type?: "text" | "number" | "date" | "datetime" | "select" | "textarea" | "checkbox";
  options?: { value: string; label: string }[];
  required?: boolean;
  defaultValue?: string | boolean;
};

export type Column = {
  key: string;
  label: string;
  render?: (row: Row, update: (patch: Row) => void) => ReactNode;
  csv?: (row: Row) => unknown;
  align?: "right";
};

type Props = {
  title: string;
  description?: string;
  table: string;
  select?: string;
  orderBy: string;
  dateField: string;
  searchKeys: string[];
  status?: { key: string; options: string[] };
  columns: Column[];
  fields?: Field[];
  csvName: string;
  actions?: ReactNode;
  beforeInsert?: (payload: Row) => Row;
};

export function ResourcePage(p: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("");

  const query = useQuery({
    queryKey: ["crm", p.table, from, to, status],
    queryFn: async () => {
      let q = db.from(p.table).select(p.select ?? "*").order(p.orderBy, { ascending: false }).limit(2000);
      if (from) q = q.gte(p.dateField, from);
      if (to) {
        const end = new Date(to);
        end.setDate(end.getDate() + 1);
        q = q.lt(p.dateField, end.toISOString().slice(0, 10));
      }
      if (status && p.status) q = q.eq(p.status.key, status);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return query.data ?? [];
    return (query.data ?? []).filter((r) =>
      p.searchKeys.some((k) => String(getPath(r, k) ?? "").toLowerCase().includes(s)),
    );
  }, [query.data, search, p.searchKeys]);

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Row }) => {
      const { error } = await db.from(p.table).update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm"] });
      toast.success("Saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from(p.table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm"] });
      toast.success("Deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function exportCsv() {
    downloadCsv(
      `${p.csvName}-${new Date().toISOString().slice(0, 10)}.csv`,
      p.columns.map((c) => c.label),
      rows.map((r) => p.columns.map((c) => (c.csv ? c.csv(r) : getPath(r, c.key)))),
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{p.title}</h1>
          {p.description && <p className="text-sm text-muted-foreground">{p.description}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {p.actions}
          {p.fields && <AddDialog title={p.title} table={p.table} fields={p.fields} beforeInsert={p.beforeInsert} />}
          <Button variant="outline" onClick={exportCsv} disabled={!rows.length}>
            Export CSV
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-3">
        <div className="min-w-48 flex-1 space-y-1">
          <Label className="text-xs">Search</Label>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Type to filter…" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        {p.status && (
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">All</option>
              {p.status.options.map((o) => (
                <option key={o} value={o}>
                  {label(o)}
                </option>
              ))}
            </select>
          </div>
        )}
        {(search || from || to || status) && (
          <Button
            variant="ghost"
            onClick={() => {
              setSearch("");
              setFrom("");
              setTo("");
              setStatus("");
            }}
          >
            Clear
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              {p.columns.map((c) => (
                <TableHead key={c.key} className={c.align === "right" ? "text-right" : ""}>
                  {c.label}
                </TableHead>
              ))}
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.isPending ? (
              <TableRow>
                <TableCell colSpan={p.columns.length + 1} className="text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : query.isError ? (
              <TableRow>
                <TableCell colSpan={p.columns.length + 1} className="text-destructive">
                  {(query.error as Error).message}
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={p.columns.length + 1} className="text-muted-foreground">
                  Nothing here yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={String(r.id)}>
                  {p.columns.map((c) => (
                    <TableCell key={c.key} className={c.align === "right" ? "text-right tabular-nums" : ""}>
                      {c.render
                        ? c.render(r, (patch) => update.mutate({ id: String(r.id), patch }))
                        : String(getPath(r, c.key) ?? "—")}
                    </TableCell>
                  ))}
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => {
                        if (confirm("Delete this record?")) remove.mutate(String(r.id));
                      }}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">{rows.length} record(s)</p>
    </section>
  );
}

export function label(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getPath(r: Row, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Row)[k] : undefined), r);
}

export function InlineSelect({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 rounded-md border border-input bg-background px-2 text-xs"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {label(o)}
        </option>
      ))}
    </select>
  );
}

function AddDialog({ title, table, fields, beforeInsert }: { title: string; table: string; fields: Field[]; beforeInsert?: (p: Row) => Row }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const initial = () => Object.fromEntries(fields.map((f) => [f.key, f.defaultValue ?? (f.type === "checkbox" ? false : "")]));
  const [values, setValues] = useState<Record<string, string | boolean>>(initial);

  const save = useMutation({
    mutationFn: async () => {
      const payload: Row = {};
      for (const f of fields) {
        const v = values[f.key];
        if (f.type === "checkbox") payload[f.key] = Boolean(v);
        else if (v === "" || v === undefined) continue;
        else if (f.type === "number") payload[f.key] = Number(v);
        else if (f.type === "datetime") payload[f.key] = new Date(String(v)).toISOString();
        else payload[f.key] = typeof v === "string" ? v.trim() : v;
      }
      const { error } = await db.from(table).insert(beforeInsert ? beforeInsert(payload) : payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm"] });
      toast.success("Added");
      setValues(initial());
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add to {title.toLowerCase()}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          {fields.map((f) => (
            <FieldInput key={f.key} field={f} value={values[f.key]} onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))} />
          ))}
          <Button type="submit" className="w-full" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function FieldInput({ field: f, value, onChange }: { field: Field; value: string | boolean | undefined; onChange: (v: string | boolean) => void }) {
  const id = `f-${f.key}`;
  if (f.type === "checkbox") {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
        {f.label}
      </label>
    );
  }
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>
        {f.label}
        {f.required && <span className="text-destructive"> *</span>}
      </Label>
      {f.type === "select" ? (
        <select
          id={id}
          required={f.required}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="">— Select —</option>
          {f.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : f.type === "textarea" ? (
        <Textarea id={id} required={f.required} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <Input
          id={id}
          required={f.required}
          type={f.type === "number" ? "number" : f.type === "date" ? "date" : f.type === "datetime" ? "datetime-local" : "text"}
          step={f.type === "number" ? "any" : undefined}
          min={f.type === "number" ? 0 : undefined}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

/** Options for selects backed by another CRM table. */
export function useOptions(table: string, labelKey = "name") {
  return useQuery({
    queryKey: ["crm", "options", table],
    queryFn: async () => {
      const { data, error } = await db.from(table).select(`id, ${labelKey}`).order(labelKey).limit(1000);
      if (error) throw error;
      return ((data ?? []) as unknown as Row[]).map((r) => ({ value: String(r.id), label: String(r[labelKey] ?? r.id) }));
    },
  });
}

export const opts = (list: string[]) => list.map((v) => ({ value: v, label: label(v) }));
