// OTP field — a one-time code (mailed code, authenticator app, registration
// code) shown as a row of character cells.
//
// The server describes the code on the input field:
//   hint:   'otp'
//   otp:    { format: 'all-digits' | 'alnum', length: 6 }
//   format: 'AAAA-AAAA'   (optional display mask; non-'A' characters are
//                          separators drawn between the cells, never sent)
//
// A single real <input> sits transparently over the cells, so typing, paste,
// password managers and one-time-code autofill all behave as for any input.
// Input is filtered to the allowed characters and capped at `length`; a paste
// (or autofill) that completes the code submits the form.

import { el } from '../dom.js';
import { inputSpec } from './input.js';

const MAX_LENGTH = 32;

// Allowed characters per format. Unknown formats only drop whitespace.
const FORMATS = {
  'all-digits': { allowed: /[0-9]/, upper: false, inputMode: 'numeric' },
  alnum: { allowed: /[A-Za-z0-9]/, upper: true, inputMode: 'text' },
};
const ANY = { allowed: /\S/, upper: false, inputMode: 'text' };

// The code's length, or 0 when the field doesn't give a usable one.
function otpLength(field) {
  const n = Number(field.otp && field.otp.length);
  return Number.isInteger(n) && n > 0 && n <= MAX_LENGTH ? n : 0;
}

// Keep only allowed characters, normalize case, cap at the code's length.
export function sanitizeOtp(raw, field) {
  const fmt = FORMATS[field.otp && field.otp.format] || ANY;
  let out = '';
  for (const ch of String(raw || '')) {
    if (!fmt.allowed.test(ch)) continue;
    out += fmt.upper ? ch.toUpperCase() : ch;
  }
  return out.slice(0, otpLength(field));
}

// Cell group sizes from a display mask like 'AAAA-AAAA' → [4, 4]; one group
// when there is no mask or it doesn't describe exactly `length` characters.
function groupSizes(field, length) {
  const mask = typeof field.format === 'string' ? field.format : '';
  const sizes = mask.split(/[^A]+/).filter(Boolean).map((g) => g.length);
  const total = sizes.reduce((a, b) => a + b, 0);
  return total === length ? sizes : [length];
}

export const otpSpec = {
  match: (field) => field.cat === 'input' && (field.hint === 'otp' || !!field.otp),
  render(field, ctx) {
    const length = otpLength(field);
    // Without a length there are no cells to draw — use the plain input.
    if (!length) return inputSpec.render(field, ctx);

    const name = field.name;
    const fmt = FORMATS[field.otp.format] || ANY;
    const initial = sanitizeOtp(ctx.values[name], field);

    const cells = [];
    const groups = groupSizes(field, length).map((size, gi) => {
      const group = el('div', { class: 'klb-login__otp-group' });
      for (let i = 0; i < size; i++) {
        const cell = el('div', { class: 'klb-login__otp-cell' });
        cells.push(cell);
        group.appendChild(cell);
      }
      return gi === 0 ? group : [el('div', { class: 'klb-login__otp-sep' }), group];
    });

    const input = el('input', {
      id: name,
      name,
      class: 'klb-login__otp-input',
      type: 'text',
      value: initial,
      inputMode: fmt.inputMode,
      autocomplete: ctx.autocomplete(field),
      autocapitalize: fmt.upper ? 'characters' : 'off',
      spellcheck: false,
      // No maxLength: it would cut a paste like '123-456' before the filter
      // drops the separator; sanitizeOtp() caps the length instead.
      required: ctx.required(name),
      'aria-label': ctx.t(field.label) || undefined,
      dataset: ctx.isFocusTarget(field) ? { klbAutofocus: 'true' } : {},
    });

    const box = el('div', { class: 'klb-login__otp' }, [
      el('div', { class: 'klb-login__otp-cells', 'aria-hidden': 'true' }, groups.flat()),
      input,
    ]);

    const paint = () => {
      const value = input.value;
      const focused = input.ownerDocument.activeElement === input;
      cells.forEach((cell, i) => {
        cell.textContent = value[i] || '';
        cell.classList.toggle('klb-login__otp-cell--filled', i < value.length);
        // Active cell: the next one to fill, or the last once complete.
        const active = focused && i === Math.min(value.length, length - 1);
        cell.classList.toggle('klb-login__otp-cell--active', active);
      });
    };

    // The cells model only appending / deleting at the end, so keep the
    // caret there.
    const caretToEnd = () => {
      const end = input.value.length;
      try {
        input.setSelectionRange(end, end);
      } catch {
        /* not focusable yet */
      }
    };

    input.addEventListener('input', (e) => {
      const clean = sanitizeOtp(input.value, field);
      if (clean !== input.value) input.value = clean;
      ctx.setValue(name, clean);
      caretToEnd();
      paint();
      // Typing goes character by character; a paste or autofill delivers the
      // whole code at once — submit it when it's complete.
      const kind = e.inputType || '';
      const typed = kind === 'insertText' || kind.startsWith('delete');
      if (!typed && clean.length === length && input.form) input.form.requestSubmit();
    });
    input.addEventListener('keydown', (e) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
        e.preventDefault();
      }
    });
    input.addEventListener('focus', () => {
      caretToEnd();
      paint();
    });
    input.addEventListener('blur', paint);
    input.addEventListener('click', caretToEnd);

    if (initial !== (ctx.values[name] ?? '')) ctx.setValue(name, initial);
    paint();

    return el('div', { class: 'klb-login__group' }, [
      field.label ? el('label', { class: 'klb-login__label', htmlFor: name }, ctx.t(field.label)) : null,
      box,
    ]);
  },
};
