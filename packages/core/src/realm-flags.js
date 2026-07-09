// Realm flags normalization.
//
// Flags reach the client in two shapes:
//   - klbfw's getRealm().Flags  → an object map, e.g. { oauth_first: true }
//   - a User:flow response's `realm_flags` → an array, e.g. ["oauth_first"]
// Both are optional. We normalize any number of these sources into a single Set
// of active flag names, so callers can just ask `flags.has('oauth_first')`.
// Missing / malformed input yields an empty set (safe default).

export function normalizeFlags(...sources) {
  const set = new Set();
  for (const input of sources) {
    if (Array.isArray(input)) {
      for (const name of input) if (name) set.add(String(name));
    } else if (input && typeof input === 'object') {
      for (const [name, on] of Object.entries(input)) if (on) set.add(name);
    }
  }
  return set;
}
