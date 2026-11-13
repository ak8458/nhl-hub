# NHL Hub – Customer Journey Analytics Setup

This runbook sets up the CJA connection, data view, components and stitching for the NHL Hub site. It assumes [aep-setup.md](./aep-setup.md) is done and data is landing in the **NHL Hub Web Events** dataset.

`_tenant` below means your tenant ID (e.g. `_nhl`).

## 1. Connection

| Setting | Value |
| --- | --- |
| Name | `NHL Hub – Web (prod)`; create a second connection on the dev sandbox for QA |
| Sandbox | Production |
| Dataset | `NHL Hub Web Events` (event dataset) |
| Person ID | `identityMap` › ECID, or the stitched ID once stitching is on (section 6) |
| Timestamp | `timestamp` |
| Import new data | On |
| Backfill | All existing data |
| Rolling data window | 13 months, or as agreed with Legal |

**Use the Web SDK dataset as the source, not the Adobe Analytics source connector.** The same hits also reach Adobe Analytics through the datastream. Adding the AA connector dataset to the connection would double-count every event.

## 2. Data view

| Setting | Value |
| --- | --- |
| Name | `NHL Hub – Web` |
| Time zone | The business's reporting time zone; match the AA report suite |
| Session timeout | 30 minutes |
| Calendar | Gregorian, week starting Monday (or as preferred) |
| Data view filter | `_tenant.nhlHub.page.environment` equals `prod` |

The environment filter keeps preview and localhost traffic out of production reporting, even if a dev datastream is misrouted. Create a separate `NHL Hub – Web (QA)` data view without the filter for testing.

Set **Person ID** visibility to admin-only. It is a pseudonymous ID.

## 3. Dimensions

| Display name | Schema path | Notes |
| --- | --- | --- |
| Page Name | `web.webPageDetails.name` | Set **Persistence: most recent, per session** to attribute interactions to their page |
| Site Section | `web.webPageDetails.siteSection` | |
| Page URL | `web.webPageDetails.URL` | Campaign parameters kept; other query parameters stripped |
| Referrer | `web.webReferrer.URL` | |
| Page Template | `_tenant.nhlHub.page.template` | |
| Page Language | `_tenant.nhlHub.page.language` | |
| Environment | `_tenant.nhlHub.page.environment` | |
| Interaction Name | `_tenant.nhlHub.interaction.name` | |
| Interaction Label | `_tenant.nhlHub.interaction.label` | |
| Interaction Region | `_tenant.nhlHub.interaction.region` | |
| Interaction State | `_tenant.nhlHub.interaction.state` | |
| Block Name | `_tenant.nhlHub.interaction.label` | Include-filter: Interaction Name equals `block.impression` |
| Block Position | `_tenant.nhlHub.interaction.position` | Bucketed integer, 1–10 |
| Link URL | `web.webInteraction.URL` | |
| Link Type | `web.webInteraction.type` | `other`, `exit`, `download` |
| Journey Search Term | `_tenant.nhlHub.journey.searchTerm` | Persistence: most recent, per session, so card opens attribute to searches |
| Journey Title | `_tenant.nhlHub.journey.title` | |
| Journey Level | `_tenant.nhlHub.journey.level` | |
| Journey Readiness | `_tenant.nhlHub.journey.readiness` | |
| Related From Journey | `_tenant.nhlHub.journey.sourceTitle` | |
| Journey Filter | Derived field (section 5) | `filterKey: filterValue` |
| Zero Results | `_tenant.nhlHub.journey.zeroResults` | Boolean |
| Video Title | `_tenant.nhlHub.media.title` | |
| Video Milestone | `_tenant.nhlHub.media.milestone` | Custom sort order: 25%, 50%, 75%, 100% |
| Scroll Depth | `_tenant.nhlHub.scrollDepth` | Integer, no bucketing |
| Event Type | `eventType` | Useful for QA |
| Device Type, Browser, OS, Country/Region | Standard `device.*`, `environment.*`, `placeContext.geo.*` | Geo requires geo lookup on the datastream |
| Marketing Channel | Derived field (section 5) | |

## 4. Metrics

Base metrics come from the **Interaction Name** dimension, using **Include/Exclude values** on the component.

| Display name | Definition |
| --- | --- |
| Page Views | `web.webPageDetails.pageViews.value` (sum) |
| Link Clicks | Interaction Name equals `link.click` |
| Exit Link Clicks | Link Clicks where Link Type equals `exit` |
| Downloads | Link Clicks where Link Type equals `download` |
| Journey Searches | Interaction Name equals `journey.search` |
| Zero-Result Searches | Journey Searches where Zero Results is `true` |
| Journey Filter Uses | Interaction Name equals `journey.filter` |
| Journey Filter Clears | Interaction Name equals `journey.clear` |
| Journey Card Opens | Interaction Name equals `journey.cardOpen` |
| Related Journey Clicks | Interaction Name equals `journey.relatedClick` |
| Video Starts | Interaction Name equals `video.start` |
| Video Completes | Interaction Name equals `video.complete` |
| Video Milestones | Interaction Name equals `video.milestone` |
| Accordion Expands | Interaction Name equals `accordion.toggle` and Interaction State equals `expanded` |
| Nav Opens | Interaction Name equals `nav.toggle` and Interaction State equals `expanded` |
| Widget Loads | Interaction Name equals `widget.load` and State equals `loaded` |
| Widget Errors | Interaction Name equals `widget.load` and State equals `error` |
| Widget Interactions | Interaction Name equals `widget.interaction` |
| Block Impressions | Interaction Name equals `block.impression` |
| Scroll 75%+ | Interaction Name equals `scroll.depth` and Scroll Depth ≥ 75 |

### Calculated metrics

| Name | Formula | Format |
| --- | --- | --- |
| Zero-Result Search Rate | Zero-Result Searches ÷ Journey Searches | Percent |
| Card Opens per Search | Journey Card Opens ÷ Journey Searches | Decimal |
| Search-to-Open Session Rate | Sessions with Journey Card Opens ÷ Sessions with Journey Searches (use segment-based metrics) | Percent |
| Video Completion Rate | Video Completes ÷ Video Starts | Percent |
| Video Start Rate | Video Starts ÷ Page Views, filtered to pages that contain the vidyard block (Block Name equals `vidyard`) | Percent |
| Exit Rate (links) | Exit Link Clicks ÷ Sessions | Percent |
| Engaged Sessions | Sessions in the **Engaged Session** segment (section 7) | Number |
| Engagement Rate | Engaged Sessions ÷ Sessions | Percent |
| Widget Error Rate | Widget Errors ÷ (Widget Loads + Widget Errors) | Percent |
| Block Interaction Rate | (Link Clicks + Accordion Expands + Widget Interactions) ÷ Block Impressions, broken down by Block Name/Interaction Region | Decimal |

## 5. Derived fields

- **Journey Filter.** Concatenate `filterKey`, `: ` and `filterValue`, giving values such as `level: advanced`.
- **Marketing Channel.** A Case When on `web.webPageDetails.URL` query parameters and `web.webReferrer.URL`:
  - `utm_medium` = `email` → Email
  - `utm_medium` = `cpc` or `paid*` → Paid Search
  - referrer is a known search engine → Natural Search
  - referrer is a social domain → Social
  - referrer is another external domain → Referring Domains
  - otherwise → Direct
  - Apply this to the first event of the session only, via a session-scoped Case When or the Marketing Channel function template.
- **Campaign.** URL Parse on `web.webPageDetails.URL`, query parameter `utm_campaign`, falling back to `cid`.
- **Clean Page Path.** URL Parse, path only. This gives a page dimension independent of the naming convention.

## 6. Identity stitching

Field-based stitching connects anonymous browsing (ECID) to signed-in activity (hashed email) once `setAuthenticatedIdentity()` is wired to the site's sign-in.

1. Request stitching for `NHL Hub Web Events` with:
   - persistent ID: `identityMap.ECID`
   - transient ID: `identityMap.Email_LC_SHA256`
   - replay window: 7 days (or as licensed)
2. Point the connection at the stitched dataset, with Person ID set to the stitched ID.
3. Until sign-in exists, leave stitching off. Person equals ECID, which means one person per browser.

## 7. Segments

| Name | Definition |
| --- | --- |
| Engaged Session | Session where (Page Views ≥ 2) **or** Scroll Depth ≥ 75 **or** any of Journey Card Opens, Video Starts, Accordion Expands or Widget Interactions exists |
| Journey Searchers | Session where Journey Searches exists |
| Zero-Result Searchers | Session where Zero-Result Searches exists |
| Video Viewers | Session where Video Starts exists |
| Video Completers | Session where Video Completes exists |
| Journey Explorers | Session where Journey Card Opens exists, then (sequential) Related Journey Clicks exists |
| Help Seekers | Session where Site Section equals `get-help` |
| Mobile | Device Type equals Mobile Phone |
| Internal/QA | Environment equals `dev`. Use it in the QA data view only. |

Share these segments with the NHL Hub project curators and mark them **Approved**.

## 8. Governance

- Apply data usage labels to the dataset in AEP, e.g. `C8` on the identity map. These carry over to CJA exports.
- Keep Person ID and the identity map out of the curated components.
- Document component owners and descriptions in the data view, using the descriptions in [sdr.md](./sdr.md).
- Changes follow the "Adding an event" rule in the SDR.
