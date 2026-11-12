# Your Project's Title...
Your project's description...

## Environments
- Preview: https://main--nhl-hub--ak8458.aem.page/
- Live: https://main--nhl-hub--ak8458.aem.live/

## Documentation

Before using the aem-boilerplate, we recommend you to go through the documentation on https://www.aem.live/docs/ and more specifically:
1. [Developer Tutorial](https://www.aem.live/developer/tutorial)
2. [The Anatomy of a Project](https://www.aem.live/developer/anatomy-of-a-project)
3. [Web Performance](https://www.aem.live/developer/keeping-it-100)
4. [Markup, Sections, Blocks, and Auto Blocking](https://www.aem.live/developer/markup-sections-blocks)

## Page authoring

- To use a looping hero video, add an MP4 link to the hero image cell or link the image to the MP4. The image remains the fallback when the video cannot play or reduced motion is enabled.
- To hide the masthead and navigation on a page, add `header: off` to its metadata. The home page remains headerless by default.

## Analytics

The site sends data to Adobe Experience Platform with the Web SDK, through the [AEM martech plugin](https://github.com/adobe-rnd/aem-martech) vendored in `plugins/martech`. The data is reported in Customer Journey Analytics and forwarded to Adobe Analytics.

- Add org and datastream IDs in `scripts/martech-config.js`. Tracking stays off until they are set.
- Collection is gated by consent through `scripts/consent-check.js`, which is a placeholder that defaults to decline; add `?consent=accept` to test.
- Blocks report interactions with `trackEvent('<area>.<action>', details)` from `scripts/analytics-events.js`.

Docs: [SDR](docs/analytics/sdr.md) · [AEP setup](docs/analytics/aep-setup.md) · [CJA setup](docs/analytics/cja-setup.md) · [Workspace design](docs/analytics/workspace-design.md) · [QA checklist](docs/analytics/qa-checklist.md) · [XDM field group](docs/analytics/xdm/nhl-hub-fieldgroup.json)

## Installation

```sh
npm i
```

## Linting

```sh
npm run lint
```

## Local development

1. Create a new repository based on the `aem-boilerplate` template
1. Add the [AEM Code Sync GitHub App](https://github.com/apps/aem-code-sync) to the repository
1. Install the [AEM CLI](https://github.com/adobe/helix-cli): `npm install -g @adobe/aem-cli`
1. Start AEM Proxy: `aem up` (opens your browser at `http://localhost:3000`)
1. Open the `nhl-hub` directory in your favorite IDE and start coding :)
