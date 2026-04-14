export function initSidebarSearch(): void {
  const searchInput = document.getElementById('sb-search') as HTMLInputElement | null;
  if (!searchInput) return;

  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim().toLowerCase();
    const items = document.querySelectorAll<HTMLElement>('.palette-item');
    const titles = document.querySelectorAll<HTMLElement>('.sb-title[data-group]');

    items.forEach(item => {
      const name = item.querySelector('.p-name')?.textContent?.toLowerCase() ?? '';
      const desc = item.querySelector('.p-desc')?.textContent?.toLowerCase() ?? '';
      const matches = !query || name.includes(query) || desc.includes(query);
      item.classList.toggle('hidden', !matches);
    });

    // Hide section titles when all items in their section are hidden
    titles.forEach(title => {
      const group = title.dataset['group'];
      if (!group) return;
      const sectionItems = document.querySelectorAll<HTMLElement>(`.palette-item[data-group="${group}"]`);
      const anyVisible = Array.from(sectionItems).some(el => !el.classList.contains('hidden'));
      title.style.display = anyVisible ? '' : 'none';
    });
  });
}
