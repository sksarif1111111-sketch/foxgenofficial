import { useState, type ReactNode } from 'react';
import { DownloadSimple, SpinnerGap } from '@phosphor-icons/react/dist/ssr';
import { Button, type ButtonProps } from '@/components/ui/button';
import { FOXGEN_540 } from '@/lib/extension-releases';

export function ExtensionDownloadButton({
  href = FOXGEN_540.href,
  file = FOXGEN_540.file,
  children = 'Download 5.40',
  variant = 'default',
  className,
}: { href?: string; file?: string; children?: ReactNode; variant?: ButtonProps['variant']; className?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function download() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(href, { credentials: 'same-origin' });
      if (!response.ok) throw new Error(`Download failed (${response.status}). Please try again.`);
      const blob = await response.blob();
      if (!blob.size || blob.type.includes('text/html')) throw new Error('Download unavailable. Please try again.');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download failed. Please try again.');
    } finally { setBusy(false); }
  }
  return (
    <div className="flex flex-col gap-2">
      <Button variant={variant} className={className} disabled={busy} onClick={() => void download()}>
        {busy ? <SpinnerGap className="size-4 animate-spin" /> : <DownloadSimple className="size-4" />}
        {busy ? 'Downloading…' : children}
      </Button>
      {error && <p role="alert" className="max-w-xs text-xs text-destructive">{error}</p>}
    </div>
  );
}