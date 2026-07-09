// Label field — instructional text, error messages, and `@action=` flow-switch
// links (e.g. "Forgot your password?" → reset_password).

import { el } from '../dom.js';

const ACTION_RE = /^@action=(.+)$/;

export const labelSpec = {
  match: (field) => field.type === 'label' || field.cat === 'label',
  render(field, ctx) {
    const isError = field.style === 'error';
    const cls = ['klb-login__text', isError && 'klb-login__text--error'];

    if (!field.link) {
      return el('div', { class: cls }, field.label || '');
    }

    const actionMatch = ACTION_RE.exec(field.link);
    const linkText = field.linkText || field.label || '';

    const onClick = (e) => {
      if (actionMatch) {
        e.preventDefault();
        ctx.controller.switchAction(actionMatch[1]);
      }
      // Non-action links fall through to normal anchor navigation.
    };

    const link = el(
      'a',
      {
        class: 'klb-login__link',
        href: actionMatch ? '#' : field.link,
        on: { click: onClick },
      },
      linkText,
    );

    // If the label doubles as the link text, render just the link; otherwise
    // show the label followed by the link.
    if (!field.linkText || field.linkText === field.label) {
      return el('div', { class: cls }, link);
    }
    return el('div', { class: cls }, [field.label + ' ', link]);
  },
};
