/* Rasta bottom tab navigation for the ZION intro page.
   Keeps the fixed tab bar above the article layer and updates the active
   tab to match the current hash section. */

(function () {
  const tabs = document.querySelectorAll('.bottom-tabs .bottom-tab');

  function updateActiveTab() {
    const current = (location.hash || '').replace('#', '').trim();

    tabs.forEach(function (tab) {
      const target = tab.getAttribute('data-target') || '';
      const isActive = current && target === current;
      tab.classList.toggle('active', isActive);
    });
  }

  // Initial state
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateActiveTab);
  } else {
    updateActiveTab();
  }

  // Keep tabs in sync when the user switches sections
  window.addEventListener('hashchange', updateActiveTab);

  // Stop body clicks from closing an open article when interacting with tabs
  const bar = document.querySelector('.bottom-tabs');
  if (bar) {
    bar.addEventListener('click', function (event) {
      event.stopPropagation();
    });
  }
})();
