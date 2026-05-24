import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { ReplyReactions } from "@/components/reply-reactions";

const mockRefresh = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("ReplyReactions", () => {
  beforeEach(() => {
    mockRefresh.mockClear();
  });

  it("desabilita botões quando não autenticado", async () => {
    const auth = await import("@/components/auth-provider");
    vi.spyOn(auth, "useAuth").mockReturnValue({
      user: null,
      isLoading: false,
      login: async () => ({ ok: true }),
      register: async () => ({ ok: true }),
      logout: async () => {},
      refreshSession: async () => {},
    });

    render(<ReplyReactions replyId="r1" summary={{ like: 1 }} />);
    expect(screen.getByRole("button", { name: /Like · 1/i })).toBeDisabled();
  });

  it("envia reação quando autenticado e chama refresh", async () => {
    const auth = await import("@/components/auth-provider");
    vi.spyOn(auth, "useAuth").mockReturnValue({
      user: { id: "u1" },
      isLoading: false,
      login: async () => ({ ok: true }),
      register: async () => ({ ok: true }),
      logout: async () => {},
      refreshSession: async () => {},
    });

    const fetchMock = vi.fn(async () => jsonResponse({ ok: true }, 201));
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<ReplyReactions replyId="r1" summary={{ like: 0 }} />);
    await user.click(screen.getByRole("button", { name: /^Like\s*·\s*0$/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/forum/replies/r1/react",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ reaction: "like" }),
      })
    );
    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
  });
});

