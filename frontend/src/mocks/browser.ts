/**
 * Configura o MSW para ambiente de browser (desenvolvimento).
 *
 * Uso no layout raiz (src/app/layout.tsx):
 *   if (process.env.NEXT_PUBLIC_MSW === "true") {
 *     const { worker } = await import("@/mocks/browser");
 *     await worker.start({ onUnhandledRequest: "bypass" });
 *   }
 *
 * IMPORTANTE: execute `npm run msw:init` antes do primeiro uso para gerar
 * o service worker em /public/mockServiceWorker.js
 */
import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

export const worker = setupWorker(...handlers);
