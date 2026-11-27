import { Link } from '@tanstack/react-router';
import { ExternalLink } from 'lucide-react';
import { BRAND } from '@/lib/brand';
import { FOXGEN_540 } from '@/lib/extension-releases';
import { Button } from '@/components/ui/button';
import { ExtensionDownloadButton } from '@/components/site/extension-download-button';

export function ExtensionRelease() {
  return (
    <section aria-label="FoxGEN Pro 5.40 release" className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-center">
      <img src={BRAND.mark} alt="FoxGEN Pro" width={56} height={56} className="size-14 shrink-0 rounded-lg object-contain" />
      <div className="min-w-0 flex-1">
        <h2 className="text-lg font-semibold">{FOXGEN_540.name} {FOXGEN_540.version}</h2>
        <p className="mt-1 text-sm text-muted-foreground">Uses the keys from this Licence Center.</p>
      </div>
      <div className="flex flex-wrap items-start gap-2">
        <ExtensionDownloadButton />
        <Button asChild variant="outline"><Link to="/extension"><ExternalLink className="size-4" />All releases</Link></Button>
      </div>
    </section>
  );
}