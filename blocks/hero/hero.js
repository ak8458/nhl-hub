const VIDEO_PATTERN = /\.mp4($|[?#])/i;

function extractVideoLink(block) {
  const link = [...block.querySelectorAll('a[href]')]
    .find((a) => VIDEO_PATTERN.test(new URL(a.href, window.location.href).pathname));
  if (!link) return null;

  const { href } = link;
  const picture = link.querySelector('picture');
  if (picture) {
    link.replaceWith(picture);
  } else {
    const parent = link.parentElement;
    link.remove();
    if (parent?.tagName === 'P' && !parent.textContent.trim() && !parent.children.length) {
      parent.remove();
    }
  }
  return href;
}

function loadVideo(block, src, picture) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const video = document.createElement('video');
  video.className = 'hero-video';
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
  video.setAttribute('aria-hidden', 'true');
  video.setAttribute('tabindex', '-1');
  video.preload = 'none';
  const poster = picture?.querySelector('img');
  if (poster?.currentSrc || poster?.src) video.poster = poster.currentSrc || poster.src;

  video.addEventListener('playing', () => block.classList.add('hero-video-playing'), { once: true });
  video.addEventListener('error', () => {
    // eslint-disable-next-line no-console
    console.error('Hero background video failed to load.', video.error);
    video.remove();
  }, { once: true });

  const start = () => {
    video.src = src;
    if (picture) picture.after(video);
    else block.prepend(video);
    video.load();
    video.play().catch((error) => {
      // eslint-disable-next-line no-console
      console.error('Hero background video failed to play.', error);
    });
  };

  // Keep the poster image as LCP; begin streaming the video once the page has loaded.
  if (document.readyState === 'complete') setTimeout(start, 0);
  else window.addEventListener('load', () => setTimeout(start, 0), { once: true });
}

export default function decorate(block) {
  const videoSrc = extractVideoLink(block);
  const rows = [...block.children];
  const cells = rows.flatMap((row) => [...row.children]);
  const picture = block.querySelector('picture');
  const imageCell = picture ? cells.find((cell) => cell.contains(picture)) : null;
  const content = document.createElement('div');
  content.className = 'hero-content';

  cells.forEach((cell) => {
    if (cell === imageCell) return;
    while (cell.firstChild) content.append(cell.firstChild);
  });

  if (!content.textContent.trim()) {
    // eslint-disable-next-line no-console
    console.error('Hero block requires a text cell.');
    return;
  }

  block.replaceChildren();
  if (picture) {
    picture.classList.add('hero-image');
    const image = picture.querySelector('img');
    if (image && (block.classList.contains('home-hero') || block.classList.contains('nhl-masthead'))) {
      image.loading = 'eager';
      image.fetchPriority = 'high';
    }
    block.append(picture);
  }
  block.append(content);

  if (videoSrc) {
    block.classList.add('hero-has-video');
    loadVideo(block, videoSrc, picture);
  }
}
