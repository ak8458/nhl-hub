import { toClassName } from '../../scripts/aem.js';

function decorateSideNavigation(block) {
  if (block.querySelector(':scope > nav')) return;
  const main = block.closest('main');
  const relatedLinks = [...block.querySelectorAll('a[href]')]
    .filter((link) => !link.getAttribute('href').startsWith('#'));
  const nav = document.createElement('nav');
  nav.setAttribute('aria-label', 'On this page');
  const title = document.createElement('p');
  title.className = 'side-navigation-title';
  title.textContent = 'Jump to section';
  const list = document.createElement('ul');
  nav.append(title, list);

  if (relatedLinks.length) {
    const related = document.createElement('ul');
    related.className = 'side-navigation-related';
    related.setAttribute('aria-label', 'Related capabilities');
    relatedLinks.forEach((link) => {
      const item = document.createElement('li');
      item.append(link);
      related.append(item);
    });
    nav.append(related);
  }
  block.replaceChildren(nav);

  let groups = [];
  let active;
  let scheduled = false;

  const expandGroups = () => {
    groups.forEach((group) => {
      const expanded = group.headings.includes(active)
        || group.item.contains(document.activeElement);
      group.item.classList.toggle('expanded', expanded);
      group.sublist.hidden = !expanded;
    });
  };

  const update = () => {
    scheduled = false;
    const headings = groups.flatMap((group) => group.headings);
    const offset = parseFloat(getComputedStyle(main).getPropertyValue('--side-navigation-offset')) || 74;
    [active] = headings;
    headings.forEach((heading) => {
      if (heading.getBoundingClientRect().top <= offset + 2) active = heading;
    });
    if (window.scrollY > 0
      && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) {
      active = headings[headings.length - 1];
    }
    list.querySelectorAll('a').forEach((link) => {
      if (active && link.getAttribute('href') === `#${encodeURIComponent(active.id)}`) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    expandGroups();
  };

  const scheduleUpdate = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(update);
  };

  const render = () => {
    const candidates = [...main.querySelectorAll('h2, h3')].filter((heading) => (
      heading.textContent.trim() && !heading.closest('.hero, .cards, .anchor-nav, [hidden]')
    ));
    const firstSection = candidates.findIndex((heading) => heading.tagName === 'H2');
    const headings = firstSection < 0 ? [] : candidates.slice(firstSection);
    const usedIds = new Set([...document.querySelectorAll('[id]')]
      .filter((element) => !headings.includes(element)).map((element) => element.id));
    groups = [];
    list.replaceChildren();

    headings.forEach((heading) => {
      const base = heading.id || toClassName(heading.textContent.trim()) || 'section';
      let id = base;
      let suffix = 2;
      while (usedIds.has(id)) {
        id = `${base}-${suffix}`;
        suffix += 1;
      }
      usedIds.add(id);
      heading.id = id;
      if (!heading.hasAttribute('tabindex')) heading.tabIndex = -1;

      const link = document.createElement('a');
      link.href = `#${encodeURIComponent(id)}`;
      link.textContent = heading.textContent.trim();
      const item = document.createElement('li');
      item.append(link);
      if (heading.tagName === 'H2') {
        const sublist = document.createElement('ul');
        item.append(sublist);
        groups.push({ item, sublist, headings: [heading] });
        list.append(item);
      } else {
        const group = groups[groups.length - 1];
        group.headings.push(heading);
        group.sublist.append(item);
      }
    });

    const section = block.closest('.side-navigation-section');
    if (section) {
      main.classList.toggle('has-side-navigation', groups.length > 0);
    }
    block.hidden = !groups.length && !relatedLinks.length;
    title.hidden = !groups.length;
    update();
  };

  render();
  main.addEventListener('sections-loaded', render);
  window.addEventListener('scroll', scheduleUpdate, { passive: true });
  window.addEventListener('resize', scheduleUpdate);
  window.addEventListener('hashchange', scheduleUpdate);
  nav.addEventListener('focusin', expandGroups);
  nav.addEventListener('focusout', () => requestAnimationFrame(expandGroups));
}

export default function decorate(block) {
  if (block.classList.contains('side-navigation')) {
    decorateSideNavigation(block);
    return;
  }
  const links = [...block.querySelectorAll('a[href]')];
  if (links.length === 0) {
    throw new Error('Anchor navigation requires at least one link.');
  }

  const related = block.classList.contains('related');
  links.forEach((link) => {
    if (!related && !link.getAttribute('href').startsWith('#')) {
      throw new Error('Anchor navigation links must target a page section.');
    }
  });

  const nav = document.createElement('nav');
  nav.className = 'section-anchor-nav';
  nav.setAttribute('aria-label', related ? 'Related capabilities' : 'On this page');
  nav.append(...links);
  block.replaceChildren(nav);
}
