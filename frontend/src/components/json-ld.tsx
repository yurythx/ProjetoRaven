import { headers } from "next/headers";

export async function JsonLd({ data }: { data: Record<string, unknown> }) {
  const hdrs = await headers();
  const nonce = (hdrs.get("x-nonce") || "").trim();
  return (
    <script
      type="application/ld+json"
      {...(nonce ? { nonce } : {})}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
