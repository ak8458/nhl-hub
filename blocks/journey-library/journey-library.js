import { trackEvent } from '../../scripts/analytics-events.js';

const SEARCH_TRACKING_DELAY = 1000;

const filterFields = [
  ['level', 'Level'],
  ['readiness', 'Readiness'],
  ['value', 'Value'],
  ['complexity', 'Complexity'],
];

const filterOptionOrder = {
  level: ['League', 'Club'],
  readiness: ['Foundation', 'Priority', 'Pilot', 'Candidate'],
  value: ['High', 'Medium'],
  complexity: ['Medium', 'High', 'Low'],
};

let instanceCount = 0;

function getField(cell, label) {
  const paragraph = [...cell.querySelectorAll('p')].find((item) => {
    const strong = item.querySelector('strong');
    return strong?.textContent.trim().replace(/:$/, '').toLowerCase() === label;
  });
  if (!paragraph) return '';

  const strong = paragraph.querySelector('strong');
  return paragraph.textContent.replace(strong.textContent, '').trim();
}

function getRelatedList(cell) {
  const heading = [...cell.querySelectorAll('h2, h3, h4, h5')].find(
    (item) => item.textContent.trim().toLowerCase().startsWith('related'),
  );
  const list = heading?.nextElementSibling;
  return list?.matches('ul, ol') ? list : null;
}

function getRecord(row) {
  const cells = [...row.children];
  const metadata = cells[0] || document.createElement('div');
  const overview = cells[1] || document.createElement('div');
  const details = cells[2] || document.createElement('div');
  const examples = cells[3] || document.createElement('div');
  const metadataValues = [...metadata.querySelectorAll('p')].map((p) => p.textContent.trim());
  const title = overview.querySelector('h2, h3, h4')?.textContent.trim() || '';
  const summary = [...overview.querySelectorAll('p')]
    .find((paragraph) => !paragraph.querySelector('strong'))?.textContent.trim() || '';

  return {
    id: metadataValues[0] || '',
    level: metadataValues[1] || '',
    source: metadataValues[2] || '',
    readiness: metadataValues[3] || '',
    title,
    summary,
    goal: getField(overview, 'goal'),
    capability: getField(overview, 'capability'),
    stage: getField(overview, 'stage'),
    channel: getField(overview, 'channel'),
    value: getField(overview, 'value'),
    complexity: getField(overview, 'complexity'),
    primaryBusinessGoal: getField(overview, 'primary business goal'),
    primaryActivationChannel: getField(overview, 'primary activation channel'),
    targetAudience: getField(overview, 'target audience'),
    searchableText: [
      metadataValues[0],
      title,
      metadataValues[1],
      metadataValues[3],
      getField(overview, 'goal'),
      getField(overview, 'capability'),
      getField(overview, 'stage'),
      getField(overview, 'channel'),
      summary,
      getField(overview, 'target audience'),
      getField(overview, 'primary business goal'),
      getField(overview, 'primary activation channel'),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase(),
    detailCells: [overview, details, examples],
    relatedTitles: [...(getRelatedList(examples)?.querySelectorAll(':scope > li') || [])]
      .map((item) => item.textContent.trim()),
  };
}

function createTextElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

function createDialog(record, index) {
  const dialog = document.createElement('dialog');
  dialog.className = 'journey-library-dialog';
  dialog.setAttribute('aria-labelledby', `journey-title-${index}`);

  const close = createTextElement('button', 'journey-dialog-close', 'Close');
  close.type = 'button';
  close.setAttribute('aria-label', `Close ${record.title} details`);
  close.addEventListener('click', () => dialog.close());

  const header = document.createElement('header');
  header.className = 'journey-dialog-header';
  header.append(close);
  header.append(createTextElement('p', 'journey-dialog-meta', `${record.id} · ${record.level} · ${record.readiness}`));
  header.append(createTextElement('h2', '', record.title || 'Journey details'));
  header.querySelector('h2').id = `journey-title-${index}`;

  const body = document.createElement('div');
  body.className = 'journey-dialog-body';
  record.detailCells.forEach((cell) => {
    const content = cell.cloneNode(true);
    const relatedList = getRelatedList(content);
    if (relatedList) {
      const relatedButtons = document.createElement('div');
      relatedButtons.className = 'journey-related';
      [...relatedList.children].forEach((item) => {
        relatedButtons.append(createTextElement('span', '', item.textContent.trim()));
      });
      relatedList.replaceWith(relatedButtons);
    }
    body.append(content);
  });

  dialog.append(header, body);
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });

  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      dialog.close();
    }
  });

  return { dialog, body };
}

function addRelatedActions(record, body, records, dialogs) {
  const relatedBlock = [...body.querySelectorAll('.journey-related')].pop();
  if (!relatedBlock) return;

  [...relatedBlock.children].forEach((label) => {
    const related = records.find(
      (item) => item.title.toLowerCase() === label.textContent.trim().toLowerCase(),
    );
    if (!related) return;

    const button = createTextElement('button', '', related.title);
    button.type = 'button';
    button.addEventListener('click', () => {
      dialogs.get(record.title)?.close();
      dialogs.get(related.title)?.showModal();
      trackEvent('journey.relatedClick', {
        label: related.title,
        region: 'journey-library',
        journey: {
          id: related.id, title: related.title, level: related.level, sourceTitle: record.title,
        },
      });
    });
    label.replaceWith(button);
  });
}

function createCard(record, index, dialog) {
  const article = document.createElement('article');
  article.className = 'journey-card';

  const cardHeader = document.createElement('div');
  cardHeader.className = 'journey-card-header';
  cardHeader.append(createTextElement('span', 'journey-id', record.id || 'Journey'));
  cardHeader.append(createTextElement('span', 'journey-readiness', record.readiness));
  if (record.level) {
    cardHeader.append(createTextElement('span', 'journey-level', `${record.level} journey`));
  }
  if (record.source) cardHeader.append(createTextElement('span', 'journey-source', record.source));
  article.append(cardHeader);

  const content = document.createElement('div');
  content.className = 'journey-card-content';
  const tags = document.createElement('div');
  tags.className = 'journey-tags';
  [record.value || record.goal, record.complexity || record.capability]
    .filter(Boolean)
    .forEach((tag) => {
      tags.append(createTextElement('span', '', tag));
    });
  content.append(tags);
  content.append(createTextElement('h2', '', record.title || 'Untitled journey'));
  if (record.summary) content.append(createTextElement('p', 'journey-summary', record.summary));

  if (record.targetAudience) {
    const audience = document.createElement('div');
    audience.className = 'journey-audience';
    audience.append(createTextElement('span', '', 'Target audience'));
    audience.append(createTextElement('p', '', record.targetAudience));
    content.append(audience);
  }

  const footer = document.createElement('div');
  footer.className = 'journey-card-footer';
  const channel = document.createElement('div');
  channel.append(createTextElement('span', '', 'Primary channel'));
  channel.append(createTextElement('strong', '', record.primaryActivationChannel || record.channel));
  footer.append(channel);

  const learnMore = createTextElement('button', 'journey-learn-more', 'Learn more');
  const arrow = createTextElement('span', '', '→');
  arrow.setAttribute('aria-hidden', 'true');
  learnMore.append(' ', arrow);
  learnMore.type = 'button';
  learnMore.setAttribute('aria-haspopup', 'dialog');
  learnMore.addEventListener('click', () => {
    dialog.showModal();
    trackEvent('journey.cardOpen', {
      label: record.title,
      region: 'journey-library',
      position: index + 1,
      journey: {
        id: record.id, title: record.title, level: record.level, readiness: record.readiness,
      },
    });
  });
  footer.append(learnMore);
  content.append(footer);
  article.append(content);

  article.dataset.index = String(index);
  return article;
}

function createFilter(label, key, options, id) {
  const wrapper = document.createElement('label');
  wrapper.className = 'journey-filter';
  wrapper.htmlFor = id;
  wrapper.append(createTextElement('span', '', label));

  const select = document.createElement('select');
  select.id = id;
  select.dataset.filter = key;
  select.append(new Option('All', ''));
  options.forEach((option) => select.append(new Option(option, option)));
  wrapper.append(select);
  return { wrapper, select };
}

export default function decorate(block) {
  const records = [...block.children].map(getRecord).filter((record) => record.title || record.id);
  if (records.length === 0) {
    // eslint-disable-next-line no-console
    console.error('Journey library requires at least one journey row.');
    return;
  }

  instanceCount += 1;
  const blockId = `journey-library-${instanceCount}`;
  const controls = document.createElement('div');
  controls.className = 'journey-library-controls';

  const searchLabel = document.createElement('label');
  searchLabel.className = 'journey-search';
  searchLabel.htmlFor = `${blockId}-search`;
  searchLabel.append(createTextElement('span', '', 'Search journeys'));
  const search = document.createElement('input');
  search.type = 'search';
  search.id = `${blockId}-search`;
  search.placeholder = 'Search journey, audience, goal or channel…';
  searchLabel.append(search);
  controls.append(searchLabel);

  const filters = {};
  const filterGrid = document.createElement('div');
  filterGrid.className = 'journey-filter-grid';
  filterFields.forEach(([key, label]) => {
    const availableOptions = new Set(records.map((record) => record[key]).filter(Boolean));
    const preferredOptions = filterOptionOrder[key];
    const options = [
      ...preferredOptions.filter((option) => availableOptions.has(option)),
      ...[...availableOptions].filter((option) => !preferredOptions.includes(option)).sort(),
    ];
    const filter = createFilter(label, key, options, `${blockId}-${key}`);
    filters[key] = filter.select;
    filterGrid.append(filter.wrapper);
  });
  controls.append(filterGrid);

  const controlFooter = document.createElement('div');
  controlFooter.className = 'journey-control-footer';
  const resultCount = createTextElement('p', 'journey-result-count', '');
  resultCount.setAttribute('role', 'status');
  resultCount.setAttribute('aria-live', 'polite');
  const clear = createTextElement('button', 'journey-clear', 'Clear filters');
  clear.type = 'button';
  controlFooter.append(resultCount, clear);
  controls.append(controlFooter);

  const cards = document.createElement('div');
  cards.className = 'journey-card-grid';
  const dialogs = new Map();
  records.forEach((record, index) => {
    const { dialog, body } = createDialog(record, index);
    cards.append(createCard(record, index, dialog));
    block.append(dialog);
    dialogs.set(record.title, dialog);
    addRelatedActions(record, body, records, dialogs);
  });

  const empty = document.createElement('div');
  empty.className = 'journey-empty';
  empty.hidden = true;
  empty.append(createTextElement('h2', '', 'No journeys match those filters.'));
  empty.append(createTextElement('p', '', 'Clear the filters to return to the complete journey library.'));

  const updateResults = () => {
    const query = search.value.trim().toLowerCase();
    let visibleCount = 0;

    records.forEach((record, index) => {
      const matchesFilters = filterFields.every(([key]) => (
        !filters[key].value || record[key] === filters[key].value
      ));
      const matchesQuery = !query || record.searchableText.includes(query);
      const visible = matchesFilters && matchesQuery;
      cards.children[index].hidden = !visible;
      if (visible) visibleCount += 1;
    });

    resultCount.textContent = `${visibleCount} ${visibleCount === 1 ? 'journey' : 'journeys'}`;
    empty.hidden = visibleCount > 0;
    return visibleCount;
  };

  let searchTimer;
  let lastTrackedQuery = '';
  const trackSearch = () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      const query = search.value.trim().toLowerCase();
      if (query.length < 3 || query === lastTrackedQuery) return;
      lastTrackedQuery = query;
      const resultsCount = updateResults();
      trackEvent('journey.search', {
        label: query,
        region: 'journey-library',
        journey: { searchTerm: query, resultsCount, zeroResults: resultsCount === 0 },
      });
    }, SEARCH_TRACKING_DELAY);
  };

  search.addEventListener('input', () => {
    updateResults();
    trackSearch();
  });
  Object.values(filters).forEach((filter) => filter.addEventListener('change', () => {
    const resultsCount = updateResults();
    trackEvent('journey.filter', {
      label: `${filter.dataset.filter}:${filter.value || 'all'}`,
      region: 'journey-library',
      journey: { filterKey: filter.dataset.filter, filterValue: filter.value || 'all', resultsCount },
    });
  }));
  clear.addEventListener('click', () => {
    search.value = '';
    lastTrackedQuery = '';
    window.clearTimeout(searchTimer);
    Object.values(filters).forEach((filter) => {
      filter.value = '';
    });
    const resultsCount = updateResults();
    search.focus();
    trackEvent('journey.clear', {
      label: 'clear filters',
      region: 'journey-library',
      journey: { resultsCount },
    });
  });
  updateResults();

  block.replaceChildren(controls, cards, empty, ...[...dialogs.values()]);
}
