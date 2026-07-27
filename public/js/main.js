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

});
