// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useLoadingProgressDialogState } from "./useLoadingProgressDialogState";

describe("useLoadingProgressDialogState", () => {
  it("keeps the dialog dismissed for current requests but reopens for a new request", () => {
    const { result } = renderHook(() => useLoadingProgressDialogState());

    let firstRequestId = "";
    act(() => {
      firstRequestId = result.current.showLoadingProgressDialog({
        title: "first-title",
        message: "first-message",
      });
    });

    expect(result.current.loadingProgressDialog).toEqual({
      title: "first-title",
      message: "first-message",
    });

    act(() => {
      result.current.dismissLoadingProgressDialog();
    });

    expect(result.current.loadingProgressDialog).toBeNull();

    act(() => {
      result.current.hideLoadingProgressDialog(firstRequestId);
    });

    expect(result.current.loadingProgressDialog).toBeNull();

    act(() => {
      result.current.showLoadingProgressDialog({
        title: "second-title",
        message: "second-message",
      });
    });

    expect(result.current.loadingProgressDialog).toEqual({
      title: "second-title",
      message: "second-message",
    });
  });
});
