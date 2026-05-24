import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = [
  "a", "p", "br", "strong", "b", "em", "i", "u", "s", "blockquote",
  "ul", "ol", "li", "h1", "h2", "h3", "pre", "code", "hr", "span", "div", "img",
];

const ALLOWED_ATTR = {
  a: ["href", "name", "target"],
  img: ["src", "alt", "width", "height"],
  "*": ["class", "style", "title"],
};

export function sanitizeRichTextHtml(value: string) {
  const html = value ?? "";
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTR,
  });
}

