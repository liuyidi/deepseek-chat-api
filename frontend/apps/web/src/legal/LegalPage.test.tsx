import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LegalPage } from "./LegalPage";

describe("LegalPage", () => {
  it("renders the privacy policy in Chinese by default for zh browsers", () => {
    vi.stubGlobal("navigator", { ...navigator, language: "zh-CN" });
    render(<LegalPage documentId="privacy" />);

    expect(screen.getByRole("heading", { name: "隐私政策" })).toBeInTheDocument();
    expect(screen.getByText(/Mini Auth（auth\.liuyidi\.me）/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "查看服务条款" })).toHaveAttribute("href", "/terms");
  });

  it("switches to English terms content", async () => {
    const user = userEvent.setup();
    render(<LegalPage documentId="terms" />);

    await user.click(screen.getByRole("button", { name: "EN" }));

    expect(screen.getByRole("heading", { name: "Terms of Service" })).toBeInTheDocument();
    expect(screen.getByText(/Mini Auth provides unified registration/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy");
  });
});
