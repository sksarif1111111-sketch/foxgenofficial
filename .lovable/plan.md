# FoxGEN Pro Uploaded Extension Integration

## What will change
- Rebuild the uploaded extension as a separate FoxGEN Pro premium edition while preserving its existing features and side-panel behavior.
- Replace only its old license-validation service with the existing FoxGEN license verification endpoint, including device binding, expiry, revocation, and persistent activation.
- Remove the old license attestation dependency and all old license-server branding/config assumptions that would reject FoxGEN-generated keys.
- Remove the visible notification/notice controls and update-notice banner from this uploaded edition.
- Add FoxGEN Pro branding, logo, version labels, premium dark styling, and activation copy throughout the extension.
- Package the result as a new ZIP without replacing the current FoxGEN Pro 5.1.5 ZIP.
- Add a second download panel immediately below FoxGEN Pro 5.1.5 on the public download page and the logged-in Download section.

## Security
- The extension will contain only the public license verification URL. The private admin API key used to generate licenses will not be embedded in the downloadable files.
- Existing FoxGEN-generated license keys will unlock the extension through the same server-side verification system.

## Validation
- Check all extension JavaScript and manifest files, inspect the packaged ZIP contents, and verify both download buttons in the preview.
- Confirm the reported `use-mobile.tsx` / `App.tsx` / `main.tsx` errors are not present in the current TanStack app.
