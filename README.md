# Dizzle Management

Next.js 16 homepage profit calculator, ready to deploy on Vercel.

## Start locally

Run `npm install`, copy `.env.example` to `.env.local`, and run `npm run dev`. Without a database the homepage shows an onboarding state with an optional, clearly labeled demo. No sample data enters your database.

## Vercel setup

1. Push this folder to a Git repository and import it into Vercel as a Next.js project.
2. Create a hosted Postgres database (for example Neon). Set `DATABASE_URL` with its SSL connection string. Tables are created automatically by the application; the database role needs schema creation privileges.
3. The dashboard has no login. Anyone with the site URL can view invoices and use manual sync and CSV import. Invoice PDFs are accessible through the site. The scheduled sync endpoint separately requires its bearer token.
4. Set a long random `CRON_SECRET`. The scheduled endpoint checks Vercel's bearer authorization header independently from dashboard authentication.
5. Add the Zoho variables listed in `.env.example`. Use a server-side OAuth client and a refresh token authorized for your organization with `ZohoInventory.invoices.READ` and `ZohoInventory.items.READ`. Use the accounts and API domains for your Zoho region. Never use `NEXT_PUBLIC_` for credentials.
6. Optionally add an Azure AI Document Intelligence endpoint and key for the prebuilt invoice OCR model. Invoice PDFs are sent to that Azure resource. Without these, syncing structured invoice data still works and OCR is marked unconfigured internally.
7. Deploy, open the homepage, upload the SKU cost CSV, then select **Sync invoices**.

Daily Vercel cron is declared in `vercel.json` at **02:00 UTC**, fixed **6 PM PST (UTC−8)**. During daylight saving time this is 7 PM in Los Angeles. The handler only imports during the 6 PM PST hour, and records the scheduled day to skip repeated successful runs. Manual sync remains available at any time. Vercel Hobby cron may invoke anywhere within the scheduled hour; precise minute timing is not guaranteed. The app need not remain open. Function duration and cron availability depend on your Vercel plan.

## Cost CSV

Accepts your Zoho Inventory item export directly using `Item ID`, `SKU`, `Item Name`, and `Purchase Price` (including amounts such as `USD 80.00`). Also accepts simple `sku,title,cost` files, `sku number`, and `product title`. Standard CSV quoting is supported, including commas inside quoted titles. Maximum request content: 2 MB. Duplicate SKUs require unique Zoho Item IDs. Exact Item ID matches take priority; ambiguous SKUs never get a guessed cost. Duplicate Item IDs, missing fields, and invalid or negative costs reject the entire import before saving. SKUs are exact, case-sensitive matches; keep leading zeroes. Zero cost is valid.

Costs upsert by SKU; omitted products retain their previous costs. Importing new costs recalculates **all historical synced invoices**. This is a current-cost profitability calculator, not an inventory valuation or accounting ledger. Supply costs in the same currency as the corresponding invoices. Multiple invoice currencies display separately; there is no currency conversion. If a SKU is sold across multiple currencies, convert invoices/costs to one currency before using this version.

## Calculation and sync behavior

- Imports invoices dated **October 1, 2026 through today**, continuing into each new month, whose Zoho `is_emailed` flag is true, excluding void invoices. The cutoff uses the invoice date, not its email or modification date. Does not send emails or change Zoho records.
- Sales use Zoho's final `total`, after discounts, including any taxes, shipping charges, and adjustments, to match the displayed invoice amount. Profit is the final invoice total less product costs; this simple calculator does not separately subtract tax liabilities, shipping expense, fees, overhead, refunds, or credit notes. Existing subtotal-based records are migrated or re-fetched on the next sync.
- Cost = sum of invoice line quantity × CSV unit cost, matched first by Zoho Item ID and then by unambiguous SKU. If invoice details omit SKU, the app resolves it from Zoho's item API.
- Any unmatched SKU makes the order's cost and profit unknown. Unknown orders remain in total sales, but are excluded from cost/profit totals and weighted margin.
- Profit = sales − cost. Margin = profit ÷ sales × 100. The summary margin is weighted by matched sales.
- OCR extracts the invoice PDF into stored JSON for future review workflows. Accurate Zoho structured sales/quantities remain authoritative; OCR never invents SKU costs. There is no OCR review interface yet.
- Repeated syncs skip unchanged completed invoices. Changed invoices update by Zoho invoice ID. Imported invoices later voided or no longer emailed are removed when seen again. Deleted Zoho invoices are not automatically reconciled.
- Sync is locked against concurrent runs. Each request has a time budget and returns `more: true` if incomplete; use manual sync again to continue. Large initial backfills may need multiple runs. OCR errors remain retryable. Full-sync timestamp advances only after the whole listing is scanned.

## Validation

`npm run build` runs the production compilation and TypeScript checks. Live database, Zoho OAuth, PDF export, Azure OCR, and Vercel scheduled execution require your service credentials and must be verified after setup.

Official references: [Zoho Inventory invoices](https://www.zoho.com/inventory/api/v1/invoices/), [Zoho Inventory items](https://www.zoho.com/inventory/api/v1/items/), [Vercel cron](https://vercel.com/docs/cron-jobs).


## Sample Cost page

`/samples` tracks invoice lines labeled sample/samples, separately from the profit calculator. The old `/sample-cost` link redirects here. Select a month and rep; Sync samples scans that month’s emailed, non-void Zoho invoices, including samples on mixed paid orders. The 6 PM PST daily job also updates samples for the current Los Angeles calendar month. Each month retains a scan cache and can resume a partial scan.

## Continue on another computer

Clone this private repository and open its folder in Codex. Install Node.js and run `npm ci`. Link the existing Vercel project using `npx vercel link --scope dizzle-dist`, choosing **dizzle-management**, rather than creating a new project. To use the existing database and Zoho connection locally, run `npx vercel env pull .env.local --environment=production --scope dizzle-dist` from this trusted computer. This downloads production credentials into an ignored local file; keep the file private. Run `npm run dev` for local work and `npm run build` before deployment.

Deploy authorized changes to the existing site with `npx vercel deploy --prod --scope dizzle-dist`. Pull changes before working on a second computer and commit/push source changes when finished. Never commit environment files, customer exports, invoice backups, or credentials. Local one-off reporting scripts are excluded from this repository.

## Zoho Assistant

`/assistant` provides read-only AI invoice reporting using `OPENAI_API_KEY`. It is intentionally open without a sign-in, as requested by the workspace owner. Zoho and OpenAI credentials stay server-side. OpenAI API usage is billed to the configured project. Invoice queries have scan limits and must label incomplete results.

Descriptions like `2 x Product` become individual sample rows, multiplied by the invoice line quantity. Unparseable quantities and unknown sample-pack costs remain unresolved. Full-display pricing is never automatically divided into sample packs. Only exact normalized catalog names auto-match; conflicting catalog prices remain unresolved. Enter a cost per actual sample unit on the page to save it for matching names in the same currency across all months. Monthly totals are labeled partial while any lines remain unresolved; no known costs displays Pending. These are current-cost tracking estimates, not historical cost snapshots.
