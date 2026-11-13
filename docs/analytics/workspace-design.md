# NHL Hub – Analysis Workspace Design

This is the design for the **NHL Hub – Site Performance** Workspace project. It uses the `NHL Hub – Web` data view and the components defined in [cja-setup.md](./cja-setup.md).

Project settings:
- Default date range: last 30 complete days, compared to the prior period.
- Curated components only.
- Shared view-only with stakeholders.
- Scheduled PDF weekly on Monday.

## Panel 1 – Executive overview

**Question:** Is the hub attracting and engaging the audience?

| Visualization | Configuration |
| --- | --- |
| Summary numbers | People, Sessions, Page Views, Engagement Rate, Journey Card Opens, Video Completes. Each has a trend sparkline and a % change vs. the prior period. |
| Line | Sessions and Engaged Sessions by day |
| Freeform table | Marketing Channel × Sessions, Engagement Rate, Page Views per session |
| Donut | Device Type by Sessions |
| Map (optional) | Country/Region by Sessions |

Panel dropdown filters: Marketing Channel, Device Type.

## Panel 2 – Content & navigation

**Question:** Which pages and paths are working?

| Visualization | Configuration |
| --- | --- |
| Freeform table | Page Name × Page Views, Sessions, Scroll 75%+ (as % of Page Views), Exit Link Clicks |
| Freeform table | Site Section × Page Views, Engagement Rate |
| Flow | Entry on Page Name (session container), 3 steps |
| Freeform table | Interaction Region (`header`, `footer`, `cards`, `anchor-nav` …) × Link Clicks, broken down by Interaction Label |
| Freeform table | Link URL × Exit Link Clicks and Downloads |
| Bar | Scroll Depth × Page Views, filtered to the selected page |
| Freeform table | Nav Opens by Interaction Label (menu item) |

## Panel 3 – Journey library funnel

**Question:** Do visitors find the journeys they look for?

| Visualization | Configuration |
| --- | --- |
| Fallout | Session container. Steps: Page Name = `nhl-hub:use-cases` → Journey Searches **or** Journey Filter Uses → Journey Card Opens → Related Journey Clicks. |
| Summary numbers | Journey Searches, Zero-Result Search Rate, Card Opens per Search |
| Freeform table | Journey Search Term × Journey Searches, Zero-Result Search Rate, Journey Card Opens (term persists per session). Sort by searches. |
| Freeform table | Journey Search Term filtered to Zero Results = `true`. This is the content-gap backlog. |
| Freeform table | Journey Filter × Journey Filter Uses |
| Freeform table | Journey Title × Journey Card Opens, broken down by Journey Level and Journey Readiness |
| Freeform table | Related From Journey × Journey Title, with Related Journey Clicks |

## Panel 4 – Video engagement

**Question:** Do the solution-overview videos hold attention?

| Visualization | Configuration |
| --- | --- |
| Summary numbers | Video Starts, Video Completes, Video Completion Rate |
| Freeform table | Video Title × Video Starts, the four milestones (Video Milestones filtered to each milestone), Video Completes, Video Completion Rate |
| Fallout | Hit container. Steps: Video Starts → Milestone 25% → 50% → 75% → Video Completes, per Video Title |
| Freeform table | Page Name × Video Start Rate |

## Panel 5 – Engagement & block performance

**Question:** Which blocks and components earn interaction?

| Visualization | Configuration |
| --- | --- |
| Freeform table | Block Name × Block Impressions, Block Interaction Rate |
| Freeform table | Block Position × Block Impressions. This shows how far down the page visitors get. |
| Freeform table | Accordion: Interaction Label (question) × Accordion Expands, filtered to Interaction Region = `accordion`, on `get-help` and `capabilities/*` pages |
| Freeform table | Widget: Interaction Label × Widget Loads, Widget Errors, Widget Error Rate, Widget Interactions |
| Cohort (optional) | Inclusion: Journey Card Opens; return: Sessions, weekly |

## Alerts

| Alert | Condition |
| --- | --- |
| Tracking outage | Page Views drop more than 50 % vs. the expected value (anomaly detection), daily |
| Widget failures | Widget Errors > 0, daily |
| Search gaps | Zero-Result Search Rate > 30 %, weekly |
