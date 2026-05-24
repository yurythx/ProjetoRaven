import React from "react";
import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/components/auth-provider", () => ({
  useAuth: vi.fn(),
}));

import { HeroCta } from "@/components/hero-cta";
import { useAuth } from "@/components/auth-provider";

function mockAuth(overrides: Partial<ReturnType<typeof useAuth>>) {
  vi.mocked(useAuth).mockReturnValue({
    user: null,
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refreshSession: vi.fn(),
    ...overrides,
  } as ReturnType<typeof useAuth>);
}

describe("HeroCta", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mostra skeleton enquanto carrega", () => {
    mockAuth({ isLoading: true });
    render(<HeroCta />);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("mostra links de registro e fórum quando não logado", () => {
    mockAuth({ user: null, isLoading: false });
    render(<HeroCta />);
    expect(screen.getByText(/Criar Conta/i)).toBeInTheDocument();
    expect(screen.getByText(/Explorar Fórum/i)).toBeInTheDocument();
  });

  it("não mostra link para o blog quando não logado", () => {
    mockAuth({ user: null, isLoading: false });
    render(<HeroCta />);
    expect(screen.queryByText(/Ir para o Blog/i)).toBeNull();
  });

  it("mostra links de blog e fórum quando logado", () => {
    mockAuth({ user: { id: "u1" }, isLoading: false });
    render(<HeroCta />);
    expect(screen.getByText(/Ir para o Blog/i)).toBeInTheDocument();
    expect(screen.getByText(/Explorar Fórum/i)).toBeInTheDocument();
  });

  it("não mostra link de criar conta quando logado", () => {
    mockAuth({ user: { id: "u1" }, isLoading: false });
    render(<HeroCta />);
    expect(screen.queryByText(/Criar Conta/i)).toBeNull();
  });
});
