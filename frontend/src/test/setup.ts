import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
});

const emptyRect = () =>
  ({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    width: 0,
    height: 0,
    toJSON: () => ({}),
  }) as DOMRect;

if (typeof Text !== "undefined") {
  const t = Text.prototype as unknown as Record<string, unknown>;
  if (typeof t.getClientRects !== "function") t.getClientRects = () => [];
  if (typeof t.getBoundingClientRect !== "function") t.getBoundingClientRect = emptyRect;
}

if (typeof Element !== "undefined") {
  const el = Element.prototype as unknown as Record<string, unknown>;
  if (typeof el.getClientRects !== "function") el.getClientRects = () => [];
  if (typeof el.getBoundingClientRect !== "function") el.getBoundingClientRect = emptyRect;
}

if (typeof Range !== "undefined") {
  const r = Range.prototype as unknown as Record<string, unknown>;
  if (typeof r.getClientRects !== "function") r.getClientRects = () => [];
  if (typeof r.getBoundingClientRect !== "function") r.getBoundingClientRect = emptyRect;
}

if (typeof document !== "undefined") {
  const d = document as unknown as { elementFromPoint?: (x: number, y: number) => Element | null };
  if (typeof d.elementFromPoint !== "function") d.elementFromPoint = () => null;
}
