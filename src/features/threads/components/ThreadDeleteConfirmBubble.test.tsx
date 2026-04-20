// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ThreadDeleteConfirmBubble } from "./ThreadDeleteConfirmBubble";

describe("ThreadDeleteConfirmBubble", () => {
  it("renders translated deleting label while deletion is in progress", () => {
    render(
      <ThreadDeleteConfirmBubble
        threadName="hi123"
        isDeleting
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Deleting…" }).hasAttribute("disabled"),
    ).toBe(true);
  });
});
