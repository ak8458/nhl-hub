export default function decorate(block) {
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
}
