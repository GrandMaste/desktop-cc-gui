// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoadingProgressDialog } from "./LoadingProgressDialog";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

afterEach(() => {
  cleanup();
});

describe("LoadingProgressDialog", () => {
  it("renders title and message", () => {
    render(
      <LoadingProgressDialog
        title="Creating session..."
        message="Preparing workspace"
        onClose={() => undefined}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Creating session..." })).toBeTruthy();
    expect(screen.getByText("Preparing workspace")).toBeTruthy();
  });

  it("closes from the x button and Escape key", () => {
    const onClose = vi.fn();
    render(
      <LoadingProgressDialog
        title="Adding project..."
        message="Opening window"
        onClose={onClose}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "workspace.loadingProgressRunInBackground",
      }),
    );
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
