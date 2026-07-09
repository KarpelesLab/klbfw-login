// Default styling for the core renderer, shipped as an injected <style> so the
// CDN surface stays a single file. Everything is namespaced under `.klb-login`
// and driven by `--klb-login-*` custom properties, so hosts can restyle without
// overriding rules — set the variables (via the `theme` mount option or their
// own CSS) and the widget follows.

const STYLE_ID = 'klb-login-core-styles';

export const CSS = `
.klb-login {
  --klb-login-font: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  --klb-login-accent: #4caf50;
  --klb-login-accent-hover: #43a047;
  --klb-login-accent-contrast: #ffffff;
  --klb-login-bg: #ffffff;
  --klb-login-fg: #222222;
  --klb-login-muted: #666666;
  --klb-login-border: #d9d9d9;
  --klb-login-input-bg: #ffffff;
  --klb-login-error-bg: #f8d7da;
  --klb-login-error-fg: #721c24;
  --klb-login-radius: 8px;
  --klb-login-field-radius: 6px;
  --klb-login-width: 400px;

  box-sizing: border-box;
  width: 100%;
  max-width: var(--klb-login-width);
  margin: 0 auto;
  padding: 2rem;
  background: var(--klb-login-bg);
  color: var(--klb-login-fg);
  border: 1px solid var(--klb-login-border);
  border-radius: var(--klb-login-radius);
  font-family: var(--klb-login-font);
  font-size: 1rem;
  line-height: 1.4;
}
.klb-login *, .klb-login *::before, .klb-login *::after { box-sizing: border-box; }

.klb-login__header { margin: 0 0 1.25rem; text-align: center; }
.klb-login__message { margin: 0 0 1.25rem; text-align: center; color: var(--klb-login-muted); }

.klb-login__form { display: flex; flex-direction: column; gap: 1rem; }
.klb-login__group { display: flex; flex-direction: column; gap: 0.4rem; }
.klb-login__label { font-weight: 500; color: var(--klb-login-fg); }

.klb-login__input,
.klb-login__select {
  width: 100%;
  padding: 0.7rem 0.75rem;
  border: 1px solid var(--klb-login-border);
  border-radius: var(--klb-login-field-radius);
  background: var(--klb-login-input-bg);
  color: var(--klb-login-fg);
  font: inherit;
}
.klb-login__input:focus,
.klb-login__select:focus {
  outline: none;
  border-color: var(--klb-login-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--klb-login-accent) 25%, transparent);
}

.klb-login__checkbox { display: flex; align-items: center; gap: 0.5rem; }
.klb-login__checkbox input { width: 18px; height: 18px; }
.klb-login__checkbox label { font-weight: 400; }

.klb-login__text {
  color: var(--klb-login-muted);
  font-size: 0.9rem;
}
.klb-login__text--error,
.klb-login__error {
  background: var(--klb-login-error-bg);
  color: var(--klb-login-error-fg);
  padding: 0.6rem 0.75rem;
  border-radius: var(--klb-login-field-radius);
  font-size: 0.92rem;
}
.klb-login__link {
  color: var(--klb-login-accent);
  text-decoration: none;
  cursor: pointer;
}
.klb-login__link:hover { text-decoration: underline; }

.klb-login__button {
  padding: 0.7rem 0.9rem;
  border: none;
  border-radius: var(--klb-login-field-radius);
  font: inherit;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s, transform 0.15s, opacity 0.2s;
}
.klb-login__button--primary {
  background: var(--klb-login-accent);
  color: var(--klb-login-accent-contrast);
}
.klb-login__button--primary:hover:not(:disabled) { background: var(--klb-login-accent-hover); }
.klb-login__button--primary:disabled { opacity: 0.6; cursor: default; }

.klb-login__button--secondary {
  background: transparent;
  color: var(--klb-login-accent);
  font-weight: 400;
}
.klb-login__button--secondary:hover { text-decoration: underline; }

.klb-login__button--passkey {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: transparent;
  color: var(--klb-login-fg);
  border: 1px solid var(--klb-login-border);
}
.klb-login__button--passkey:hover:not(:disabled) {
  border-color: var(--klb-login-accent);
}

.klb-login__footer { margin-top: 0.5rem; text-align: center; }

.klb-login__oauth { margin-top: 0.5rem; }
.klb-login__oauth-divider {
  display: flex; align-items: center; gap: 0.75rem;
  margin: 1.25rem 0; color: var(--klb-login-muted); font-size: 0.9rem;
}
.klb-login__oauth-divider::before,
.klb-login__oauth-divider::after {
  content: ""; flex: 1; border-bottom: 1px solid var(--klb-login-border);
}
.klb-login__oauth-buttons { display: flex; flex-direction: column; gap: 0.6rem; }
.klb-login__oauth-button {
  display: flex; align-items: center; justify-content: center; gap: 0.5rem;
  width: 100%;
  padding: 0.6rem 1rem;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: var(--klb-login-field-radius);
  font: inherit; font-weight: 500; cursor: pointer;
  transition: transform 0.15s, box-shadow 0.2s, opacity 0.2s;
}
.klb-login__oauth-button:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); opacity: 0.95; }
.klb-login__oauth-button img { width: 22px; height: 22px; object-fit: contain; }

.klb-login__loading { text-align: center; padding: 2rem 0; color: var(--klb-login-muted); }
.klb-login__spinner {
  width: 26px; height: 26px; margin: 0 auto 0.75rem;
  border: 3px solid color-mix(in srgb, var(--klb-login-accent) 25%, transparent);
  border-top-color: var(--klb-login-accent);
  border-radius: 50%;
  animation: klb-login-spin 0.9s linear infinite;
}
@keyframes klb-login-spin { to { transform: rotate(360deg); } }

.klb-login__hidden {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
}
`;

// Inject the stylesheet once per document.
export function injectStyles(doc = typeof document !== 'undefined' ? document : null) {
  if (!doc || doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  (doc.head || doc.documentElement).appendChild(style);
}
