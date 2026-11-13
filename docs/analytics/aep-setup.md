# NHL Hub – AEP & Datastream Setup Runbook

These are one-time setup steps in Adobe Experience Platform (AEP) and Data Collection. When they are done, fill in [martech-config.js](../../scripts/martech-config.js).

Until `ORG_ID` and the datastream for the current environment are set, the site loads no Adobe code. It only logs `[analytics] disabled …` in non-production environments.

## Prerequisites

- Product profiles granting:
  - AEP: Schemas, Datasets, Identities, Datastreams
  - CJA admin access
  - AA admin access to the target report suite
- A **development** sandbox for build and QA, and the **production** sandbox for launch. Repeat steps 1–5 in each sandbox. Use the Sandbox tooling package feature to copy the schema, field group and dataset between sandboxes.

## 1. Field group and schema

1. Find the tenant ID under **Schemas › Account info**. It looks like `_nhl`.
   - Put it in `TENANT_ID` in `martech-config.js`.
   - Replace every `_tenant` key in [xdm/nhl-hub-fieldgroup.json](./xdm/nhl-hub-fieldgroup.json) with it.
2. Create the field group. Either:
   - `POST https://platform.adobe.io/data/foundation/schemaregistry/tenant/fieldgroups` with the JSON as the body, or
   - build it in the UI from [sdr.md §3](./sdr.md#3-custom-xdm-fields-_tenantnhlhub).
3. Create the schema **NHL Hub Web ExperienceEvent** with:
   - class **XDM ExperienceEvent**
   - field group **AEP Web SDK ExperienceEvent** (web, device, environment, placeContext, implementation details)
   - field group **Adobe Analytics ExperienceEvent Template**, which makes the AA variables available as XDM if needed later
   - field group **Consents and Preferences**, optional; it is used by profile-enabled consent policies
   - field group **NHL Hub Interactions**, the custom one from step 2
4. Leave the schema **not enabled for Profile**. CJA does not need it, and enabling it is irreversible. Enable it only if RTCDP or AJO audiences are planned.

## 2. Identity

- **ECID**: set automatically by the Web SDK. It is a first-party cookie set by the Edge Network.
  - Optional: a first-party CNAME (FPID or a custom domain such as `data.nhl.com`) extends cookie life on Safari.
- **Authenticated ID**: create the namespace **Email (SHA256, lowercased)**, code `Email_LC_SHA256`, if it doesn't exist.
  - After sign-in, call:

    ```js
    import { setAuthenticatedIdentity } from './scripts/analytics.js';
    await setAuthenticatedIdentity(email); // hashed in the browser, stored for the session
    await setAuthenticatedIdentity('');    // on sign-out
    ```

  - Use a different namespace (e.g. a CRM ID) by passing its code as the second argument.

## 3. Dataset

- Create the dataset **NHL Hub Web Events** from the schema.
- Do **not** enable it for Profile (same reason as step 1.4).
- Optional: set a data retention (TTL) policy that matches the CJA connection's rolling window.

## 4. Datastreams

Create two datastreams, `nhl-hub-dev` and `nhl-hub-prod`. Each uses the event schema **NHL Hub Web ExperienceEvent** and has these services:

| Service | dev | prod |
| --- | --- | --- |
| Adobe Experience Platform | dataset `NHL Hub Web Events` (dev sandbox) | dataset `NHL Hub Web Events` (prod sandbox) |
| Adobe Analytics | dev report suite | prod report suite |
| Target / Offer Decisioning / Audience Manager | off | off |

Datastream settings:
- **Geo lookup** on (city level) for CJA geo dimensions.
- **First-party ID cookie** only if FPID is adopted.
- **Access type**: Mixed authentication (the default).
- Leave **third-party ID sync** off; `thirdPartyCookiesEnabled` is `false` in code.

## 5. Configure the site

```js
// scripts/martech-config.js
export const ORG_ID = 'XXXXXXXXXXXXXXXXXXXXXXXX@AdobeOrg';
export const TENANT_ID = '_nhl';
export const DATASTREAMS = {
  dev: '<nhl-hub-dev datastream id>',   // localhost, *.aem.page, branch previews
  prod: '<nhl-hub-prod datastream id>', // hosts listed in PROD_HOSTS
};
export const PROD_HOSTS = ['main--nhl-hub--ak8458.aem.live', 'www.<production-domain>'];
```

Add the production custom domain to both `PROD_HOSTS` and `INTERNAL_HOST_PATTERNS` once it is live. Otherwise its traffic is counted as `dev` and same-site links as exits.

## 6. Consent

The site still uses the placeholder gate in [consent-check.js](../../scripts/consent-check.js).

- **Default:** decline. No data is collected unless the URL has `?consent=accept`.
- **Before go-live,** replace `hasConsent()` with the CMP's API (e.g. OneTrust `OptanonActiveGroups` plus its `OptanonWrapper` callback). Call `applyConsent(true|false)` on load and on every change.
- The Web SDK runs with consent `pending`. Events fired before a decision are queued; they are sent on opt-in and dropped on opt-out. The decision is applied before the page view.
- Decide with Legal whether the region's default may be opt-in (e.g. US) and document it here.

## 7. Implementation notes for EDS developers

- **Performance:** with personalization off, the Web SDK and ACDL load only at the end of `loadLazy`, after LCP, and the page view follows.
  - No `<head>` preloads or preconnects are added, so the Lighthouse score is unaffected.
  - Blocks import only the tiny `analytics-events.js`, which queues up to 50 events until the SDK is ready.
- **CSP:** alloy and ACDL load as same-origin ES modules and comply with the site's nonce, `strict-dynamic` and Trusted Types CSP. The Edge Network calls use `fetch`/`sendBeacon` to `edge.adobedc.net`; `connect-src` is not restricted today.
  - If a `connect-src` directive is added later, include `https://edge.adobedc.net` (and the CNAME, if any).
- **Plugin updates:** the plugin is vendored as a git subtree. Update it with:

  ```sh
  git subtree pull --squash --prefix plugins/martech https://github.com/adobe-rnd/aem-martech.git main
  ```

  The plugin is distributed by Adobe as part of a co-innovation/VIP program. Confirm support terms with your Adobe team before production.
