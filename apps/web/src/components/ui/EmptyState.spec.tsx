import { render, screen } from "@testing-library/react";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renders icon, title and description", () => {
    render(
      <EmptyState icon="📚" title="No items" description="Nothing here yet" />
    );
    expect(screen.getByText("📚")).toBeInTheDocument();
    expect(screen.getByText("No items")).toBeInTheDocument();
    expect(screen.getByText("Nothing here yet")).toBeInTheDocument();
  });

  it("renders action link when provided", () => {
    render(
      <EmptyState
        icon="📚"
        title="No items"
        description="Nothing here"
        action={{ label: "Add item", href: "/add" }}
      />
    );
    const link = screen.getByText("Add item");
    expect(link).toBeInTheDocument();
    expect(link.closest("a")).toHaveAttribute("href", "/add");
  });

  it("does not render action when not provided", () => {
    render(
      <EmptyState icon="📚" title="No items" description="Nothing here" />
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
