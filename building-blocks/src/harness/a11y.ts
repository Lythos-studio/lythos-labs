/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/** A small, DOM-free view of an element, so the algorithms below can be tested in plain Node and also run on real elements. */
export type A11yNode = {
  tag: string;
  attrs: Record<string, string>;
  text?: string;
  children: A11yNode[];
  hidden?: boolean;
  /** Text of the <label> elements that point at a form control. */
  labelText?: string;
  checked?: boolean;
};

const INPUT_ROLES: Record<string, string | null> = {
  button: "button", submit: "button", reset: "button", image: "button", checkbox: "checkbox", radio: "radio", range: "slider",
  number: "spinbutton", search: "searchbox", hidden: null, file: null,
};
const TAG_ROLES: Record<string, string> = {
  button: "button", summary: "button", textarea: "textbox", option: "option", optgroup: "group", ul: "list", ol: "list", li: "listitem",
  nav: "navigation", main: "main", aside: "complementary", header: "banner", footer: "contentinfo", article: "article", table: "table",
  thead: "rowgroup", tbody: "rowgroup", tfoot: "rowgroup", tr: "row", td: "cell", dialog: "dialog", details: "group", progress: "progressbar",
  meter: "meter", output: "status", fieldset: "group", hr: "separator", figure: "figure", h1: "heading", h2: "heading", h3: "heading",
  h4: "heading", h5: "heading", h6: "heading",
};
const NAME_FROM_CONTENT = new Set([
  "button", "link", "tab", "menuitem", "menuitemcheckbox", "menuitemradio", "option", "heading", "checkbox", "radio", "switch", "treeitem",
  "cell", "columnheader", "rowheader", "gridcell", "tooltip", "listitem",
]);

export function roleOf(node: A11yNode): string | null {
  const explicit = node.attrs.role?.trim().split(/\s+/)[0];
  if (explicit) return explicit === "none" ? "presentation" : explicit;
  const { tag, attrs } = node;
  if (tag === "a" || tag === "area") return "href" in attrs ? "link" : null;
  if (tag === "input") {
    const type = (attrs.type ?? "text").toLowerCase();
    return type in INPUT_ROLES ? INPUT_ROLES[type] : "textbox";
  }
  if (tag === "select") return "multiple" in attrs || Number(attrs.size) > 1 ? "listbox" : "combobox";
  if (tag === "img") return attrs.alt === "" ? "presentation" : "img";
  if (tag === "section" || tag === "form") return attrs["aria-label"] || attrs["aria-labelledby"] ? (tag === "form" ? "form" : "region") : null;
  if (tag === "th") return attrs.scope === "row" ? "rowheader" : "columnheader";
  return TAG_ROLES[tag] ?? null;
}

const collapse = (s: string) => s.replace(/\s+/g, " ").trim();

function content(node: A11yNode, byId: (id: string) => A11yNode | undefined, skipHidden = true): string {
  if (node.tag === "#text") return node.hidden && skipHidden ? "" : (node.text ?? "");
  if (skipHidden && (node.hidden || node.attrs["aria-hidden"] === "true")) return "";
  const own = node.attrs["aria-label"];
  if (own) return own;
  return node.children.map((c) => content(c, byId, skipHidden)).join(" ");
}

/** A simplified accessible name computation: labelledby, aria-label, native label, then content or title. A benchmark, not a full implementation of the spec. */
export function accessibleName(node: A11yNode, byId: (id: string) => A11yNode | undefined): string {
  const ids = node.attrs["aria-labelledby"]?.split(/\s+/).filter(Boolean) ?? [];
  const referenced = ids.map((id) => byId(id)).filter((x): x is A11yNode => !!x);
  if (referenced.length) return collapse(referenced.map((r) => content(r, byId, false)).join(" "));
  if (node.attrs["aria-label"]?.trim()) return collapse(node.attrs["aria-label"]);
  if (node.labelText?.trim()) return collapse(node.labelText);
  if (node.tag === "img" && node.attrs.alt) return collapse(node.attrs.alt);
  if (node.tag === "input" && ["button", "submit", "reset"].includes((node.attrs.type ?? "").toLowerCase()))
    return collapse(node.attrs.value || ({ submit: "Submit", reset: "Reset" } as Record<string, string>)[node.attrs.type.toLowerCase()] || "");
  const role = roleOf(node);
  if (role && NAME_FROM_CONTENT.has(role)) {
    const text = collapse(node.children.map((c) => content(c, byId)).join(" "));
    if (text) return text;
  }
  return collapse(node.attrs.title ?? "");
}

const NATIVE_TABBABLE = new Set(["button", "select", "textarea", "summary", "iframe"]);

function isTabbable(node: A11yNode): boolean {
  if (node.hidden) return false;
  if ("disabled" in node.attrs) return false;
  if (node.attrs.tabindex !== undefined) return Number.parseInt(node.attrs.tabindex, 10) >= 0;
  if (node.tag === "a" || node.tag === "area") return "href" in node.attrs;
  if (node.tag === "input") return (node.attrs.type ?? "text").toLowerCase() !== "hidden";
  if (node.attrs.contenteditable === "" || node.attrs.contenteditable === "true") return true;
  return NATIVE_TABBABLE.has(node.tag);
}

function flatten(nodes: A11yNode[], out: A11yNode[] = []): A11yNode[] {
  for (const node of nodes) {
    if (node.hidden) continue;
    out.push(node);
    flatten(node.children, out);
  }
  return out;
}

/** The order Tab visits elements: positive tabindex first (ascending), then the rest in document order. A radio group is one stop. */
export function tabOrder(roots: A11yNode[]): A11yNode[] {
  const all = flatten(roots).filter(isTabbable);
  const groups = new Map<string, A11yNode[]>();
  for (const node of all) if (node.tag === "input" && node.attrs.type === "radio" && node.attrs.name) groups.set(node.attrs.name, [...(groups.get(node.attrs.name) ?? []), node]);
  const dropped = new Set<A11yNode>();
  for (const group of groups.values()) {
    const keep = group.find((r) => r.checked) ?? group[0];
    for (const r of group) if (r !== keep) dropped.add(r);
  }
  const stops = all.filter((n) => !dropped.has(n));
  const positive = stops.filter((n) => Number.parseInt(n.attrs.tabindex ?? "0", 10) > 0).sort((a, b) => Number.parseInt(a.attrs.tabindex, 10) - Number.parseInt(b.attrs.tabindex, 10));
  return [...positive, ...stops.filter((n) => !(Number.parseInt(n.attrs.tabindex ?? "0", 10) > 0))];
}

export type TreeRow = { depth: number; role: string; name: string; state: string[]; node: A11yNode };

function states(node: A11yNode): string[] {
  const a = node.attrs;
  const out: string[] = [];
  if (/^h[1-6]$/.test(node.tag)) out.push(`level ${node.tag[1]}`);
  if (a["aria-expanded"]) out.push(a["aria-expanded"] === "true" ? "expanded" : "collapsed");
  if (a["aria-checked"] || node.checked) out.push(a["aria-checked"] === "mixed" ? "mixed" : a["aria-checked"] === "false" ? "not checked" : "checked");
  if (a["aria-selected"] === "true") out.push("selected");
  if (a["aria-pressed"]) out.push(a["aria-pressed"] === "true" ? "pressed" : "not pressed");
  if (a["aria-current"] && a["aria-current"] !== "false") out.push("current");
  if ("disabled" in a || a["aria-disabled"] === "true") out.push("disabled");
  if (a["aria-invalid"] === "true") out.push("invalid");
  if ("required" in a || a["aria-required"] === "true") out.push("required");
  if (a["aria-busy"] === "true") out.push("busy");
  return out;
}

/** The roles, names and states a screen reader would be given, as a flat list with depth. An approximation of the browser's accessibility tree. */
export function a11yTree(roots: A11yNode[], byId: (id: string) => A11yNode | undefined): TreeRow[] {
  const rows: TreeRow[] = [];
  const walk = (node: A11yNode, depth: number) => {
    if (node.tag === "#text" || node.hidden || node.attrs["aria-hidden"] === "true") return;
    const role = roleOf(node);
    const present = role && role !== "presentation";
    if (present) rows.push({ depth, role, name: accessibleName(node, byId), state: states(node), node });
    for (const c of node.children) walk(c, present ? depth + 1 : depth);
  };
  roots.forEach((r) => walk(r, 0));
  return rows;
}

/** Adapter for real elements. */
export function fromElement(el: Element): A11yNode {
  const attrs: Record<string, string> = {};
  for (const a of Array.from(el.attributes)) attrs[a.name] = a.value;
  const style = el instanceof HTMLElement ? getComputedStyle(el) : null;
  const hidden = el.hasAttribute("hidden") || el.hasAttribute("inert") || style?.display === "none" || style?.visibility === "hidden";
  const labels = (el as HTMLInputElement).labels;
  return {
    tag: el.tagName.toLowerCase(),
    attrs,
    hidden,
    labelText: labels ? Array.from(labels).map((l) => l.textContent ?? "").join(" ") : undefined,
    checked: (el as HTMLInputElement).checked === true,
    children: Array.from(el.childNodes).flatMap((c) =>
      c.nodeType === 3 ? [{ tag: "#text", attrs: {}, text: c.textContent ?? "", children: [] }] : c.nodeType === 1 ? [fromElement(c as Element)] : [],
    ),
  };
}
