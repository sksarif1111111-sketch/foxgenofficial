<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep each downloadable reseller extension in its own source directory so branding changes never overwrite another edition.

- Admin sales CRM tables use the `crm_` prefix and are admin-only via `is_admin(auth.uid())` RLS, with an audit trigger on every table; keeps CRM bookkeeping separate from the live store `products`/`shop_orders` tables.
