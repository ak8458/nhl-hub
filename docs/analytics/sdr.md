# NHL Hub – Solution Design Reference (SDR)

This is the single source of truth for the NHL Hub (AEM Edge Delivery Services) analytics implementation:
- what the site collects
- where each value lands in XDM
- how it is forwarded to Adobe Analytics
- how it surfaces in Customer Journey Analytics (CJA)

| Item | Value |
| --- | --- |
| Collection | AEP Web SDK (alloy 2.31) via the [aem-martech plugin](../../plugins/martech), configured in [analytics.js](../../scripts/analytics.js) |
| Data layer | Adobe Client Data Layer (ACDL). Blocks call `trackEvent()` from [analytics-events.js](../../scripts/analytics-events.js). |
| Schema | `NHL Hub Web ExperienceEvent` (XDM ExperienceEvent), see [aep-setup.md](./aep-setup.md) |
| Custom namespace | `_<tenant>.nhlHub`, defined in the field group [nhl-hub-fieldgroup.json](./xdm/nhl-hub-fieldgroup.json) |
| Identity | ECID (first-party, Edge-set), plus an optional hashed `Email_LC_SHA256` via `setAuthenticatedIdentity()` |
| Consent | Adobe consent standard 2.0, default `pending`. Only `collect` is ever granted; `marketing`, `personalize` and `share` are always `n`. |
| Destinations | AEP dataset (for CJA) and an Adobe Analytics report suite (a datastream service) |

## 1. Event catalog

Every event carries the page context described in section 2.

Interaction events also carry `web.webInteraction` with `linkClicks.value = 1`. Adobe Analytics therefore records them as link-tracking hits, never as page views.

| Event (`interaction.name`) | `eventType` | Trigger | Source | Event-specific fields |
| --- | --- | --- | --- | --- |
| Page view | `web.webpagedetails.pageViews` | Page becomes visible (prerender-aware), after LCP | martech plugin | `web.webPageDetails.pageViews.value = 1` |
| `link.click` | `web.webinteraction.linkClicks` | Click on any `http(s)`, `mailto:` or `tel:` link | global listener | `webInteraction.type` = `other` / `exit` / `download`, `webInteraction.URL`, `interaction.region` |
| `nav.toggle` | `nhlhub.nav.toggle` | Header dropdown or hamburger opened or closed | header | `interaction.state` = `expanded` / `collapsed` |
| `accordion.toggle` | `nhlhub.accordion.toggle` | FAQ item opened or closed | accordion | `interaction.state`, `interaction.position` |
| `journey.search` | `nhlhub.journey.search` | Search input unchanged for 1 s, 3+ characters, de-duplicated | journey-library | `journey.searchTerm`, `journey.resultsCount`, `journey.zeroResults` |
| `journey.filter` | `nhlhub.journey.filter` | Level, readiness, value or complexity filter changed | journey-library | `journey.filterKey`, `journey.filterValue`, `journey.resultsCount` |
| `journey.clear` | `nhlhub.journey.clear` | "Clear filters" clicked | journey-library | `journey.resultsCount` |
| `journey.cardOpen` | `nhlhub.journey.cardOpen` | "Learn more" opens a journey dialog | journey-library | `journey.id`, `journey.title`, `journey.level`, `journey.readiness`, `interaction.position` |
| `journey.relatedClick` | `nhlhub.journey.relatedClick` | Related journey chosen inside a dialog | journey-library | `journey.id`, `journey.title`, `journey.level`, `journey.sourceTitle` |
| `video.start` | `nhlhub.video.start` | First `play` of a Vidyard video | vidyard | `media.id`, `media.title`, `media.length` |
| `video.milestone` | `nhlhub.video.milestone` | 25 / 50 / 75 % watched (once each) | vidyard | `media.milestone` |
| `video.complete` | `nhlhub.video.complete` | Vidyard `videoComplete` or `playerComplete` | vidyard | `media.milestone = 100%` |
| `widget.load` | `nhlhub.widget.load` | Widget loaded or failed to load | widget | `interaction.state` = `loaded` / `error` |
| `widget.interaction` | `nhlhub.widget.interaction` | Button or summary click, or form-field change, inside a widget | widget | `interaction.label` = `<widget>:<control>` |
| `scroll.depth` | `nhlhub.scroll.depth` | 25 / 50 / 75 / 100 % of the page reached (once each) | global | `scrollDepth` |
| `block.impression` | `nhlhub.block.impression` | Block is at least 50 % visible, or covers half the viewport; once per page | global | `interaction.label` = block name, `interaction.position` |

Anchor-nav links and card CTAs are covered by `link.click`, with `interaction.region` set to `anchor-nav` or `cards`.

Vidyard tracking reads the `postMessage` events that the player iframe posts to the page. The Vidyard v4 API script cannot be used because it writes `innerHTML`, which the site's Trusted Types CSP blocks.

## 2. Page context (all events)

| XDM path | Example | Logic |
| --- | --- | --- |
| `web.webPageDetails.name` | `nhl-hub:capabilities:creating-audiences` | `nhl-hub:` plus the path segments joined by `:`; `home` for `/` |
| `web.webPageDetails.siteSection` | `capabilities` | First path segment; `home` for `/` |
| `web.webPageDetails.server` | `main--nhl-hub--ak8458.aem.live` | Hostname |
| `web.webPageDetails.URL` | `https://…/capabilities?utm_source=x` | Query string reduced to `utm_*`, `cid` and `campaign` |
| `web.webReferrer.URL` | | Same sanitization |
| `_<tenant>.nhlHub.page.template` | `default` | `template` page metadata |
| `_<tenant>.nhlHub.page.theme` | | `theme` page metadata |
| `_<tenant>.nhlHub.page.language` | `en` | `<html lang>` |
| `_<tenant>.nhlHub.page.environment` | `prod` / `dev` | `getEnvironment()` in [martech-config.js](../../scripts/martech-config.js) |
| `identityMap.Email_LC_SHA256` | `[{ id: <sha256>, authenticatedState: "authenticated" }]` | Only present after `setAuthenticatedIdentity()` |

The Web SDK also collects its standard context automatically: `web`, `device`, `environment` and `placeContext`.

## 3. Custom XDM fields (`_<tenant>.nhlHub`)

| Path | Type | Notes |
| --- | --- | --- |
| `interaction.name` | string | Event name from section 1 |
| `interaction.label` | string | Visible text. Emails and runs of 4+ digits are scrubbed; max 100 characters. |
| `interaction.region` | string | `header`, `footer`, the block name, or `main` |
| `interaction.state` | string | `expanded`, `collapsed`, `loaded`, `error` or `changed` |
| `interaction.position` | integer | 1-based position of the item or block |
| `journey.id` / `title` / `level` / `readiness` | string | Journey record attributes |
| `journey.sourceTitle` | string | The journey whose dialog contained the related link |
| `journey.searchTerm` | string | Lower-cased and scrubbed the same way as labels |
| `journey.resultsCount` | integer | Number of visible results after the action |
| `journey.zeroResults` | boolean | |
| `journey.filterKey` / `filterValue` | string | `filterValue` is `all` when a filter is reset to "All" |
| `media.id` / `title` | string | Vidyard UUID and the author-provided title |
| `media.length` | integer | Seconds |
| `media.milestone` | string | `25%`, `50%`, `75%` or `100%` |
| `scrollDepth` | integer | 25, 50, 75 or 100 |

## 4. Adobe Analytics mapping (datastream → report suite)

Variables are sent in `data.__adobe.analytics`, which takes precedence over the automatic XDM mapping.

| Variable | Name | Source | Allocation / expiration |
| --- | --- | --- | --- |
| `pageName` | Page Name | Auto, from `webPageDetails.name` | – |
| `channel` | Site Section | Auto, from `webPageDetails.siteSection` | – |
| `prop1` / `eVar1` | Page Template | `page.template` | Most recent; expires at hit |
| `eVar2` | Environment | `page.environment` | Expires at hit |
| `eVar3` | Interaction Name | `interaction.name` | Expires at hit |
| `eVar4` | Interaction Label | `interaction.label` | Expires at hit |
| `eVar5` | Interaction Region | `interaction.region` | Expires at hit |
| `eVar6` | Journey Search Term | `journey.searchTerm` | Expires at visit, to attribute card opens to searches |
| `eVar7` | Journey Title | `journey.title` | Expires at hit |
| `eVar8` | Video Title | `media.title` | Expires at hit |
| `eVar9` | Journey Filter | `filterKey:filterValue` | Expires at hit |
| `prop2` | Video Milestone | `media.milestone` | – |

| Event | Name | Type |
| --- | --- | --- |
| `event1` | Journey Searches | counter |
| `event2` | Journey Card Opens | counter |
| `event3` | Journey Filter Uses | counter |
| `event4` | Related Journey Clicks | counter |
| `event5` | Video Starts | counter |
| `event6` | Video Milestones | counter |
| `event7` | Video Completes | counter |
| `event8` | Accordion Toggles | counter |
| `event9` | Navigation Toggles | counter |
| `event10` | Widget Loads | counter |
| `event11` | Widget Interactions | counter |
| `event12` | Scroll Milestones | counter |
| `event13` | Block Impressions | counter |
| `event14` | Journey Filter Clears | counter |

Adobe Analytics is the secondary destination. Zero-result rates, video completion rates and the other derived KPIs are built in CJA (see [cja-setup.md](./cja-setup.md)).

## 5. Governance rules

- **No raw PII.**
  - Labels and search terms are scrubbed.
  - URLs keep only campaign parameters.
  - Authenticated IDs are SHA-256 hashed in the browser.
- **Adding an event:**
  1. Call `trackEvent('<area>.<action>', details)` in the block.
  2. Extend this SDR and the XDM field group if new fields are needed.
  3. Add an AA event in `AA_EVENTS` if a counter is needed.
  4. Add a CJA metric.

  Never call alloy directly from a block.
- **Naming:** event names are `<area>.<action>` in lower camelCase, stable and English-only. Display names belong in the CJA data view.
