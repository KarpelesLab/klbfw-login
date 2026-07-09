// Input field — text / email / password / phone / checkbox / select, including
// dynamic selects that source their options from an API endpoint.

import { el } from '../dom.js';

const TEXTUAL = ['text', 'email', 'password'];

// Build the control element for a field; the caller wraps it with a label.
function buildControl(field, ctx) {
  const name = field.name;
  const required = ctx.required(name);
  const initial = ctx.values[name];

  if (field.type === 'checkbox') {
    return el('input', {
      id: name,
      type: 'checkbox',
      checked: !!initial,
      required,
      on: {
        change: (e) => ctx.setValue(name, e.target.checked),
      },
    });
  }

  if (field.type === 'select') {
    const select = el('select', {
      id: name,
      class: 'klb-login__select',
      required,
      on: { change: (e) => ctx.setValue(name, e.target.value) },
    });
    populateSelect(select, field, ctx);
    return select;
  }

  const type = field.type === 'phone' ? 'tel' : TEXTUAL.includes(field.type) ? field.type : 'text';
  return el('input', {
    id: name,
    class: 'klb-login__input',
    type,
    value: initial != null ? initial : '',
    placeholder: field.format || undefined,
    required,
    autocomplete: ctx.autocomplete(field),
    dataset: ctx.isFocusTarget(field) ? { klbAutofocus: 'true' } : {},
    on: { input: (e) => ctx.setValue(name, e.target.value) },
  });
}

// Fill a select's <option>s, either from inline `values` or a dynamic `source`.
function populateSelect(select, field, ctx) {
  const current = ctx.values[field.name] != null ? ctx.values[field.name] : field.default;

  const addOptions = (items, keyFn, labelFn) => {
    for (const item of items) {
      const value = keyFn(item);
      const option = el('option', { value }, labelFn(item));
      if (String(value) === String(current)) option.selected = true;
      select.appendChild(option);
    }
    // Ensure the controller knows the effective value even without a change event.
    if (current != null && ctx.values[field.name] == null) ctx.setValue(field.name, current);
  };

  if (Array.isArray(field.values)) {
    addOptions(field.values, (o) => o.value, (o) => o.display);
    return;
  }

  if (field.source && ctx.rest) {
    const { api, label_field: labelField, key_field: keyField } = field.source;
    select.appendChild(el('option', { value: '', disabled: true, selected: true }, '…'));
    ctx
      .rest(api, 'GET')
      .then((res) => {
        const data = (res && res.data) || res || [];
        const list = Array.isArray(data) ? data : Object.values(data);
        select.innerHTML = '';
        addOptions(list, (o) => o[keyField], (o) => o[labelField]);
      })
      .catch(() => {
        /* leave the placeholder; server will re-validate on submit */
      });
  }
}

export const inputSpec = {
  match: (field) => field.cat === 'input',
  render(field, ctx) {
    const control = buildControl(field, ctx);

    if (field.type === 'checkbox') {
      return el('div', { class: 'klb-login__group' }, [
        el('div', { class: 'klb-login__checkbox' }, [
          control,
          el('label', { class: 'klb-login__label', htmlFor: field.name }, field.label || ''),
        ]),
      ]);
    }

    return el('div', { class: 'klb-login__group' }, [
      field.label ? el('label', { class: 'klb-login__label', htmlFor: field.name }, field.label) : null,
      control,
    ]);
  },
};
