import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";

import { ThemeProvider, useTheme } from "@/components/theme-provider";

function Consumer() {
  const { theme, setTheme, toggleTheme } = useTheme();
  return (
    <div>
      <div data-testid="theme">{theme}</div>
      <button type="button" onClick={() => setTheme("light")}>
        light
      </button>
      <button type="button" onClick={() => setTheme("dark")}>
        dark
      </button>
      <button type="button" onClick={() => setTheme("system")}>
        system
      </button>
      <button type="button" onClick={() => toggleTheme()}>
        toggle
      </button>
    </div>
  );
}

describe("ThemeProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  it("restaura tema salvo e aplica data-theme", async () => {
    window.localStorage.setItem("raven.theme", "dark");
    render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>
    );

    await waitFor(() => expect(screen.getByTestId("theme")).toHaveTextContent("dark"));
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("setTheme persiste e aplica data-theme", async () => {
    render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>
    );

    await act(async () => {
      screen.getByRole("button", { name: "light" }).click();
    });

    expect(window.localStorage.getItem("raven.theme")).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("system resolve data-theme a partir da preferência do SO", async () => {
    window.localStorage.setItem("raven.theme", "dark");
    render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>
    );

    await waitFor(() => expect(document.documentElement.dataset.theme).toBe("dark"));

    await act(async () => {
      screen.getByRole("button", { name: "system" }).click();
    });

    expect(window.localStorage.getItem("raven.theme")).toBe("system");
    // applyTheme always resolves "system" to the OS preference and writes it.
    // In JSDOM matchMedia("prefers-color-scheme: dark").matches === false → "light".
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});

