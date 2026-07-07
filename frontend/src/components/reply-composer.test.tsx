import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { ReplyComposer } from "@/components/reply-composer";

const mockRefresh = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("ReplyComposer", () => {
  beforeEach(() => {
    mockRefresh.mockClear();
  });

  it("envia reply e chama refresh", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ id: "r1" }, 201));
    vi.stubGlobal("fetch", fetchMock);

    const auth = await import("@/components/auth-provider");
    vi.spyOn(auth, "useAuth").mockReturnValue({
      user: { id: "u1", is_verified: true, is_active: true, is_banned: false, is_admin: false },
      isLoading: false,
      login: async () => ({ ok: true }),
      register: async () => ({ ok: true }),
      logout: async () => {},
      refreshSession: async () => {},
    });

    const user = userEvent.setup();
    render(<ReplyComposer topicId="t1" disabled={false} />);

    await user.type(await screen.findByRole("textbox"), "Olá mundo");
    await user.click(screen.getByRole("button", { name: "Enviar Resposta" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/forum/replies",
      expect.objectContaining({
        method: "POST",
      })
    );
  });
});
