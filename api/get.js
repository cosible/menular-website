// QR code store redirect, served at /get and /download (see the rewrites in vercel.json).
// iPhone/iPad/iPod -> App Store, Android -> Google Play, everything else -> home page.
// Optional ?src=<campaign> (lowercase letters, digits, hyphens, max 40) is passed to
// the stores for attribution; anything else is ignored.
// Each click is logged to Supabase (src, platform, country) before redirecting.
// Logging is best effort: capped at 1 second and skipped on any failure.

// Apple provider token (App Store Connect > App Analytics > Campaigns).
// Leave empty to send iOS users to the App Store without campaign parameters.
const APPLE_PROVIDER_TOKEN = '110413832';

const APP_STORE_URL = 'https://apps.apple.com/app/apple-store/id6793560717?mt=8';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.cosible.menular';
const HOME_URL = '/';

const SRC_PATTERN = /^[a-z0-9-]{1,40}$/;
const COUNTRY_PATTERN = /^[A-Z]{2}$/;

// Link-preview bots and crawlers: redirected, but not logged.
const BOT_PATTERN =
  /facebookexternalhit|Facebot|Twitterbot|WhatsApp|TelegramBot|Slackbot|Discordbot|LinkedInBot|bot|crawler|spider|preview/i;

const LOG_TIMEOUT_MS = 1000;

async function logClick(src, platform, country) {
  const baseUrl = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!baseUrl || !key) return;

  try {
    await fetch(`${baseUrl.replace(/\/+$/, '')}/rest/v1/rpc/log_referral_event`, {
      method: 'POST',
      headers: {
        apikey: key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_source: src,
        p_event: 'link_click',
        p_platform: platform,
        p_country: country,
      }),
      signal: AbortSignal.timeout(LOG_TIMEOUT_MS),
    });
  } catch (_) {
    // Timeout, network or config error: skip silently, the redirect still happens.
  }
}

module.exports = async (req, res) => {
  const ua = req.headers['user-agent'] || '';
  const rawSrc = new URL(req.url, 'http://localhost').searchParams.get('src');
  const src = rawSrc && SRC_PATTERN.test(rawSrc) ? rawSrc : null;

  let platform = 'other';
  let location = HOME_URL;
  if (/iPhone|iPad|iPod/.test(ua)) {
    platform = 'ios';
    location = APP_STORE_URL;
    if (APPLE_PROVIDER_TOKEN && src) {
      location += `&pt=${encodeURIComponent(APPLE_PROVIDER_TOKEN)}&ct=${src}`;
    }
  } else if (/Android/i.test(ua)) {
    platform = 'android';
    location = PLAY_STORE_URL;
    if (src) {
      location += `&referrer=utm_source%3D${src}%26utm_medium%3Dqr`;
    }
  }

  if (req.method !== 'HEAD' && !BOT_PATTERN.test(ua)) {
    const rawCountry = req.headers['x-vercel-ip-country'];
    const country = rawCountry && COUNTRY_PATTERN.test(rawCountry) ? rawCountry : null;
    await logClick(src, platform, country);
  }

  res.statusCode = 302;
  res.setHeader('Location', location);
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Vary', 'User-Agent');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.end();
};
