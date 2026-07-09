// OAuth2 provider button. Handles the two shapes the API uses (User:flow's
// `button` object and the Consumer/`Button_Style` object) and picks a readable
// text color from the background brightness when the server doesn't specify one.
// Ported from atonline-console's OAuth2Button.vue.

import { el } from '../dom.js';

function providerToken(provider) {
  if (provider.info && provider.info.Token_Name) return provider.info.Token_Name;
  if (provider.Token_Name) return provider.Token_Name;
  return provider.id ? String(provider.id).toLowerCase() : 'unknown';
}

function buttonStyle(provider) {
  return provider.button || provider.Button_Style || {};
}

function backgroundColor(provider) {
  const b = buttonStyle(provider);
  return b['background-color'] || b.color || '#f5f7fa';
}

function logoUrl(provider) {
  const b = buttonStyle(provider);
  return b.logo || b.icon || null;
}

function isLightColor(hexColor) {
  if (!hexColor || hexColor === 'transparent') return false;
  let hex = hexColor.replace('#', '');
  if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  if (hex.length !== 6) return false;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return r * 0.299 + g * 0.587 + b * 0.114 > 150;
}

function textColor(provider) {
  const b = buttonStyle(provider);
  if (b.textColor) return b.textColor;
  return isLightColor(backgroundColor(provider)) ? '#333' : '#fff';
}

// Resolve the button label: explicit button text, else a localized
// btn_login_with_<token>, else a generic "Sign in with <Name>".
function providerLabel(provider, ctx) {
  const b = buttonStyle(provider);
  if (b.text) return b.text;

  const token = providerToken(provider);
  const key = `btn_login_with_${token}`;
  const translated = ctx.t(key);
  if (translated && translated !== key) return translated;

  const name =
    provider.Name ||
    (provider.info && provider.info.Name) ||
    token.charAt(0).toUpperCase() + token.slice(1);
  return ctx.t('btn_login_with_generic', { provider: name });
}

export const oauth2Spec = {
  match: (field) => field.type === 'oauth2',
  render(field, ctx) {
    const logo = logoUrl(field);
    return el(
      'button',
      {
        type: 'button',
        class: 'klb-login__oauth-button',
        style: { backgroundColor: backgroundColor(field), color: textColor(field) },
        on: { click: () => ctx.controller.oauth(field.id) },
      },
      [
        logo ? el('img', { src: logo, alt: '' }) : null,
        el('span', {}, providerLabel(field, ctx)),
      ],
    );
  },
};
