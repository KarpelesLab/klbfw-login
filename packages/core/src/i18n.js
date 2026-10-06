// Translation for the core renderer.
//
// Resolution order for a key:
//   1. Unwrap `{ '@token': [name, args] }` message objects sent by the API.
//      Likewise unwrap `[I18N:name]` strings — what the API sends in place of a
//      text it has no translation for.
//   2. Ask the host-provided `translate(name, args)` (e.g. vue-i18n / i18next).
//      If it returns a value different from the key, that wins — this lets a
//      host's existing translations override the core defaults.
//   3. Fall back to the merged default/override string tables (locale → en-US).
//   4. Fall back to the key itself.
//
// Args are interpolated with a simple `{name}` placeholder syntax.

import enUS from './locale/en-US.js';
import jaJP from './locale/ja-JP.js';
import frFR from './locale/fr-FR.js';

const DEFAULTS = {
  'en-US': enUS,
  'ja-JP': jaJP,
  'fr-FR': frFR,
};

const FALLBACK_LOCALE = 'en-US';

// A token the API could not translate itself, e.g. "[I18N:user_grant_approval]".
const I18N_RE = /^\[I18N:([^\]]+)\]$/;

// The bare token name behind a message/label, whichever shape it came in
// (`{ '@token': [name] }`, "[I18N:name]" or the name itself); '' if none.
export function tokenName(value) {
  if (value && typeof value === 'object') {
    return Array.isArray(value['@token']) ? String(value['@token'][0]) : '';
  }
  if (typeof value !== 'string') return '';
  const m = I18N_RE.exec(value);
  return m ? m[1] : value;
}

function interpolate(str, args) {
  if (!args || typeof str !== 'string') return str;
  return str.replace(/\{(\w+)\}/g, (m, k) => (k in args ? String(args[k]) : m));
}

// Merge host `messages` overrides over the built-in defaults, per locale.
function buildTable(messages) {
  const table = {};
  for (const loc of Object.keys(DEFAULTS)) {
    table[loc] = { ...DEFAULTS[loc] };
  }
  if (messages) {
    for (const loc of Object.keys(messages)) {
      table[loc] = { ...(table[loc] || {}), ...messages[loc] };
    }
  }
  return table;
}

export function createTranslator({ locale = FALLBACK_LOCALE, translate, messages } = {}) {
  const table = buildTable(messages);

  const lookup = (name, args) => {
    const localized = table[locale] || {};
    const fallback = table[FALLBACK_LOCALE] || {};
    const raw = name in localized ? localized[name] : fallback[name];
    return raw === undefined ? undefined : interpolate(raw, args);
  };

  return function t(key, args) {
    if (key == null) return '';

    // Unwrap API token objects: { '@token': ['flow_action_login', {..}] }.
    if (typeof key === 'object') {
      if (Array.isArray(key['@token'])) {
        const [name, tokenArgs] = key['@token'];
        return t(name, args || tokenArgs);
      }
      // Unknown object shape — nothing sensible to translate.
      return '';
    }

    const untranslated = I18N_RE.exec(key);
    if (untranslated) return t(untranslated[1], args);

    // Host translator first, so site translations win over core defaults.
    if (typeof translate === 'function') {
      try {
        const out = translate(key, args);
        if (out != null && out !== key) return out;
      } catch {
        /* fall through to defaults */
      }
    }

    const fromTable = lookup(key, args);
    if (fromTable !== undefined) return fromTable;

    return key;
  };
}
