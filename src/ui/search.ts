export function initSidebarSearch(): void {
  const input = document.getElementById('sidebar-search') as HTMLInputElement | null;
  if (!input) return;
  input.addEventListener('input', () => {
    const q = input.value.toLowerCase();
    document.querySelectorAll<HTMLElement>('.palette-item').forEach(el => {
      const text = el.textContent?.toLowerCase() ?? '';
      el.style.display = text.includes(q) ? '' : 'none';
    });
  });
}
