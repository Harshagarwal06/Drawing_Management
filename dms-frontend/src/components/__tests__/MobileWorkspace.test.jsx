import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import AppShell from "../AppShell";
import MasterRegisterTable from "../MasterRegisterTable";
import MobileBottomNav from "../MobileBottomNav";

const projectA = { id: 1, code: "UP-101", name: "UP-101 — North Tower" };
const projectB = { id: 2, code: "UP-202", name: "UP-202 — South Tower" };

describe("mobile workspace navigation", () => {
  it("shows the director routes and More menu actions", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <MobileBottomNav isDirector onLogout={vi.fn()} />
      </MemoryRouter>,
    );

    const nav = screen.getByRole("navigation", { name: "Mobile navigation" });
    expect(within(nav).getByText("Home")).toBeInTheDocument();
    expect(within(nav).getByText("Documents")).toBeInTheDocument();
    expect(within(nav).getByText("Register")).toBeInTheDocument();
    expect(within(nav).getByText("Transmittals")).toBeInTheDocument();

    fireEvent.click(within(nav).getByRole("button", { name: "More" }));
    expect(screen.getByRole("dialog", { name: "More" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Install DrawVault/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sign out/ })).toBeInTheDocument();
  });

  it("keeps Project Team navigation scoped while retaining install and sign-out access", () => {
    render(
      <MemoryRouter initialEntries={["/documents"]}>
        <MobileBottomNav isDirector={false} onLogout={vi.fn()} />
      </MemoryRouter>,
    );
    const nav = screen.getByRole("navigation", { name: "Mobile navigation" });
    expect(within(nav).getByText("Documents")).toBeInTheDocument();
    expect(within(nav).getByText("Settings")).toBeInTheDocument();
    expect(within(nav).queryByText("Analytics")).not.toBeInTheDocument();
    fireEvent.click(within(nav).getByRole("button", { name: "More" }));
    const sheet = screen.getByRole("dialog", { name: "More" });
    expect(within(sheet).getByRole("button", { name: /Install DrawVault/ })).toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: /Sign out/ })).toBeInTheDocument();
    expect(within(sheet).queryByRole("button", { name: /Analytics/ })).not.toBeInTheDocument();
  });

  it("switches the active project from the phone top bar", () => {
    const onProjectChange = vi.fn();
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route
            element={
              <AppShell
                currentUser={{ name: "Project Director" }}
                onLogout={vi.fn()}
                activeProject={projectA}
                projects={[projectA, projectB]}
                isDirector
                isProjectTeam={false}
                mobileNavOpen={false}
                setMobileNavOpen={vi.fn()}
                onProjectChange={onProjectChange}
                onNewProject={vi.fn()}
              />
            }
          >
            <Route path="/dashboard" element={<p>Dashboard content</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Switch project/ }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: /UP-202/ }));
    expect(onProjectChange).toHaveBeenCalledWith(projectB);
  });
});

describe("mobile drawing register", () => {
  it("renders a labelled phone card with direct file actions", () => {
    const drawing = {
      id: 7,
      number: "A-101",
      title: "Ground Floor Plan",
      discipline: "Architecture",
      rev: "B",
      status: "S3",
      issueDate: "2026-07-15",
      originator: "Design Office",
      path: "/uploads/A-101.pdf",
    };
    const { container } = render(
      <MemoryRouter>
        <MasterRegisterTable
          drawings={[drawing]}
          allDrawings={[drawing]}
          total={1}
          page={1}
          totalPages={1}
          onSearch={vi.fn()}
          onFilterStat={vi.fn()}
          onFilterDisc={vi.fn()}
          onSort={vi.fn()}
        />
      </MemoryRouter>,
    );

    const card = container.querySelector("article");
    expect(card).not.toBeNull();
    expect(within(card).getByRole("heading", { name: "A-101" })).toBeInTheDocument();
    expect(within(card).getByText("Ground Floor Plan")).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Open" })).toBeEnabled();
    expect(within(card).getByRole("button", { name: "Download" })).toBeEnabled();
  });
});
