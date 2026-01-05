const LeoProfanity = require('leo-profanity');

class ModerationError extends Error {
  constructor(message, { status = 400, code = 'CONTENT_REJECTED' } = {}) {
    super(message);
    this.name = 'ModerationError';
    this.status = status;
    this.code = code;
  }
}

function envFlag(name, defaultValue = false) {
  const raw = process.env[name];
  if (raw === undefined) return defaultValue;
  const v = String(raw).trim().toLowerCase();
  if (v === '1' || v === 'true' || v === 'yes' || v === 'on') return true;
  if (v === '0' || v === 'false' || v === 'no' || v === 'off') return false;
  return defaultValue;
}

function getRequiredEnv(name) {
  const v = process.env[name];
  if (!v) {
    throw new ModerationError(`Moderation misconfigured: ${name} is required`, {
      status: 503,
      code: 'MODERATION_NOT_CONFIGURED',
    });
  }
  return v;
}

function normalizeForTextCheck(input) {
  if (input == null) return '';
  const s = String(input);
  // Basic leetspeak / symbol normalization to catch common obfuscations.
  const map = {
    '@': 'a',
    '$': 's',
    '€': 'e',
    '£': 'l',
    '¥': 'y',
    '!': 'i',
    '|': 'i',
    '0': 'o',
    '1': 'i',
    '3': 'e',
    '4': 'a',
    '5': 's',
    '7': 't',
    '+': 't',
  };

  // Replace mapped chars, lower-case, and collapse punctuation into spaces.
  const lowered = s.toLowerCase();
  const replaced = lowered
    .split('')
    .map((ch) => (map[ch] ? map[ch] : ch))
    .join('');

  // Replace separators with spaces so "f.u.c.k" becomes tokens.
  return replaced.replace(/[._\-/,\\]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function createTextModerator() {
  // Default dictionary ships with the package install; do not attempt to "fallback"
  // to other sources if missing.
  return LeoProfanity;
}

const profanity = createTextModerator();

function isProfaneText(value) {
  if (value == null) return false;
  const s = String(value).trim();
  if (!s) return false;
  if (profanity.check(s)) return true;
  const normalized = normalizeForTextCheck(s);
  if (normalized && normalized !== s && profanity.check(normalized)) return true;
  return false;
}

function assertNoProfanityText(fields, { context = 'text' } = {}) {
  const entries = Object.entries(fields || {});
  for (const [key, value] of entries) {
    if (value == null) continue;
    if (typeof value !== 'string') continue;
    if (isProfaneText(value)) {
      throw new ModerationError(`Profanity is not allowed in ${context}`, {
        status: 400,
        code: 'PROFANITY_TEXT',
      });
    }
  }
}

function parseDataUrlImage(dataUrl) {
  if (typeof dataUrl !== 'string') return null;
  if (!dataUrl.startsWith('data:image/')) return null;
  const comma = dataUrl.indexOf(',');
  if (comma === -1) return null;
  const meta = dataUrl.slice(0, comma);
  const base64 = dataUrl.slice(comma + 1);
  if (!/;base64$/i.test(meta)) return null;
  if (!base64) return null;
  return { dataUrl, base64Length: base64.length };
}

async function openAiModerate({ inputText, inputImageUrl }) {
  const apiKey = getRequiredEnv('OPENAI_API_KEY');
  const model = process.env.OPENAI_MODERATION_MODEL || 'omni-moderation-latest';
  if (typeof fetch !== 'function') {
    throw new ModerationError('Moderation provider unavailable in this runtime (missing fetch)', {
      status: 503,
      code: 'MODERATION_PROVIDER_UNAVAILABLE',
    });
  }

  const controller = new AbortController();
  const timeoutMs = Number(process.env.OPENAI_MODERATION_TIMEOUT_MS || 8000);
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const input = [];
    if (inputText) {
      input.push({ type: 'input_text', text: String(inputText) });
    }
    if (inputImageUrl) {
      input.push({ type: 'input_image', image_url: String(inputImageUrl) });
    }

    const res = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, input }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text();
      throw new ModerationError(`Moderation provider error: ${res.status}`, {
        status: 503,
        code: 'MODERATION_PROVIDER_ERROR',
      });
    }

    const json = await res.json();
    const result = json?.results?.[0];
    const flagged = Boolean(result?.flagged);
    return { flagged, raw: result };
  } catch (err) {
    if (err instanceof ModerationError) throw err;
    if (err?.name === 'AbortError') {
      throw new ModerationError('Moderation provider timeout', {
        status: 503,
        code: 'MODERATION_PROVIDER_TIMEOUT',
      });
    }
    throw new ModerationError('Moderation provider unavailable', {
      status: 503,
      code: 'MODERATION_PROVIDER_UNAVAILABLE',
    });
  } finally {
    clearTimeout(t);
  }
}

async function assertAllowedImage(imageUrl, { context = 'image' } = {}) {
  if (imageUrl == null) return;
  if (typeof imageUrl !== 'string') return;
  const s = imageUrl.trim();
  if (!s) return;

  // Fail-closed: if images are being set, moderation MUST be configured.
  const provider = (process.env.IMAGE_MODERATION_PROVIDER || 'openai').trim().toLowerCase();
  if (provider !== 'openai') {
    throw new ModerationError(`Moderation misconfigured: unsupported IMAGE_MODERATION_PROVIDER "${provider}"`, {
      status: 503,
      code: 'MODERATION_NOT_CONFIGURED',
    });
  }

  // Accept either http(s) URLs or data URLs.
  const isHttp = /^https?:\/\//i.test(s);
  const isData = Boolean(parseDataUrlImage(s));
  if (!isHttp && !isData) {
    throw new ModerationError(`Invalid ${context} value`, { status: 400, code: 'INVALID_IMAGE_URL' });
  }

  const { flagged } = await openAiModerate({ inputImageUrl: s });
  if (flagged) {
    throw new ModerationError(`Uploaded ${context} was rejected by moderation`, {
      status: 400,
      code: 'PROFANITY_IMAGE',
    });
  }
}

function moderateText(fields, opts) {
  const enabled = envFlag('TEXT_MODERATION_ENABLED', true);
  if (!enabled) return;
  assertNoProfanityText(fields, opts);
}

async function moderateImage(imageUrl, opts) {
  const enabled = envFlag('IMAGE_MODERATION_ENABLED', true);
  if (!enabled) {
    // If image moderation is disabled, we do not allow setting images.
    // This prevents unsafe images from slipping through when moderation is not configured.
    if (typeof imageUrl === 'string' && imageUrl.trim()) {
      throw new ModerationError('Image moderation is disabled; images cannot be set', {
        status: 503,
        code: 'MODERATION_NOT_CONFIGURED',
      });
    }
    return;
  }
  await assertAllowedImage(imageUrl, opts);
}

function moderationErrorHandler(err, req, res, next) {
  if (err && (err.name === 'ModerationError' || err instanceof ModerationError)) {
    return res.status(err.status || 400).json({
      error: err.message || 'Content rejected',
      code: err.code || 'CONTENT_REJECTED',
    });
  }
  return next(err);
}

module.exports = {
  ModerationError,
  moderateText,
  moderateImage,
  moderationErrorHandler,
};

