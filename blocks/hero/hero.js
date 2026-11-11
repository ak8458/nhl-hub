export default function decorate(block) {
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
}
