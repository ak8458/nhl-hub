import { trackEvent } from '../../scripts/analytics-events.js';

const VIDYARD_ORIGIN = 'https://play.vidyard.com';
const MILESTONES = [25, 50, 75];

/**
 * Tracks playback via the messages the Vidyard player iframe posts to its parent.
 * The Vidyard v4 API script is not used: it relies on innerHTML, which the
 * Trusted Types CSP blocks.
 */
function trackVideos(videos) {
  const track = (name, video, details = {}) => trackEvent(name, {
    label: video.title,
    region: 'vidyard',
    position: video.position,
    media: {
      id: video.id, title: video.title, length: video.length, ...details,
    },
  });

  window.addEventListener('message', (event) => {
    if (event.origin !== VIDYARD_ORIGIN || typeof event.data !== 'string') return;
    let message;
    try {
      message = JSON.parse(event.data);
    } catch (e) {
      return;
    }
    const video = videos.get(message?.uuid);
    if (!video) return;

    if (message.event === 'requestParentOrigin') {
      event.source?.postMessage(JSON.stringify({ event: 'captureParentOrigin', uuid: message.uuid }), event.origin);
      return;
    }
    if (message.metadata?.length_in_seconds) video.length = message.metadata.length_in_seconds;

    if (message.event === 'play' && !video.started) {
      video.started = true;
      track('video.start', video);
    }
    const currentTime = message.event === 'timeupdate' ? message.params : message.status?.currentTime;
    if (video.started && video.length && Number.isFinite(currentTime)) {
      const progress = (currentTime / video.length) * 100;
      MILESTONES.filter((m) => progress >= m && !video.milestones.has(m)).forEach((m) => {
        video.milestones.add(m);
        track('video.milestone', video, { milestone: `${m}%` });
      });
    }
    if (['videoComplete', 'playerComplete'].includes(message.event) && !video.completed) {
      video.completed = true;
      track('video.complete', video, { milestone: '100%' });
    }
  });
}

export default function decorate(block) {
  const videos = new Map();
  const figures = [...block.children].map((row, index) => {
    const link = row.querySelector('a[href]');
    const match = link?.href.match(/(?:play\.vidyard\.com\/|share\.vidyard\.com\/watch\/)([a-zA-Z0-9]+)/);
    if (!link || !match) {
      // eslint-disable-next-line no-console
      console.error(`Vidyard block row ${index + 1} requires a link to a Vidyard video.`);
      return null;
    }

    const title = link.textContent.trim() || 'NHL enablement video';
    const description = [...row.querySelectorAll('p')]
      .find((paragraph) => !paragraph.contains(link))?.textContent.trim() || '';
    videos.set(match[1], {
      id: match[1], title, position: index + 1, milestones: new Set(),
    });
    const figure = document.createElement('figure');
    figure.className = 'vidyard-figure';

    const frame = document.createElement('div');
    frame.className = 'vidyard-frame';
    const iframe = document.createElement('iframe');
    iframe.src = `https://play.vidyard.com/${match[1]}.html`;
    iframe.title = title;
    iframe.loading = 'lazy';
    iframe.allow = 'autoplay; fullscreen; picture-in-picture';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.append(iframe);

    const caption = document.createElement('figcaption');
    const heading = document.createElement('h3');
    heading.textContent = title;
    caption.append(heading);
    if (description) {
      const text = document.createElement('p');
      text.textContent = description;
      caption.append(text);
    }

    const externalLink = document.createElement('a');
    externalLink.href = `https://share.vidyard.com/watch/${match[1]}`;
    externalLink.target = '_blank';
    externalLink.rel = 'noreferrer';
    externalLink.textContent = `Watch ${title} on Vidyard`;
    caption.append(externalLink);
    figure.append(frame, caption);
    return figure;
  });

  if (figures.length === 0 || figures.some((figure) => !figure)) return;

  const grid = document.createElement('div');
  grid.className = 'vidyard-grid';
  grid.append(...figures);
  block.replaceChildren(grid);
  trackVideos(videos);
}
