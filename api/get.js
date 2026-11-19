// QR code store redirect, served at /get (see the rewrite in vercel.json).
// iPhone/iPad/iPod -> App Store, Android -> Google Play, everything else -> home page.
// Optional ?src=<campaign> (lowercase letters, digits, hyphens, max 40) is passed to
// the stores for attribution; anything else is ignored.

// Apple provider token (App Store Connect > App Analytics > Campaigns).
// Leave empty to send iOS users to the App Store without campaign parameters.
const APPLE_PROVIDER_TOKEN = '';

const APP_STORE_URL = 'https://apps.apple.com/app/apple-store/id6793560717?mt=8';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.cosible.menular';
const HOME_URL = '/';

const SRC_PATTERN = /^[a-z0-9-]{1,40}$/;

module.exports = (req, res) => {
  const ua = req.headers['user-agent'] || '';
  const rawSrc = new URL(req.url, 'http://localhost').searchParams.get('src');
  const src = rawSrc && SRC_PATTERN.test(rawSrc) ? rawSrc : null;

  let location = HOME_URL;
  if (/iPhone|iPad|iPod/.test(ua)) {
    location = APP_STORE_URL;
    if (APPLE_PROVIDER_TOKEN && src) {
      location += `&pt=${encodeURIComponent(APPLE_PROVIDER_TOKEN)}&ct=${src}`;
    }
  } else if (/Android/i.test(ua)) {
    location = PLAY_STORE_URL;
    if (src) {
      location += `&referrer=utm_source%3D${src}%26utm_medium%3Dqr`;
    }
  }

  res.statusCode = 302;
  res.setHeader('Location', location);
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Vary', 'User-Agent');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.end();
};
