import {
  loadHeader,
  loadFooter,
  decorateIcons,
  decorateSections,
  decorateBlocks,
  decorateTemplateAndTheme,
  getMetadata,
  waitForFirstImage,
  loadSection,
  loadSections,
  loadCSS,
  buildBlock,
} from './aem.js';

const HEADER_LOAD_TIMEOUT = 3000;

if (window.trustedTypes && window.trustedTypes.createPolicy) {
  const innerTT = window.trustedTypes.createPolicy('tt-inner', {
    createHTML: (s) => s, // avoid stack overflow
  });

  window.trustedTypes.createPolicy('default', {
    createHTML: (input, type, sink) => {
      let processedInput = input;
      if (/srcdoc\s*=/i.test(processedInput)) {
        const doc = new DOMParser().parseFromString(innerTT.createHTML(processedInput), 'text/html');
        doc.querySelectorAll('iframe[srcdoc]').forEach((el) => el.removeAttribute('srcdoc'));
        processedInput = doc.body.innerHTML;
      }
      if (sink.includes('createContextualFragment') || sink.includes('Document write')) {
        const doc = new DOMParser().parseFromString(innerTT.createHTML(processedInput), 'text/html');
        doc.querySelectorAll('script').forEach((el) => el.remove());
        processedInput = doc.body.innerHTML;
      }
      return processedInput;
    },
    createScriptURL: (input) => input,
    createScript: (input) => input,
  });
}

/**
 * load fonts.css and set a session storage flag
 */
async function loadFonts() {
  await loadCSS(`${window.hlx.codeBasePath}/styles/fonts.css`);
  try {
    if (!window.location.hostname.includes('localhost')) sessionStorage.setItem('fonts-loaded', 'true');
  } catch (e) {
    // do nothing
  }
}

/**
 * Turns `/widgets/...` links into widget blocks.
 * @param {Element} main The container element
 */
function buildWidgetAutoBlocks(main) {
  const widgetLinks = [...main.querySelectorAll('a[href*="/widgets/"]')];
  widgetLinks.forEach((link) => {
    if (link.closest('.widget')) return;
    const newLink = link.cloneNode(true);
    const widgetBlock = buildBlock('widget', { elems: [newLink] });
    const p = link.closest('p');
    if (
      p
      && p.querySelectorAll('a').length === 1
      && p.querySelector('a') === link
      && p.textContent.trim() === link.textContent.trim()
    ) {
      p.replaceWith(widgetBlock);
    } else {
      link.replaceWith(widgetBlock);
    }
  });
}

function buildSideNavigation(main) {
  if (getMetadata('side-navigation').trim().toLowerCase() !== 'on') return;
  if (main.querySelector('.anchor-nav.side-navigation')) return;

  const heading = [...main.querySelectorAll('h2')]
    .find((element) => element.textContent.trim() && !element.closest('.hero, .cards'));
  const authored = main.querySelector('.anchor-nav');
  if (!heading && !authored) return;

  const block = authored || buildBlock('anchor-nav', '');
  block.classList.add('side-navigation');
  if (!heading) return;

  const section = document.createElement('div');
  section.className = 'side-navigation-section';
  const contentSection = [...main.children].find((child) => child.contains(heading));
  const oldSection = authored?.parentElement;
  section.append(block);
  if (oldSection && !oldSection.textContent.trim() && !oldSection.children.length) {
    oldSection.remove();
  }
  contentSection.before(section);
  main.classList.add('has-side-navigation');
  const sections = [...main.children];
  const index = sections.indexOf(section);
  sections.forEach((child, position) => {
    child.classList.toggle('side-navigation-intro', position < index);
    child.classList.toggle('side-navigation-content', position > index);
  });
  main.style.setProperty('--side-navigation-start', index + 1);
  main.style.setProperty('--side-navigation-rows', Math.max(1, sections.length - index - 1));
}

/**
 * Builds all synthetic blocks in a container element.
 * @param {Element} main The container element
 */
function buildAutoBlocks(main) {
  try {
    // auto load `*/fragments/*` references
    const fragments = [...main.querySelectorAll('a[href*="/fragments/"]')].filter((f) => !f.closest('.fragment'));
    if (fragments.length > 0) {
      // eslint-disable-next-line import/no-cycle
      import('../blocks/fragment/fragment.js').then(({ loadFragment }) => {
        fragments.forEach(async (fragment) => {
          try {
            const { pathname } = new URL(fragment.href);
            const frag = await loadFragment(pathname);
            fragment.parentElement.replaceWith(...frag.children);
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Fragment loading failed', error);
          }
        });
      });
    }
    buildWidgetAutoBlocks(main);
    buildSideNavigation(main);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auto Blocking failed', error);
  }
}

/**
 * Decorates formatted links to style them as buttons.
 * @param {HTMLElement} main The main container element
 */
function decorateButtons(main) {
  main.querySelectorAll('p a[href]').forEach((a) => {
    a.title = a.title || a.textContent;
    const p = a.closest('p');
    const text = a.textContent.trim();

    // quick structural checks
    if (a.querySelector('img') || p.textContent.trim() !== text) return;

    // skip URL display links
    try {
      if (new URL(a.href).href === new URL(text, window.location).href) return;
    } catch { /* continue */ }

    // require authored formatting for buttonization
    const strong = a.closest('strong');
    const em = a.closest('em');
    if (!strong && !em) return;

    p.className = 'button-wrapper';
    a.className = 'button';
    if (strong && em) { // high-impact call-to-action
      a.classList.add('accent');
      const outer = strong.contains(em) ? strong : em;
      outer.replaceWith(a);
    } else if (strong) {
      a.classList.add('primary');
      strong.replaceWith(a);
    } else {
      a.classList.add('secondary');
      em.replaceWith(a);
    }
  });
}

/**
 * Decorates the main element.
 * @param {Element} main The main element
 */
// eslint-disable-next-line import/prefer-default-export
export function decorateMain(main) {
  decorateIcons(main);
  buildAutoBlocks(main);
  decorateSections(main);
  decorateBlocks(main);
  decorateButtons(main);
}

/**
 * Loads everything needed to get to LCP.
 * @param {Element} doc The container element
 */
async function loadEager(doc) {
  document.documentElement.lang = 'en';
  decorateTemplateAndTheme();
  const main = doc.querySelector('main');
  if (main) {
    const header = doc.querySelector('body > header');
    let headerReady = Promise.resolve();
    if (header) {
      if (window.location.pathname === '/' || getMetadata('header').trim().toLowerCase() === 'off') {
        header.remove();
      } else {
        doc.body.classList.add('header-loading');
        let timeoutId;
        const timeout = new Promise((resolve) => {
          timeoutId = window.setTimeout(() => {
            // eslint-disable-next-line no-console
            console.warn('Header is taking too long to load; showing page content.');
            resolve();
          }, HEADER_LOAD_TIMEOUT);
        });
        headerReady = Promise.race([loadHeader(header), timeout]).finally(() => {
          window.clearTimeout(timeoutId);
          doc.body.classList.remove('header-loading');
        });
      }
    }

    decorateMain(main);
    document.body.classList.add('appear');
    await Promise.all([
      loadSection(main.querySelector('.section'), waitForFirstImage),
      headerReady,
    ]);
  }

  try {
    /* if desktop (proxy for fast connection) or fonts already loaded, load fonts.css */
    if (window.innerWidth >= 900 || sessionStorage.getItem('fonts-loaded')) {
      loadFonts();
    }
  } catch (e) {
    // do nothing
  }
}

/**
 * Loads everything that doesn't need to be delayed.
 * @param {Element} doc The container element
 */
async function loadLazy(doc) {
  const main = doc.querySelector('main');
  await loadSections(main);
  main.dispatchEvent(new Event('sections-loaded'));

  const { hash } = window.location;
  let element = hash ? doc.getElementById(hash.substring(1)) : null;
  if (hash && !element && main.classList.contains('has-side-navigation')) {
    try {
      element = doc.getElementById(decodeURIComponent(hash.substring(1)));
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('Unable to decode the section link.', error);
    }
  }
  if (hash && element) element.scrollIntoView();

  loadFooter(doc.querySelector('body > footer'));

  loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);
  loadFonts();
}

/**
 * Loads everything that happens a lot later,
 * without impacting the user experience.
 */
function loadDelayed() {
  import('./consent-check.js');
  // load anything that can be postponed to the latest here
}

async function loadPage() {
  await loadEager(document);
  await loadLazy(document);
  loadDelayed();
}

loadPage();
