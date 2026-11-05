import { render, screen, fireEvent } from "@testing-library/react";
import { act } from "react";
import Dashboard from "./dashboard";

jest.mock("@/lib/api", () => ({
  api: jest.fn(),
}));

import { api } from "@/lib/api";

describe("Dashboard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders dashboard title", async () => {
    (api as jest.Mock).mockResolvedValue({ id: "user1", email: "test@example.com", name: "Test" });
    (api as jest.Mock).mockResolvedValueOnce([]);
    (api as jest.Mock).mockResolvedValueOnce([]);
    (api as jest.Mock).mockResolvedValueOnce([]);

    render(<Dashboard />);

    expect(await screen.findByText("Dashboard")).toBeInTheDocument();
  });

  it("creates a document", async () => {
    const newDoc = { id: "doc1", title: "New Doc", content: { blocks: [] }, status: "draft" };
    (api as jest.Mock).mockResolvedValue({ id: "user1", email: "test@example.com", name: "Test" });
    (api as jest.Mock).mockResolvedValueOnce([]);
    (api as jest.Mock).mockResolvedValueOnce([]);
    (api as jest.Mock).mockResolvedValueOnce([]);
    (api as jest.Mock).mockResolvedValueOnce(newDoc);

    render(<Dashboard />);

    const titleInput = await screen.findByPlaceholderText("Document title");
    await fireEvent.change(titleInput, { target: { value: "New Doc" } });

    const createBtn = screen.getByText("Create");
    await fireEvent.click(createBtn);

    await screen.findByText("New Doc");
    expect(api).toHaveBeenCalledWith("/api/v1/documents", {
      method: "POST",
      body: JSON.stringify({ title: "New Doc", content: { blocks: [] } }),
    });
  });
});
