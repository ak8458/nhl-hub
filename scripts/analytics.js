/*
 * Customer Journey Analytics / Adobe Analytics instrumentation via the AEM martech plugin
 * (AEP Web SDK + Adobe Client Data Layer).
 *
 * Loaded lazily (never on the LCP path) since personalization is not used. Initializes the
 * Web SDK on import, sends the page view, and wires the global trackers (links, scroll depth,
 * block impressions). Blocks report interactions through scripts/analytics-events.js.
 * Event catalog and XDM mapping: docs/analytics/sdr.md
 */
import { getMetadata } from './aem.js';
import {
  initMartech,
  martechLazy,
  martechDelayed,
  pushEventToDataLayer,
  updateUserConsent,
  // the plugin is vendored as a git subtree (see docs/analytics/aep-setup.md), not an npm package
  // eslint-disable-next-line import/no-relative-packages
} from '../plugins/martech/src/index.js';
import {
  ORG_ID,
  TENANT_ID,
  DATASTREAMS,
  PROD_HOSTS,
  INTERNAL_HOST_PATTERNS,
  getEnvironment,
} from './martech-config.js';
import { trackEvent, setEventSender, disableEvents } from './analytics-events.js';

const ENVIRONMENT = getEnvironment();
const AUTH_IDENTITY_KEY = 'nhl-hub-auth-identity';
const URL_PARAM_ALLOWLIST = /^(utm_[a-z]+|cid|campaign)$/i;
const DOWNLOAD_PATTERN = /\.(pdf|docx?|xlsx?|pptx?|csv|zip|mp4|mov)$/i;
const SCROLL_MILESTONES = [25, 50, 75, 100];

// Adobe Analytics success events per interaction (see docs/analytics/sdr.md)
const AA_EVENTS = {
  'journey.search': 'event1',
  'journey.cardOpen': 'event2',
  'journey.filter': 'event3',
  'journey.relatedClick': 'event4',
  'video.start': 'event5',
  'video.milestone': 'event6',
  'video.complete': 'event7',
  'accordion.toggle': 'event8',
  'nav.toggle': 'event9',
  'widget.load': 'event10',
  'widget.interaction': 'event11',
  'scroll.depth': 'event12',
  'block.impression': 'event13',
  'journey.clear': 'event14',
};

// undefined while consent is pending, then true/false
let consentGranted;

function compact(obj) {
  const entries = Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return entries.length ? Object.fromEntries(entries) : undefined;
}

/**
 * Removes likely PII (emails, long digit sequences) and truncates free text.
 */
function scrubText(text, maxLength = 100) {
  if (!text) return undefined;
  return String(text)
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '[email]')
    .replace(/\d{4,}/g, '[number]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength) || undefined;
}

/**
 * Drops all query parameters except campaign tracking ones.
 */
function sanitizeUrl(url) {
  if (!url) return url;
  try {
    const parsed = new URL(url, window.location.href);
    [...parsed.searchParams.keys()].forEach((key) => {
      if (!URL_PARAM_ALLOWLIST.test(key)) parsed.searchParams.delete(key);
    });
    return parsed.href;
  } catch (e) {
    return undefined;
  }
}

function getPageContext() {
  const segments = window.location.pathname.split('/').filter(Boolean);
  return {
    web: {
      name: `nhl-hub:${segments.length ? segments.join(':').replace(/\.html$/, '') : 'home'}`,
      siteSection: segments[0] || 'home',
      server: window.location.hostname,
    },
    custom: compact({
      template: getMetadata('template') || 'default',
      theme: getMetadata('theme'),
      language: document.documentElement.lang,
      environment: ENVIRONMENT,
    }),
  };
}

const PAGE = getPageContext();

function getStoredIdentity() {
  try {
    return JSON.parse(sessionStorage.getItem(AUTH_IDENTITY_KEY));
  } catch (e) {
    return null;
  }
}

function mapAnalyticsVariables(payload, nhlHub) {
  // eslint-disable-next-line no-underscore-dangle
  const { analytics } = payload.data.__adobe;
  const { interaction = {}, journey = {}, media = {} } = nhlHub;
  Object.assign(analytics, compact({
    prop1: nhlHub.page?.template,
    eVar1: nhlHub.page?.template,
    eVar2: nhlHub.page?.environment,
    eVar3: interaction.name,
    eVar4: interaction.label,
    eVar5: interaction.region,
    eVar6: journey.searchTerm,
    eVar7: journey.title,
    eVar8: media.title,
    eVar9: journey.filterKey && `${journey.filterKey}:${journey.filterValue || 'all'}`,
    prop2: media.milestone,
  }));
  if (AA_EVENTS[interaction.name]) analytics.events = AA_EVENTS[interaction.name];
}

function onBeforeEventSend(payload) {
  const { xdm } = payload;
  xdm.web ||= {};
  xdm.web.webPageDetails = {
    ...PAGE.web,
    ...xdm.web.webPageDetails,
    URL: sanitizeUrl(xdm.web.webPageDetails?.URL || window.location.href),
  };
  if (xdm.eventType === 'web.webpagedetails.pageViews') {
    xdm.web.webPageDetails.pageViews = { value: 1 };
  }
  if (xdm.web.webReferrer?.URL) xdm.web.webReferrer.URL = sanitizeUrl(xdm.web.webReferrer.URL);
  if (xdm.web.webInteraction?.URL) {
    xdm.web.webInteraction.URL = sanitizeUrl(xdm.web.webInteraction.URL);
  }

  xdm[TENANT_ID] ||= {};
  const nhlHub = { ...xdm[TENANT_ID].nhlHub, page: PAGE.custom };
  xdm[TENANT_ID].nhlHub = nhlHub;

  const identity = getStoredIdentity();
  if (identity?.id && identity?.namespace) {
    xdm.identityMap = {
      ...xdm.identityMap,
      [identity.namespace]: [{ id: identity.id, authenticatedState: 'authenticated', primary: false }],
    };
  }

  mapAnalyticsVariables(payload, nhlHub);
  return true;
}

/**
 * Sends an interaction through the data layer. Every interaction carries
 * `web.webInteraction` so Adobe Analytics counts it as a link hit and not as a page view.
 */
function sendInteraction(name, details) {
  if (consentGranted === false) return;
  const {
    label, region, state, position, url, linkType = 'other', journey, media, scrollDepth,
  } = details;
  const cleanLabel = scrubText(label);
  const isLinkClick = name === 'link.click';
  pushEventToDataLayer(isLinkClick ? 'web.webinteraction.linkClicks' : `nhlhub.${name}`, {
    web: {
      webInteraction: {
        name: [name, cleanLabel].filter(Boolean).join(':').slice(0, 100),
        type: linkType,
        URL: url || window.location.href,
        linkClicks: { value: 1 },
      },
    },
    [TENANT_ID]: {
      nhlHub: compact({
        interaction: compact({
          name, label: cleanLabel, region, state, position,
        }),
        journey: journey && compact({ ...journey, searchTerm: scrubText(journey.searchTerm) }),
        media: media && compact(media),
        scrollDepth,
      }),
    },
  });
}

function isInternalHost(hostname) {
  return hostname === window.location.hostname
    || PROD_HOSTS.includes(hostname)
    || INTERNAL_HOST_PATTERNS.some((pattern) => pattern.test(hostname));
}

function getRegion(element) {
  if (element.closest('header')) return 'header';
  if (element.closest('footer')) return 'footer';
  return element.closest('[data-block-name]')?.dataset.blockName || 'main';
}

function initLinkTracking() {
  document.addEventListener('click', (event) => {
    const link = event.target.closest?.('a[href]');
    if (!link) return;
    let url;
    try {
      url = new URL(link.href, window.location.href);
    } catch (e) {
      return;
    }
    if (!['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol)) return;

    let linkType = 'other';
    if (DOWNLOAD_PATTERN.test(url.pathname)) linkType = 'download';
    else if (!url.protocol.startsWith('http') || !isInternalHost(url.hostname)) linkType = 'exit';

    trackEvent('link.click', {
      label: link.textContent.trim() || link.getAttribute('aria-label') || link.title,
      region: getRegion(link),
      url: url.protocol.startsWith('http') ? url.href : url.protocol,
      linkType,
    });
  }, { capture: true });
}

function initScrollTracking() {
  const reached = new Set();
  let ticking = false;
  let onScroll;
  const measure = () => {
    ticking = false;
    const { scrollHeight } = document.documentElement;
    if (scrollHeight <= window.innerHeight) return;
    const depth = ((window.scrollY + window.innerHeight) / scrollHeight) * 100;
    SCROLL_MILESTONES.forEach((milestone) => {
      if (depth >= Math.min(milestone, 99) && !reached.has(milestone)) {
        reached.add(milestone);
        trackEvent('scroll.depth', { label: `${milestone}%`, scrollDepth: milestone });
      }
    });
    if (reached.size === SCROLL_MILESTONES.length) window.removeEventListener('scroll', onScroll);
  };
  onScroll = () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(measure);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
}

function initBlockImpressions() {
  const blocks = [...document.querySelectorAll('main [data-block-name]')];
  if (!blocks.length || !('IntersectionObserver' in window)) return;
  const positions = new Map(blocks.map((block, index) => [block, index + 1]));
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      // tall blocks never reach 50% visibility, so also accept half a viewport of coverage
      const visibleEnough = entry.intersectionRatio >= 0.5
        || entry.intersectionRect.height >= window.innerHeight * 0.5;
      if (!entry.isIntersecting || !visibleEnough) return;
      observer.unobserve(entry.target);
      const { blockName } = entry.target.dataset;
      trackEvent('block.impression', {
        label: blockName,
        region: blockName,
        position: positions.get(entry.target),
      });
    });
  }, { threshold: [0, 0.25, 0.5, 0.75, 1] });
  blocks.forEach((block) => observer.observe(block));
}

let markConfigured;
// resolves once the Web SDK config is registered, before alloy loads and the page view is sent
const configured = new Promise((resolve) => { markConfigured = resolve; });

async function initAnalytics() {
  const datastreamId = DATASTREAMS[ENVIRONMENT];
  if (!ORG_ID || !datastreamId) {
    markConfigured(false);
    disableEvents();
    if (ENVIRONMENT !== 'prod') {
      // eslint-disable-next-line no-console
      console.info(`[analytics] disabled: set ORG_ID and DATASTREAMS.${ENVIRONMENT} in scripts/martech-config.js`);
    }
    return false;
  }

  try {
    await initMartech({
      orgId: ORG_ID,
      datastreamId,
      context: ['web', 'device', 'environment', 'placeContext'],
      // links are tracked by initLinkTracking, avoid double counting
      clickCollectionEnabled: false,
      thirdPartyCookiesEnabled: false,
      onBeforeEventSend,
    }, {
      personalization: false,
      analytics: true,
      dataLayer: true,
      // the page context is added in onBeforeEventSend instead of merging the whole ACDL state
      includeDataLayerState: false,
      launchUrls: [],
    });
    markConfigured(true);
    await martechLazy();
    // registered after the page view is queued so that it stays the first hit of the visit
    setEventSender(sendInteraction);
    initLinkTracking();
    initScrollTracking();
    initBlockImpressions();
    return true;
  } catch (error) {
    markConfigured(false);
    disableEvents();
    // eslint-disable-next-line no-console
    console.error('[analytics] initialization failed', error);
    return false;
  }
}

const ready = initAnalytics();

/**
 * Applies the visitor's consent decision to the Web SDK (Adobe consent standard 2.0).
 * Events queued while consent is pending are sent on opt-in and dropped on opt-out.
 * The decision is queued ahead of the page view, so a returning visitor who opted out is
 * never sent a hit based on a stale consent cookie.
 * @param {boolean} consented Whether the visitor consented to analytics
 */
export async function applyConsent(consented) {
  consentGranted = consented;
  if (!(await configured)) return;
  try {
    await updateUserConsent({
      collect: consented,
      marketing: false,
      personalize: false,
      share: false,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('[analytics] could not apply consent', error);
  }
}

/**
 * Sets (or clears, when `id` is empty) the authenticated identity sent in `identityMap`
 * alongside the ECID. Emails are normalized and SHA-256 hashed before they leave the browser.
 * @param {string} id The raw identifier, e.g. an email address or a CRM ID
 * @param {string} [namespace] AEP identity namespace code
 */
export async function setAuthenticatedIdentity(id, namespace = 'Email_LC_SHA256') {
  try {
    if (!id) {
      sessionStorage.removeItem(AUTH_IDENTITY_KEY);
      return;
    }
    let value = String(id).trim();
    if (namespace === 'Email_LC_SHA256') {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value.toLowerCase()));
      value = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    sessionStorage.setItem(AUTH_IDENTITY_KEY, JSON.stringify({ id: value, namespace }));
  } catch (e) {
    // storage or crypto unavailable: keep the visitor anonymous
  }
}

/**
 * Martech logic for the delayed phase (Launch containers, if ever configured).
 */
export async function analyticsDelayed() {
  if (await ready) await martechDelayed();
}
