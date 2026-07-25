/**
 * Must be used AFTER the `protect` middleware (req.user must already be set).
 * Ensures only role === 'admin' can proceed. Normal users are blocked with a 403
 * and never reach any /admin/* controller logic.
 */
function adminOnly(req, res, next) {
  if (!req.user) {
    return res.redirect('/login');
  }

  if (req.user.role !== 'admin') {
    return res.status(403).render('error', {
      title: 'Access Denied',
      message: 'You do not have permission to access the admin panel.',
      user: req.user,
    });
  }

  next();
}

module.exports = adminOnly;
