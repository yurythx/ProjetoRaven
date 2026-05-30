import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = [
  "a", "p", "br", "strong", "b", "em", "i", "u", "s", "blockquote",
  "ul", "ol", "li", "h1", "h2", "h3", "pre", "code", "hr", "span", "div", "img",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "colgroup", "col",
];

const ALLOWED_ATTR = {
  a: ["href", "name", "target", "rel"],
  img: ["src", "alt", "width", "height"],
  td: ["colspan", "rowspan"],
  th: ["colspan", "rowspan", "scope"],
  col: ["span"],
  "*": ["class", "style", "title"],
};

export function sanitizeRichTextHtml(value: string) {
  const html = value ?? "";
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTR,
  });
}

