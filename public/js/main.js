// Shared client-side helpers for the SMM Panel.
// Page-specific interactive logic (order calculator, AJAX polling, etc.)
// lives inline in each view's own <script> block so it's colocated with
// the markup it operates on.

document.addEventListener('DOMContentLoaded', () => {
  // Auto-dismiss alerts after 6 seconds for a cleaner UI.
  document.querySelectorAll('.alert:not(.alert-important)').forEach((alertEl) => {
    setTimeout(() => {
      alertEl.style.transition = 'opacity 0.5s ease';
      alertEl.style.opacity = '0';
      setTimeout(() => alertEl.remove(), 500);
    }, 6000);
  });
});
