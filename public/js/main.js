// Shared client-side helpers for the SMM Panel.
// Page-specific interactive logic (order calculator, AJAX polling, etc.)
// lives inline in each view's own <script> block so it's colocated with
// the markup it operates on.

document.addEventListener('DOMContentLoaded', () => {
  
  // 1. Initialize Bootstrap Tooltips globally (if any exist on the page)
  const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
  if (tooltipTriggerList.length > 0) {
    [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
  }

  // 2. Auto-dismiss alerts after 6 seconds for a cleaner UI.
  // Excludes elements with .alert-important or .alert-permanent
  document.querySelectorAll('.alert:not(.alert-important):not(.alert-permanent)').forEach((alertEl) => {
    setTimeout(() => {
      // Smooth fade and slide up effect
      alertEl.style.transition = 'opacity 0.4s ease, transform 0.4s ease, margin-bottom 0.4s ease, padding 0.4s ease, border 0.4s ease';
      alertEl.style.opacity = '0';
      alertEl.style.transform = 'translateY(-10px)';
      
      // Collapse height to prevent layout shifting jumps
      alertEl.style.marginBottom = `-${alertEl.offsetHeight}px`;
      
      setTimeout(() => alertEl.remove(), 400);
    }, 6000);
  });

  // 3. Mobile sidebar toggle.
  //    Works with .admin-sidebar, .sidebar-overlay, and [data-sidebar-toggle]
  //    (the hamburger button in layout.ejs). Safe no-op if elements don't exist.
  const sidebar  = document.querySelector('.admin-sidebar');
  const overlay  = document.querySelector('.sidebar-overlay');
  const hamburger = document.querySelector('[data-sidebar-toggle]');

  function openSidebar() {
    if (!sidebar) return;
    sidebar.classList.add('open');
    if (overlay) overlay.classList.add('active');
    document.body.style.overflow = 'hidden'; // prevent background scroll
    if (hamburger) hamburger.setAttribute('aria-expanded', 'true');
  }

  function closeSidebar() {
    if (!sidebar) return;
    sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
    document.body.style.overflow = '';
    if (hamburger) hamburger.setAttribute('aria-expanded', 'false');
  }

  if (hamburger) {
    hamburger.addEventListener('click', () => {
      sidebar && sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
    });
  }

  if (overlay) {
    overlay.addEventListener('click', closeSidebar);
  }

  // Close sidebar on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebar && sidebar.classList.contains('open')) {
      closeSidebar();
    }
  });

  // Close sidebar when a nav link is tapped on mobile (to collapse after navigation)
  if (sidebar) {
    sidebar.querySelectorAll('.sidebar-nav-item').forEach((link) => {
      link.addEventListener('click', () => {
        if (window.innerWidth <= 992) closeSidebar();
      });
    });
  }

  // 4. Re-open sidebar state is reset on resize beyond breakpoint
  window.addEventListener('resize', () => {
    if (window.innerWidth > 992) {
      closeSidebar(); // reset body scroll / overlay on desktop resize
    }
  });

});
