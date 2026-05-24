import { describe, expect, it } from "vitest";

import { sanitizeRichTextHtml } from "@/lib/sanitize-html";

describe("sanitizeRichTextHtml", () => {
  it("remove scripts e eventos inline", () => {
    const html = `<div onclick="alert(1)"><script>alert(1)</script><p>ok</p></div>`;
    const out = sanitizeRichTextHtml(html);
    expect(out).toContain("<p>ok</p>");
    expect(out).not.toContain("script");
    expect(out).not.toContain("onclick");
  });

  it("mantém tags/atributos do rich text", () => {
    const html = `<p><span style="text-align:center;color:#fff" class="x">t</span> <a href="https://example.com" target="_blank" rel="noreferrer">link</a></p>`;
    const out = sanitizeRichTextHtml(html);
    expect(out).toContain("style=");
    expect(out).toContain('class="x"');
    expect(out).toContain("href=");
  });
});

