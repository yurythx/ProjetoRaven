import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import LoginPage from "@/app/login/page";

const replaceMock = vi.fn();
const loginMock = vi.fn();
const useSearchParamsMock = vi.fn();
const assignMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => useSearchParamsMock(),
}));

vi.mock("@/components/auth-provider", () => ({
  useAuth: () => ({ login: loginMock }),
}));

vi.mock("@/components/oauth-buttons", () => ({
  OAuthButtons: () => <div data-testid="oauth-buttons" />,
}));

describe("LoginPage", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    loginMock.mockReset();
    useSearchParamsMock.mockReset();
    assignMock.mockReset();
    useSearchParamsMock.mockReturnValue(new URLSearchParams(""));
    vi.stubGlobal("location", { ...window.location, assign: assignMock });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("faz redirect hard para next seguro apos login", async () => {
    loginMock.mockResolvedValue({ ok: true });
    useSearchParamsMock.mockReturnValue(new URLSearchParams("next=%2Fdashboard%2Fusuarios"));

    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText("E-mail"), "admin@raven.gg");
    await user.type(screen.getByLabelText("Senha"), "admin123");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() =>
      expect(loginMock).toHaveBeenCalledWith({ email: "admin@raven.gg", password: "admin123" })
    );
    expect(assignMock).toHaveBeenCalledWith("/dashboard/usuarios");
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("ignora next externo e redireciona para /me", async () => {
    loginMock.mockResolvedValue({ ok: true });
    useSearchParamsMock.mockReturnValue(new URLSearchParams("next=https%3A%2F%2Fevil.test"));

    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText("E-mail"), "admin@raven.gg");
    await user.type(screen.getByLabelText("Senha"), "admin123");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => expect(assignMock).toHaveBeenCalledWith("/me"));
  });

  it("redireciona para 2fa quando exigido", async () => {
    loginMock.mockResolvedValue({ ok: true, totp_required: true, totp_token: "token-2fa" });

    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText("E-mail"), "admin@raven.gg");
    await user.type(screen.getByLabelText("Senha"), "admin123");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() =>
      expect(replaceMock).toHaveBeenCalledWith("/auth/2fa?token=token-2fa")
    );
    expect(assignMock).not.toHaveBeenCalled();
  });
});
