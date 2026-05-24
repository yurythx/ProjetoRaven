import bleach
from bleach.css_sanitizer import CSSSanitizer


ALLOWED_TAGS = [
    "a",
    "p",
    "br",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "blockquote",
    "ul",
    "ol",
    "li",
    "h1",
    "h2",
    "h3",
    "pre",
    "code",
    "hr",
    "span",
    "div",
    "img",
]

ALLOWED_ATTRIBUTES = {
    "a": ["href", "title", "target", "rel"],
    "img": ["src", "alt", "title", "width", "height"],
    "span": ["style"],
    "div": ["style"],
    "*": ["class"],
}

ALLOWED_CSS_PROPERTIES = [
    "color",
    "background-color",
    "text-align",
]

ALLOWED_PROTOCOLS = ["http", "https", "mailto"]

_css_sanitizer = CSSSanitizer(allowed_css_properties=ALLOWED_CSS_PROPERTIES)

_cleaner = bleach.Cleaner(
    tags=ALLOWED_TAGS,
    attributes=ALLOWED_ATTRIBUTES,
    protocols=ALLOWED_PROTOCOLS,
    css_sanitizer=_css_sanitizer,
    strip=True,
)


def sanitize_html(value: str) -> str:
    if not value:
        return ""
    return _cleaner.clean(value)


def sanitize_plain_text(value: str) -> str:
    if not value:
        return ""
    return bleach.clean(value, tags=[], attributes={}, strip=True)

