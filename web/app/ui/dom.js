/**
 * Minimal DOM helpers.
 *
 * Everything user-supplied — item names come from speech or a text box — is
 * set with textContent, never innerHTML. That is the whole XSS story for this
 * app: there is no path from a spoken phrase to parsed markup.
 */

/**
 * Create an element.
 *
 * @param {string} tag
 * @param {object} [props]      className, text, attrs, dataset, on
 * @param {Array<Node|string|null|undefined|false>} [children]
 */
export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);

  if (props.className) node.className = props.className;
  if (props.text !== undefined && props.text !== null) node.textContent = String(props.text);

  for (const [key, value] of Object.entries(props.attrs || {})) {
    if (value === false || value === null || value === undefined) continue;
    node.setAttribute(key, value === true ? '' : String(value));
  }

  for (const [key, value] of Object.entries(props.dataset || {})) {
    if (value === null || value === undefined) continue;
    node.dataset[key] = String(value);
  }

  for (const [event, handler] of Object.entries(props.on || {})) {
    node.addEventListener(event, handler);
  }

  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }

  return node;
}

/** Remove every child of a node. */
export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/** Replace a node's children in one operation. */
export function render(node, children) {
  clear(node);
  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child);
  }
}

/** Shorthand for querySelector with a helpful failure. */
export function $(selector, scope = document) {
  const node = scope.querySelector(selector);
  if (!node) throw new Error(`Expected element "${selector}" to exist`);
  return node;
}

/** querySelectorAll as a real array. */
export function $$(selector, scope = document) {
  return [...scope.querySelectorAll(selector)];
}
