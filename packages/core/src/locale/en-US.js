// Default en-US UI-chrome strings for the core renderer. These cover only the
// strings the core itself produces (buttons, dividers, generic OAuth/passkey
// labels, built-in error messages). Server-sent field labels and flow messages
// are already localized by the API. Hosts can override any of these through the
// `translate` / `messages` mount options.
export default {
  continue: 'Continue',
  sign_in: 'Sign In',
  back: 'Back',
  loading: 'Loading…',
  try_again: 'Try again',
  user_oauth_help: 'Or sign in with one of the following services',

  passkey_button: 'Sign in with a passkey',
  passkey_register_button: 'Use a passkey',
  passkey_or: 'or',

  fill_required_fields: 'Please fill out the required fields: {fields}',
  passwords_do_not_match: 'Passwords do not match',
  invalid_auth_response: 'Invalid response from authentication service',
  auth_failed: 'Authentication failed',

  btn_login_with_generic: 'Sign in with {provider}',
  btn_login_with_google: 'Sign in with Google',
  btn_login_with_apple: 'Sign in with Apple',
  btn_login_with_microsoft: 'Sign in with Microsoft',
  btn_login_with_facebook: 'Sign in with Facebook',
  btn_login_with_twitter: 'Sign in with Twitter',
  btn_login_with_line: 'Sign in with LINE',
  btn_login_with_amazon: 'Sign in with Amazon',
  btn_login_with_ethereum: 'Sign in with Ethereum',
};
