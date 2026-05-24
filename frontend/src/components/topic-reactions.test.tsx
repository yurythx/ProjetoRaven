import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { TopicReactions } from "@/components/topic-reactions";

const mockRefresh = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("TopicReactions", () => {
  beforeEach(() => {
    mockRefresh.mockClear();
  });

  it("mostra contadores", async () => {
    const auth = await import("@/components/auth-provider");
    vi.spyOn(auth, "useAuth").mockReturnValue({
      user: null,
      isLoading: false,
      login: async () => ({ ok: true }),
      register: async () => ({ ok: true }),
      logout: async () => {},
      refreshSession: async () => {},
    });

    render(<TopicReactions topicId="t1" summary={{ like: 2, wow: 1 }} />);
    expect(screen.getByRole("button", { name: /Like · 2/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Wow · 1/i })).toBeDisabled();
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
    render(<TopicReactions topicId="t1" summary={{ like: 0 }} />);

    await user.click(screen.getByRole("button", { name: /^Like\s*·\s*0$/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/forum/topic-reactions",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ topic_id: "t1", reaction: "like" }),
      })
    );
    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
  });
});
