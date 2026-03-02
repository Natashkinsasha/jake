import { render } from "@testing-library/react";
import { ProgressBar } from "./ProgressBar";

describe("ProgressBar", () => {
  it("renders with correct width percentage", () => {
    const { container } = render(<ProgressBar value={50} max={100} />);
    const bar = container.querySelector("[style]");
    expect(bar).toHaveStyle({ width: "50%" });
  });

  it("clamps at 100%", () => {
    const { container } = render(<ProgressBar value={150} max={100} />);
    const bar = container.querySelector("[style]");
    expect(bar).toHaveStyle({ width: "100%" });
  });

  it("clamps at 0%", () => {
    const { container } = render(<ProgressBar value={-10} max={100} />);
    const bar = container.querySelector("[style]");
    expect(bar).toHaveStyle({ width: "0%" });
  });

  it("applies custom color", () => {
    const { container } = render(<ProgressBar value={50} color="bg-green-500" />);
    const bar = container.querySelector("[style]");
    expect(bar?.className).toContain("bg-green-500");
  });
});
