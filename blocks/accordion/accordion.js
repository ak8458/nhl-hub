import { trackEvent } from '../../scripts/analytics-events.js';

let accordionCount = 0;

export default function decorate(block) {
  const rows = [...block.children];
  if (rows.length === 0) {
    throw new Error('Accordion blocks require at least one question-and-answer row.');
  }

  accordionCount += 1;
  const accordionId = `accordion-${accordionCount}`;
  const items = rows.map((row, index) => {
    const cells = [...row.children];
    if (cells.length !== 2) {
      throw new Error(`Accordion row ${index + 1} must contain a question and an answer.`);
    }

    const question = cells[0].textContent.trim();
    if (!question) {
      throw new Error(`Accordion row ${index + 1} is missing its question.`);
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'accordion-trigger';
    button.id = `${accordionId}-question-${index + 1}`;
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', `${accordionId}-answer-${index + 1}`);
    button.textContent = question;

    const icon = document.createElement('span');
    icon.className = 'accordion-icon';
    icon.setAttribute('aria-hidden', 'true');
    button.append(icon);

    const answer = document.createElement('div');
    answer.className = 'accordion-answer';
    answer.id = `${accordionId}-answer-${index + 1}`;
    answer.setAttribute('role', 'region');
    answer.setAttribute('aria-labelledby', button.id);
    answer.hidden = true;
    answer.append(...cells[1].childNodes);

    const item = document.createElement('div');
    item.className = 'accordion-item';
    item.append(button, answer);

    return { button, answer, item };
  });

  items.forEach(({ button, answer }, index) => {
    button.addEventListener('click', () => {
      const isExpanded = button.getAttribute('aria-expanded') === 'true';
      items.forEach((item) => {
        item.button.setAttribute('aria-expanded', 'false');
        item.answer.hidden = true;
      });
      if (!isExpanded) {
        button.setAttribute('aria-expanded', 'true');
        answer.hidden = false;
      }
      trackEvent('accordion.toggle', {
        label: button.textContent.trim(),
        region: 'accordion',
        state: isExpanded ? 'collapsed' : 'expanded',
        position: index + 1,
      });
    });
  });

  block.replaceChildren(...items.map(({ item }) => item));
}
