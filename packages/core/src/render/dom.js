// Minimal DOM helper so field specs and the renderer can build elements without
// a framework. `el('input', { type:'email', class:'x', on:{input: fn} }, [..])`.

export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;
    if (key === 'class') {
      node.className = Array.isArray(value) ? value.filter(Boolean).join(' ') : value;
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(node.style, value);
    } else if (key === 'on' && typeof value === 'object') {
      for (const [evt, handler] of Object.entries(value)) {
        if (handler) node.addEventListener(evt, handler);
      }
    } else if (key === 'dataset' && typeof value === 'object') {
      Object.assign(node.dataset, value);
    } else if (key in node && key !== 'list') {
      // Prefer the DOM property (value, checked, disabled, htmlFor, …).
      try {
        node[key] = value;
      } catch {
        node.setAttribute(key, value);
      }
    } else {
      node.setAttribute(key, value === true ? '' : value);
    }
  }
  appendChildren(node, children);
  return node;
}

export function appendChildren(node, children) {
  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    if (child == null || child === false) continue;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}
