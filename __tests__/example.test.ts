import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("example test", () => {
  it("renders content in the document", () => {
    render(React.createElement("div", null, "Ralph is running"));

    expect(screen.getByText("Ralph is running")).toBeInTheDocument();
  });
});
