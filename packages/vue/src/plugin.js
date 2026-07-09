// Shared injection key + defaults for the plugin. `app.use(KlbLogin, options)`
// stores these; <KlbLogin> reads them as prop fallbacks.

export const KLB_LOGIN_OPTIONS = Symbol('klb-login-options');

export const defaultOptions = {
  coreUrl: undefined, // falls back to loadCore's DEFAULT_CORE_URL
  theme: undefined,
  messages: undefined,
  translate: undefined,
  locale: undefined,
};
