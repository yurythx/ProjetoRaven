import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { ReplyModerationActions } from "@/components/reply-moderation-actions";

const mockRefresh = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("ReplyModerationActions", () => {
  beforeEach(() => {
    mockRefresh.mockClear();
  });

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

    render(<ReplyModerationActions replyId="r1" isSolution={false} isHidden={false} />);
    expect(screen.queryByRole("button", { name: /Marcar solução/i })).toBeNull();
  });

  it("chama endpoint e refresh", async () => {
    const auth = await import("@/components/auth-provider");
    vi.spyOn(auth, "useAuth").mockReturnValue({
      user: { id: "u1", is_forum_moderator: true },
      isLoading: false,
      login: async () => ({ ok: true }),
      register: async () => ({ ok: true }),
      logout: async () => {},
      refreshSession: async () => {},
    });

    const fetchMock = vi.fn(async () => jsonResponse({ ok: true }, 200));
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<ReplyModerationActions replyId="r1" isSolution={false} isHidden={false} />);

    await user.click(screen.getByRole("button", { name: "Marcar solução" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/forum/replies/r1/mark-solution",
      expect.objectContaining({ method: "POST" })
    );
    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
  });
});
