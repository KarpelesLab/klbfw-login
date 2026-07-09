// Transport helpers around the host-provided `rest` function.
//
// The core never imports `@karpeleslab/klbfw` itself — the host injects a
// `rest(name, verb, params)` implementation (typically klbfw's) so there is a
// single transport/auth context per page and no duplicated dependency in the
// CDN bundle.

export const FLOW_ENDPOINT = 'User:flow';

// Known KLB API error tokens → English fallbacks (per apibasics.md). Anything
// with a token is first run through the translator so hosts / locale tables can
// localize it; this map is the last-resort English default.
const ERROR_TOKENS = {
  error_authentication_required: 'Authentication is required to access this resource',
  error_access_denied: 'You do not have permission to access this resource',
  error_missing_field: 'A required field is missing',
  error_invalid_value: 'Invalid value provided',
  error_not_found: 'The requested resource was not found',
  error_rate_limit_exceeded: 'Rate limit exceeded. Please try again later',
  error_field_validation: 'Please check the form for errors',
  error_passkey_expired: 'The passkey request expired. Please try again.',
  error_passkey_missing_field: 'The passkey response was incomplete. Please try again.',
};

// Turn an API error (or thrown Error) into a human-readable string. `t` is the
// core translator; passing it lets error tokens be localized.
export function formatError(error, t = (k) => k) {
  if (!error) return t('auth_failed');

  if (error instanceof Error) {
    if (/network/i.test(error.message)) {
      return 'Network connection error. Please check your internet connection.';
    }
    return error.message || t('auth_failed');
  }

  if (error.result === 'error') {
    if (error.fields) {
      const fieldErrors = Object.entries(error.fields)
        .map(([field, msg]) => `${field}: ${msg}`)
        .join(', ');
      return fieldErrors;
    }
    if (error.token) {
      const translated = t(error.token);
      if (translated && translated !== error.token) return translated;
      if (ERROR_TOKENS[error.token]) return ERROR_TOKENS[error.token];
    }
    return error.error || error.message || t('auth_failed');
  }

  if (error.message) return error.message;
  return t('auth_failed');
}

// Perform a POST to User:flow and return the inner `data` payload. Throws the
// raw error object/response on failure so the caller can format it.
export async function flowCall(rest, params) {
  const response = await rest(FLOW_ENDPOINT, 'POST', params);
  if (response && response.result === 'success' && response.data) {
    return response.data;
  }
  // rest() normally rejects on non-success; this guards the unexpected shape.
  throw response || new Error('invalid_auth_response');
}
