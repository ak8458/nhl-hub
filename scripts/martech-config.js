/*
 * Adobe Experience Platform Web SDK configuration for the NHL Hub.
 * Fill in the values from Adobe Experience Platform Data Collection
 * (see docs/analytics/aep-setup.md).
 * Tracking stays disabled until ORG_ID and the datastream for the current environment are set.
 */

// IMS organization ID, e.g. 'ABC123DEF456@AdobeOrg'
export const ORG_ID = '';

// XDM tenant namespace of the org (Schemas > Account info), including the leading underscore
export const TENANT_ID = '_tenant';

// Datastream IDs per environment (Data Collection > Datastreams)
export const DATASTREAMS = {
  dev: '',
  prod: '',
};

// Hostnames that count as production traffic. Add the production domain once it is live.
export const PROD_HOSTS = [
  'main--nhl-hub--ak8458.aem.live',
];

// Hostnames treated as internal (not exit links) in addition to the current host
export const INTERNAL_HOST_PATTERNS = [
  /--nhl-hub--ak8458\.aem\.(page|live)$/,
  /^localhost$/,
];

/**
 * Resolves the analytics environment for a hostname.
 * @param {string} [hostname] The hostname, defaults to the current one
 * @returns {'prod'|'dev'} The environment
 */
export function getEnvironment(hostname = window.location.hostname) {
  return PROD_HOSTS.includes(hostname) ? 'prod' : 'dev';
}
