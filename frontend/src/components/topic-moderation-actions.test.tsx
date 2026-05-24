import React from "react";
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

import { TopicModerationActions } from "@/components/topic-moderation-actions";

const mockRefresh = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

describe("TopicModerationActions", () => {
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

    render(<TopicModerationActions slug="t1" isPinned={false} isLocked={false} status="open" />);
    expect(screen.queryByText("Moderação")).toBeNull();
  });

  it("renderiza para moderador", async () => {
    const auth = await import("@/components/auth-provider");
    vi.spyOn(auth, "useAuth").mockReturnValue({
      user: { id: "u1", is_forum_moderator: true },
      isLoading: false,
      login: async () => ({ ok: true }),
      register: async () => ({ ok: true }),
      logout: async () => {},
      refreshSession: async () => {},
    });

    render(<TopicModerationActions slug="t1" isPinned={false} isLocked={false} status="open" />);
    expect(screen.getByText("Moderação")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fixar" })).toBeInTheDocument();
  });
});

