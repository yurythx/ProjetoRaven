import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { AuthProvider, useAuth } from "@/components/auth-provider";

function Consumer() {
  const { user, isLoading, login, logout } = useAuth();
  return (
    <div>
      <div data-testid="loading">{String(isLoading)}</div>
      <div data-testid="user">{user ? "yes" : "no"}</div>
      <button
        type="button"
        onClick={async () => {
          await login({ email: "player@example.com", password: "TestPass123!" });
        }}
      >
        login
      </button>
      <button
        type="button"
        onClick={async () => {
          await logout();
        }}
      >
        logout
      </button>
    </div>
  );
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("AuthProvider", () => {
  it("carrega sessão ao montar", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/auth/session" && (init?.method ?? "GET") === "GET") {
        return jsonResponse({ user: null }, 200);
      }
      return jsonResponse({ error: "unexpected" }, 500);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
    expect(screen.getByTestId("user")).toHaveTextContent("no");
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/session", expect.anything());
  });

  it("login define usuário e logout limpa", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url === "/api/auth/session" && method === "GET") return jsonResponse({ user: null }, 200);
      if (url === "/api/auth/login" && method === "POST") return jsonResponse({ user: { id: "u1" } }, 200);
      if (url === "/api/auth/logout" && method === "POST") return jsonResponse({ ok: true }, 200);
      return jsonResponse({ error: "unexpected" }, 500);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
    expect(screen.getByTestId("user")).toHaveTextContent("no");

    await user.click(screen.getByRole("button", { name: "login" }));
    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("yes"));

    await user.click(screen.getByRole("button", { name: "logout" }));
    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("no"));
  });
});

