# NHL Hub – Analytics QA Checklist

Run this checklist on every branch preview (`https://<branch>--nhl-hub--ak8458.aem.page`) before merging analytics changes. Run it again on `.aem.live` after go-live.

## Tools

- **Adobe Experience Platform Debugger** (Chrome extension). Use its *Experience Platform Web SDK* tab, and its *Logs › Edge* view after signing in.
- **Adobe Experience Platform Assurance.** Create a session for the dev datastream and validate events against the schema in the *Event Transactions* view.
- **Browser DevTools › Network.** Filter on `/ee/` to see `interact` and `collect` calls to `edge.adobedc.net`.
- **Web SDK debug logging:** run `localStorage.setItem('com.adobe.alloy.debug', 'true')`, or add `?alloy_debug=true` to the URL.
- **Lighthouse / PageSpeed Insights** (mobile).

Always start with **cleared cookies and site data**. Alloy skips repeat consent calls when the consent cookie already matches, so a dirty profile gives misleading results.

## 1. Configuration and routing

| # | Check | Expected |
| --- | --- | --- |
| 1.1 | `martech-config.js` with an empty `ORG_ID` | Console shows `[analytics] disabled …` (non-prod only). No `alloy` or ACDL requests, no `/ee/` calls, no errors. |
| 1.2 | Preview (`*.aem.page`) or localhost | Requests use the **dev** datastream ID (`configId` query parameter). `_tenant.nhlHub.page.environment` = `dev`. |
| 1.3 | `.aem.live` or production domain | **prod** datastream ID; environment = `prod` |
| 1.4 | Network › JS | `alloy` and `acdl` load **after** LCP, from `loadLazy`. Nothing analytics-related appears in `<head>`. |

## 2. Consent matrix

Clear cookies before each row.

| # | Scenario | Expected |
| --- | --- | --- |
| 2.1 | No `consent` parameter (placeholder gate defaults to decline) | A `set-consent` call with `general: out`. No page view and no interactions are sent. |
| 2.2 | `?consent=accept` | A `set-consent` call with `general: in` **before** the page-view `interact` call, then interactions as you use the page |
| 2.3 | Accept, then reload with `?consent=decline` | One `set-consent` call (`out`). No page view or interactions after it. |
| 2.4 | Decline, then reload with `?consent=accept` | Consent changes to `in` and tracking resumes |
| 2.5 | Accept and interact before the SDK loads (fast clicks) | Queued events arrive after the page view, none lost (queue holds up to 50) |

Repeat 2.1–2.4 once the real CMP replaces [consent-check.js](../../scripts/consent-check.js).

## 3. Page view

| # | Check | Expected |
| --- | --- | --- |
| 3.1 | Exactly **one** page view per load | `eventType` = `web.webpagedetails.pageViews`, `pageViews.value` = 1 |
| 3.2 | Page name | `/` → `nhl-hub:home`; `/capabilities/creating-audiences` → `nhl-hub:capabilities:creating-audiences` |
| 3.3 | URL sanitization: open `/?utm_source=qa&email=a@b.com&foo=1` | `webPageDetails.URL` keeps `utm_source` only |
| 3.4 | Page context | `_tenant.nhlHub.page.template` / `.language` / `.environment` are present |
| 3.5 | AA in Debugger › Analytics | `pageName`, `channel`, `prop1`/`eVar1`, `eVar2` are set. The report suite matches the environment. |
| 3.6 | Prerendered or background tab | The page view is sent only once the page becomes visible |

## 4. Interactions, by page

For every interaction:
- `eventType` = `nhlhub.<name>`, or `web.webinteraction.linkClicks` for `link.click`
- `_tenant.nhlHub.interaction.name` is set
- `webInteraction.linkClicks.value` = 1
- the Adobe Analytics hit is a **link-tracking** call (`pe=lnk_o`, `lnk_e` or `lnk_d`), never a page view
- `eVar3`, `eVar4`, `eVar5` and the matching `eventN` are set

| Page | Action | Expected event and fields |
| --- | --- | --- |
| Any | Scroll to the bottom | `scroll.depth` at 25, 50, 75, 100 (once each); `event12` |
| Any | Load and scroll | One `block.impression` per block (`label` = block name, `position`); `event13` |
| Any | Open and close a header dropdown; mobile hamburger | `nav.toggle`, `state` expanded/collapsed, `region` header; `event9` |
| Any | Click a header or footer link | `link.click`, `region` header/footer, `webInteraction.type` other |
| `/` | Click a card CTA | `link.click`, `region` `cards` |
| Any | Click an external link | `webInteraction.type` = `exit` (AA `lnk_e`) |
| Any | Click a PDF or other document link | `type` = `download` (AA `lnk_d`) |
| `/use-cases` | Type a 3+ character term and pause 1 s | One `journey.search` with `searchTerm`, `resultsCount`, `zeroResults`; `eVar6`, `event1` |
| `/use-cases` | Search a nonsense term | `zeroResults` = true, `resultsCount` = 0 |
| `/use-cases` | Type the same term again | No duplicate search event |
| `/use-cases` | Change each filter (level, readiness, value, complexity), then set one back to "All" | `journey.filter` with `filterKey`/`filterValue` (`all` on reset); `eVar9`, `event3` |
| `/use-cases` | Click "Clear filters" | `journey.clear`; `event14` |
| `/use-cases` | Click "Learn more" on a card | `journey.cardOpen` with `id`, `title`, `level`, `readiness`, `position`; `eVar7`, `event2` |
| `/use-cases` | Choose a related journey in the dialog | `journey.relatedClick` with `sourceTitle`; `event4` |
| `/get-help`, `/capabilities/creating-audiences` | Expand, then collapse an accordion item | `accordion.toggle`, `state` expanded then collapsed, `position`, `region` accordion; `event8` |
| `/capabilities/creating-audiences` | Click an anchor-nav link | `link.click`, `region` `anchor-nav` |
| `/how-to-use/solution-overview` | Play video 1 | `video.start` with `media.id` (UUID), `title`, `length`; `eVar8`, `event5` |
| same | Let it play, or seek, past 25/50/75 % | `video.milestone` once each (`25%` …), `prop2`; `event6` |
| same | Play to the end | `video.complete`, `milestone` `100%`; `event7` |
| same | Play video 2 | Separate start, milestone and complete events with video 2's ID and title |
| Page with a widget | Load the widget, then click or change a control | `widget.load` state `loaded` (`event10`); `widget.interaction` label `<widget>:<control>` (`event11`) |
| Page with a broken widget | Point the widget at a missing resource | `widget.load` state `error` |

**Video milestones must be verified in a real (headed) browser.** Headless browsers can't play Vidyard media, so the progress messages were not observed during development. If no milestones arrive, inspect the iframe's `message` events in DevTools. The tracker accepts `timeupdate` (`params`) and `status` (`status.currentTime`) payloads from `https://play.vidyard.com`.

## 5. Privacy

| # | Check | Expected |
| --- | --- | --- |
| 5.1 | Type an email or a long number in the journey search | `searchTerm` and `label` are scrubbed |
| 5.2 | Payload inspection | No raw email, name or free text outside the scrubbed fields. No query parameters except `utm_*`, `cid`, `campaign`. |
| 5.3 | `setAuthenticatedIdentity('qa@example.com')` in the console (import the module first) | `identityMap.Email_LC_SHA256[0].id` is a 64-character hex hash, `authenticatedState` = `authenticated` |
| 5.4 | Cookies | Only first-party `kndctr_<org>_*` cookies; no third-party sync calls (`thirdPartyCookiesEnabled: false`) |

## 6. Performance

| # | Check | Expected |
| --- | --- | --- |
| 6.1 | PSI or Lighthouse mobile on `/` and `/use-cases`, with and without `?consent=accept` | Score of 100, or no regression vs. `main`. LCP, TBT and CLS unchanged. |
| 6.2 | Main-thread tasks during scroll | No long tasks from scroll tracking (it is rAF-throttled and passive) |
| 6.3 | Console | No errors or CSP / Trusted Types violations. The alloy "sendAdConversion declined" message after a decline is debug-only noise. |

## 7. Downstream validation

| # | Check | Expected |
| --- | --- | --- |
| 7.1 | Assurance › Event Transactions | Events validate against the **NHL Hub Web ExperienceEvent** schema with no dropped fields |
| 7.2 | AEP dataset `NHL Hub Web Events` (preview, about 15 min later) | Rows have the custom `_tenant.nhlHub.*` fields; ingestion has no failed batches |
| 7.3 | CJA QA data view (up to 90 min) | Page Views and the interaction metrics match the test session |
| 7.4 | AA dev report suite, Real-Time or Debugger | Page views are not inflated; interaction events count as link hits |
| 7.5 | Prod data view | Shows no `dev` environment rows |
