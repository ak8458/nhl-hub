export default function decorate(block) {
  const links = [...block.querySelectorAll('a[href]')];
  if (links.length === 0) {
    throw new Error('Anchor navigation requires at least one link.');
  }

  links.forEach((link) => {
    if (!link.getAttribute('href').startsWith('#')) {
      throw new Error('Anchor navigation links must target a page section.');
    }
  });

  const nav = document.createElement('nav');
  nav.className = 'section-anchor-nav';
  nav.setAttribute('aria-label', 'On this page');
  nav.append(...links);
  block.replaceChildren(nav);
}
