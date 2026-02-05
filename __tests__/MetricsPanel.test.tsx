import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import MetricsPanel from "@/components/MetricsPanel";

afterEach(() => {
  cleanup();
});

describe("MetricsPanel", () => {
  it("renders LOC, delta, file count, test count, and green coverage", () => {
    render(<MetricsPanel totalLoc={12345} startLoc={12000} fileCount={321} testCount={48} coveragePct={92.4} />);

    expect(screen.getByText("12,345")).toBeInTheDocument();
    expect(screen.getByText("+345 from start")).toBeInTheDocument();
    expect(screen.getByText("321")).toBeInTheDocument();
    expect(screen.getByText("48")).toBeInTheDocument();

    const coverage = screen.getByLabelText("Coverage percentage");
    expect(coverage).toHaveTextContent("92%");
    expect(coverage).toHaveClass("text-green-700");
  });

  it("shows no baseline message when start LOC is unavailable", () => {
    render(<MetricsPanel totalLoc={500} startLoc={null} fileCount={20} testCount={10} coveragePct={70} />);

    expect(screen.getByText("500")).toBeInTheDocument();
    expect(screen.getByText("No baseline available")).toBeInTheDocument();

    const coverage = screen.getByLabelText("Coverage percentage");
    expect(coverage).toHaveTextContent("70%");
    expect(coverage).toHaveClass("text-amber-700");
  });

  it("shows negative delta and red coverage for low percentages", () => {
    render(<MetricsPanel totalLoc={780} startLoc={1000} fileCount={14} testCount={6} coveragePct={33.8} />);

    expect(screen.getByText("-220 from start")).toBeInTheDocument();

    const coverage = screen.getByLabelText("Coverage percentage");
    expect(coverage).toHaveTextContent("34%");
    expect(coverage).toHaveClass("text-red-700");
  });
});
