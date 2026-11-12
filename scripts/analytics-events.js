/*
 * Dependency-free tracking facade for blocks.
 *
 * Blocks import `trackEvent` from here so the martech stack (scripts/analytics.js, alloy, ACDL)
 * never becomes part of a block's static module graph or the LCP path. Events raised before
 * analytics is initialized are queued and flushed once a sender is registered.
 */

const MAX_QUEUE_SIZE = 50;
let sender;
let disabled = false;
const queue = [];

/**
 * Tracks a user interaction. See docs/analytics/sdr.md for the event catalog.
 * @param {string} name Event name, e.g. `journey.search` (sent as eventType `nhlhub.<name>`)
 * @param {Object} [details] Interaction details
 * @param {string} [details.label] Human readable label of the interacted element
 * @param {string} [details.region] Page region or block name the interaction happened in
 * @param {string} [details.state] State after the interaction, e.g. `expanded`
 * @param {number} [details.position] 1-based position of the element in its list
 * @param {Object} [details.journey] Journey Library details
 * @param {Object} [details.media] Video details
 */
export function trackEvent(name, details = {}) {
  if (disabled) return;
  if (sender) {
    sender(name, details);
  } else if (queue.length < MAX_QUEUE_SIZE) {
    queue.push([name, details]);
  }
}

/**
 * Registers the function that sends events and flushes any queued events.
 * @param {Function} fn The sender, called with `(name, details)`
 */
export function setEventSender(fn) {
  sender = fn;
  queue.splice(0).forEach(([name, details]) => fn(name, details));
}

/**
 * Permanently disables tracking for this page view (e.g. missing config or declined consent).
 */
export function disableEvents() {
  disabled = true;
  sender = undefined;
  queue.length = 0;
}
