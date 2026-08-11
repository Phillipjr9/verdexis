# Verdexis Website and Legal Audit

## Public pages

Implemented routes include `/`, `/about`, `/products`, `/markets`, `/news`, `/help`, `/faq`, `/contact`, `/support`, `/fees`, `/status`, `/security`, `/security/fraud-prevention`, `/careers`, `/privacy`, `/terms`, `/cookies`, `/cookie-preferences`, `/risk-disclosure`, `/disclosures`, `/regulatory`, and `/accessibility`.

Pages that require authentication remain protected by the existing route guards. No fake public route is used for an unavailable feature.

## Legal and disclosure pages

- `/privacy`: draft privacy structure with clearly marked legal-review requirements.
- `/terms`: draft terms structure with jurisdiction-specific items marked for legal review.
- `/cookies`: actual essential-cookie and consent behavior described without claiming unconfigured trackers.
- `/risk-disclosure`: plain-language risk, liquidity, technology, provider, currency, fee, tax, and performance limitations.
- `/disclosures`: existing project disclosure page retained for platform-specific disclosures.
- `/regulatory`: explicitly states that verified licenses/registrations have not been supplied; no claims or badges are made.
- `/security`: describes implemented security controls without absolute-security claims.
- `/accessibility`: accessibility priorities and feedback structure without certification claims.

These pages are informational drafts and require business/legal review before production publication.

## Footer and navigation

The reusable `app/src/components/Footer.tsx` provides responsive five-column navigation, mobile expandable groups, legal links, a dynamic copyright year, and a reusable risk disclaimer. Unsupported address, phone, bank-level-security, and institutional-grade claims were removed from the footer.

Public navigation includes Home, Markets, News, About, Products, Resources, Help, Support, and Legal. Authenticated navigation remains separate in `Navigation.tsx`.

## Cookies

The existing consent banner stores consent locally, supports accept/reject, and can be reopened through footer Cookie preferences. The current application states that only essential cookies/storage are used by default. Non-essential telemetry must remain gated by consent.

## SEO, sitemap, and robots

- `app/index.html` uses `www.verdexisgroup.com` canonical/Open Graph URLs and conservative factual metadata.
- `app/public/sitemap.xml` contains public routes only and uses the production domain.
- `app/public/robots.txt` disallows private/authenticated paths and points to the production sitemap.

Per-route title and metadata can be expanded through the existing `DocumentTitle` component; legal pages use accessible one-level H1 headings and structured H2 sections.

## Security and content safety

Customer support copy tells users not to submit passwords, private keys, seed phrases, API secrets, or authentication codes. Regulatory, address, phone, license, insurance, AUM, customer-count, and performance claims are not fabricated.

## Remaining verified-input items

- Supply approved legal text, entity name, jurisdiction, governing law, privacy rights process, retention schedule, and verified contact details.
- Supply actual fee schedule from authoritative backend configuration.
- Connect real uptime monitoring before publishing uptime statistics.
- Confirm analytics/marketing technologies and update cookie disclosures if enabled.
- Add approved provider-specific SPF, DKIM, and DMARC records without guessing values.
