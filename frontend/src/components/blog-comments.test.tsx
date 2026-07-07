import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { BlogComments } from "@/components/blog-comments";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("BlogComments", () => {
  it("carrega lista e envia comentário", async () => {
    const auth = await import("@/components/auth-provider");
    vi.spyOn(auth, "useAuth").mockReturnValue({
      user: { id: "u1", username: "u", display_name: "U", email: "u@example.com", is_verified: true, is_active: true, is_banned: false, is_admin: false },
      isLoading: false,
      login: async () => ({ ok: true }),
      register: async () => ({ ok: true }),
      logout: async () => {},
      refreshSession: async () => {},
    });

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("/api/blog/comments?")) {
        return jsonResponse(
          [
            {
              id: "c1",
              content: "Oi",
              author_name: "Guest",
              name: "Guest",
              post: "p1",
              parent: null,
              reply_count: 0,
              created_at: new Date().toISOString(),
            },
          ],
          200
        );
      }
      if (url === "/api/blog/comments" && init?.method === "POST") {
        return jsonResponse({ ok: true }, 201);
      }
      return jsonResponse({}, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<BlogComments postId="p1" postSlug="hello" />);

    await waitFor(() => expect(screen.getByText("Oi")).toBeInTheDocument());

    await user.type(screen.getByLabelText("Seu comentário"), "Comentário novo");
    await user.click(screen.getByRole("button", { name: "Enviar Comentário" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/blog/comments", expect.anything()));
  });
});
