// Simple static/informational pages. These contain no pricing, order, provider,
// or auth logic — they only render content and (for Refer & Earn) build a
// shareable link from the already-logged-in user's own id.

exports.getReferEarn = (req, res) => {
  const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  res.render('refer-earn', {
    title: 'Refer & Earn',
    referralLink: `${appUrl}/signup?ref=${req.user._id}`,
  });
};

exports.getReviews = (req, res) => {
  res.render('reviews', { title: 'Client Reviews' });
};

exports.getTerms = (req, res) => {
  res.render('terms', { title: 'Terms & Policy' });
};
