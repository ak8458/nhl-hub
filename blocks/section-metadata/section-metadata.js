export default function decorate(block) {
  const section = block.closest('.section');
  if (!section) {
    throw new Error('Section metadata must be placed inside a page section.');
  }

  const rows = [...block.children];
  if (rows.length === 0) {
    throw new Error('Section metadata requires at least one setting.');
  }

  rows.forEach((row, index) => {
    const cells = [...row.children];
    if (cells.length !== 2) {
      throw new Error(`Section metadata row ${index + 1} must contain a name and a value.`);
    }

    const name = cells[0].textContent.trim().toLowerCase();
    const value = cells[1].textContent.trim();
    if (name === 'anchor') {
      if (!value) {
        throw new Error(`Section metadata row ${index + 1} is missing its anchor value.`);
      }
      const existing = document.getElementById(value);
      if (existing && existing !== section) {
        throw new Error(`Section anchor "${value}" is already in use.`);
      }
      section.id = value;
    } else if (name === 'style') {
      const classes = value.split(/\s+/).filter(Boolean);
      if (classes.length === 0) {
        throw new Error(`Section metadata row ${index + 1} is missing its style value.`);
      }
      section.classList.add(...classes);
    } else {
      throw new Error(`Unsupported section metadata setting "${name}".`);
    }
  });

  block.remove();
}
