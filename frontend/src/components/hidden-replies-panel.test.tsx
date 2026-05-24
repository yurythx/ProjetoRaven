import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import { HiddenRepliesPanel } from "@/components/hidden-replies-panel";

const mockRefresh = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("HiddenRepliesPanel", () => {
  it("não renderiza para não moderador", async () => {
    const auth = await import("@/components/auth-provider");
    vi.spyOn(auth, "useAuth").mockReturnValue({
      user: { id: "u1", is_forum_moderator: false },
      isLoading: false,
      login: async () => ({ ok: true }),
      register: async () => ({ ok: true }),
      logout: async () => {},
      refreshSession: async () => {},
    });

    render(<HiddenRepliesPanel topicSlug="welcome" />);
    expect(screen.queryByText("Replies ocultas")).toBeNull();
  });

  it("renderiza e carrega replies ocultas para moderador", async () => {
    const auth = await import("@/components/auth-provider");
    vi.spyOn(auth, "useAuth").mockReturnValue({
      user: { id: "u1", is_forum_moderator: true },
      isLoading: false,
      login: async () => ({ ok: true }),
      register: async () => ({ ok: true }),
      logout: async () => {},
      refreshSession: async () => {},
    });

    const fetchMock = vi.fn(async () =>
      jsonResponse(
        {
          count: 1,
          next: null,
          previous: null,
          results: [
            {
              id: "r1",
              content: "hidden",
              is_hidden: true,
              created_at: new Date().toISOString(),
              author: { username: "u", display_name: "U" },
            },
          ],
        },
        200
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<HiddenRepliesPanel topicSlug="welcome" />);
    expect(screen.getByText("Replies ocultas")).toBeInTheDocument();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(screen.getByText("hidden")).toBeInTheDocument();
  });
});
