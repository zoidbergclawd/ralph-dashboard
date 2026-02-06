import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import PRDEditor from "@/components/PRDEditor";
import type { PRDDocument } from "@/lib/ralph-state";

function makeGetResponse(prd: PRDDocument): Response {
  return {
    ok: true,
    json: async () => ({
      path: "/tmp/project/prd.json",
      prd,
    }),
  } as Response;
}

function makePostResponse(prd: PRDDocument): Response {
  return {
    ok: true,
    json: async () => ({
      ok: true,
      path: "/tmp/project/prd.json",
      prd,
    }),
  } as Response;
}

function baseDocument(): PRDDocument {
  return {
    project: "Ralph Mission Control",
    goal: "Upgrade the dashboard",
    items: [
      {
        id: 1,
        category: "ui",
        title: "Existing Item",
        description: "Existing description",
        priority: 1,
        passes: false,
        verification: "Checks pass",
        steps: ["Step A"],
        notes: "",
      },
      {
        id: 2,
        category: "backend",
        title: "Second Item",
        description: "Second description",
        priority: 2,
        passes: false,
        verification: "API updated",
        steps: ["Step B"],
        notes: "",
      },
    ],
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("PRDEditor", () => {
  it("edits an item and persists the updated fields", async () => {
    const document = baseDocument();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(makeGetResponse(document))
      .mockResolvedValueOnce(makePostResponse(document));

    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<PRDEditor projectPath="/tmp/project" />);

    const titleInput = await screen.findByDisplayValue("Existing Item");
    await user.clear(titleInput);
    await user.type(titleInput, "Edited Item");

    const descriptionInput = screen.getByDisplayValue("Existing description");
    await user.clear(descriptionInput);
    await user.type(descriptionInput, "Edited description");

    const stepsInput = screen.getByDisplayValue("Step A");
    fireEvent.change(stepsInput, { target: { value: "Step 1\nStep 2" } });

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/prd?projectPath=%2Ftmp%2Fproject",
      { cache: "no-store" },
    );

    const postCall = fetchMock.mock.calls[1];
    expect(postCall?.[0]).toBe("/api/prd?projectPath=%2Ftmp%2Fproject");

    const postInit = postCall?.[1] as RequestInit;
    expect(postInit.method).toBe("POST");

    const body = JSON.parse(String(postInit.body)) as PRDDocument;
    expect(body.items[0]?.title).toBe("Edited Item");
    expect(body.items[0]?.description).toBe("Edited description");
    expect(body.items[0]?.steps).toEqual(["Step 1", "Step 2"]);

    expect(await screen.findByText("Saved PRD changes.")).toBeInTheDocument();
  });

  it("adds, deletes, and reorders items before saving", async () => {
    const document = baseDocument();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(makeGetResponse(document))
      .mockResolvedValueOnce(makePostResponse(document));

    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<PRDEditor projectPath="/tmp/project" />);

    await screen.findByText("Existing Item");

    await user.click(screen.getByRole("button", { name: "Add item" }));

    const titleInput = screen.getByDisplayValue("New item");
    await user.clear(titleInput);
    await user.type(titleInput, "Third Item");

    const thirdRow = screen.getByTestId("item-row-3");
    const firstRow = screen.getByTestId("item-row-1");

    fireEvent.dragStart(thirdRow);
    fireEvent.dragOver(firstRow);
    fireEvent.drop(firstRow);
    fireEvent.dragEnd(thirdRow);

    const itemList = firstRow.closest("ul");
    expect(itemList).not.toBeNull();
    const listItems = within(itemList as HTMLUListElement).getAllByRole("listitem");
    expect(within(listItems[0] as HTMLLIElement).getByText("Third Item")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /third item/i }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(screen.queryByText("Third Item")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    const postCall = fetchMock.mock.calls[1];
    const postInit = postCall?.[1] as RequestInit;
    const body = JSON.parse(String(postInit.body)) as PRDDocument;

    expect(body.items.map((item) => item.id)).toEqual([1, 2]);
  });
});
