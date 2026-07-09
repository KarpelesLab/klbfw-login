// Field-type registry — the core's extension surface.
//
// A new authentication mechanism ships as a new registry entry from the CDN;
// host sites pick it up automatically without redeploying. Each entry is a spec:
//
//   {
//     match(field) -> boolean                 // does this spec handle the field?
//     render(field, ctx) -> Node              // build the field's DOM
//     onStepEnter?(field, ctx) -> cleanup?    // optional per-step side effect
//                                             // (e.g. arm passkey autofill),
//                                             // returns an optional cleanup fn
//   }
//
// Specs registered later win (checked first), so hosts can override a built-in
// for a given field via the `renderers` mount option without losing the rest.

const registry = [];

export function registerFieldType(name, spec) {
  if (!spec || typeof spec.match !== 'function' || typeof spec.render !== 'function') {
    throw new Error(`registerFieldType(${name}): spec needs match() and render()`);
  }
  // Newest first so overrides take precedence over built-ins.
  registry.unshift({ name, spec });
  return () => {
    const idx = registry.findIndex((e) => e.spec === spec);
    if (idx !== -1) registry.splice(idx, 1);
  };
}

export function resolveFieldSpec(field, overrides) {
  // Per-mount overrides (keyed by field.type) take absolute precedence.
  if (overrides) {
    const ov = overrides[field.type] || (field.cat && overrides[field.cat]);
    if (ov) return typeof ov === 'function' ? { match: () => true, render: ov } : ov;
  }
  const entry = registry.find((e) => e.spec.match(field));
  return entry ? entry.spec : null;
}
