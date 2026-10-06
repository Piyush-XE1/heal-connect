import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RequestForm } from "@/components/requests/request-form";

/**
 * The wizard is driven end-to-end through the real component: navigation
 * gating, per-step validation, draft saving and publishing all run in jsdom so
 * regressions show up without a browser or a server.
 */
const mocks = vi.hoisted(() => ({
  createRequest: vi.fn(),
  createRequestDraft: vi.fn(),
  updateRequest: vi.fn(),
  updateRequestStatus: vi.fn(),
}));

vi.mock("@/server/api/requests", () => ({
  createRequest: mocks.createRequest,
  createRequestDraft: mocks.createRequestDraft,
  updateRequest: mocks.updateRequest,
  updateRequestStatus: mocks.updateRequestStatus,
}));

const futureDate = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);

const completeDefaults = {
  requestType: "blood" as const,
  bloodGroup: "O+" as const,
  unitsRequired: 2,
  hospitalName: "Sunrise Multispeciality Hospital",
  city: "Delhi",
  area: "Saket",
  requiredBy: futureDate,
  urgency: "urgent" as const,
  additionalInfo: "Ward 4, transfusion desk, 9 AM to 6 PM.",
  contactName: "Asha Verma",
  contactPhone: "9876543210",
  contactInstructions: "Call after 8 AM.",
  consent: true as const,
};

async function renderWizard(props: Parameters<typeof RequestForm>[0]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const rootRoute = createRootRoute({ component: () => <RequestForm {...props} /> });
  const stubs = ["/requests/$requestId", "/my-requests", "/dashboard"].map((path) =>
    createRoute({ getParentRoute: () => rootRoute, path, component: () => null }),
  );
  const router = createRouter({
    routeTree: rootRoute.addChildren(stubs),
    history: createMemoryHistory({ initialEntries: ["/"] }),
    context: { queryClient },
  });

  await router.load();

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  return router;
}

const step = () => Number(screen.getByRole("progressbar").getAttribute("aria-valuenow"));

async function advance() {
  fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));
}

describe("request wizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("walks the six steps and publishes with the collected payload", async () => {
    mocks.createRequest.mockResolvedValue({
      ok: true,
      data: { id: "req_new", reference: "REQ-2000" },
    });

    await renderWizard({ mode: "create", defaults: completeDefaults });

    expect(step()).toBe(1);
    await advance();
    await waitFor(() => expect(step()).toBe(2));
    await advance();
    await waitFor(() => expect(step()).toBe(3));
    await advance();
    await waitFor(() => expect(step()).toBe(4));
    await advance();
    await waitFor(() => expect(step()).toBe(5));
    await advance();
    await waitFor(() => expect(step()).toBe(6));

    // The review step summarises what will be published.
    expect(screen.getByText("Sunrise Multispeciality Hospital, Delhi")).toBeInTheDocument();
    expect(screen.getByText("Urgent")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /publish request/i }));

    await waitFor(() => expect(mocks.createRequest).toHaveBeenCalledTimes(1));
    const payload = mocks.createRequest.mock.calls[0]?.[0]?.data;
    expect(payload).toMatchObject({
      requestType: "blood",
      bloodGroup: "O+",
      unitsRequired: 2,
      hospitalName: "Sunrise Multispeciality Hospital",
      city: "Delhi",
      area: "Saket",
      urgency: "urgent",
      contactName: "Asha Verma",
      contactPhone: "9876543210",
      consent: true,
    });

    // Post-submit summary instead of a silent redirect.
    expect(await screen.findByText(/request published/i)).toBeInTheDocument();
    expect(screen.getByText(/REQ-2000/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view request details/i })).toBeInTheDocument();
  });

  it("blocks an incomplete step and keeps the user on it", async () => {
    await renderWizard({ mode: "create" });

    await advance();
    await waitFor(() => expect(step()).toBe(2));
    await advance();

    expect(await screen.findByText(/select the blood group needed/i)).toBeInTheDocument();
    expect(step()).toBe(2);
    expect(mocks.createRequest).not.toHaveBeenCalled();
  });

  it("saves a private draft and publishes it from the summary", async () => {
    mocks.createRequestDraft.mockResolvedValue({
      ok: true,
      data: { id: "req_draft", reference: "REQ-2001", draft: true },
    });
    mocks.updateRequestStatus.mockResolvedValue({ ok: true, data: { status: "open" } });

    await renderWizard({
      mode: "create",
      defaults: { hospitalName: "Draft Clinic", city: "Delhi", contactName: "Asha" },
    });

    fireEvent.click(screen.getByRole("button", { name: /save as draft/i }));

    await waitFor(() => expect(mocks.createRequestDraft).toHaveBeenCalledTimes(1));
    expect(mocks.createRequestDraft.mock.calls[0]?.[0]?.data).toMatchObject({
      hospitalName: "Draft Clinic",
      city: "Delhi",
    });

    expect(await screen.findByText(/draft saved/i)).toBeInTheDocument();
    expect(screen.getByText(/private draft/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /publish now/i }));
    await waitFor(() =>
      expect(mocks.updateRequestStatus).toHaveBeenCalledWith({
        data: { id: "req_draft", status: "open" },
      }),
    );
    expect(await screen.findByText(/request published/i)).toBeInTheDocument();
  });

  it("surfaces server field errors on the step that owns them", async () => {
    mocks.createRequest.mockResolvedValue({
      ok: false,
      message: "Please check the highlighted fields.",
      fields: { city: "We could not find that city." },
    });

    await renderWizard({ mode: "create", defaults: completeDefaults });

    for (let index = 0; index < 5; index += 1) {
      await advance();
      await waitFor(() => expect(step()).toBe(index + 2));
    }

    fireEvent.click(screen.getByRole("button", { name: /publish request/i }));

    expect(await screen.findByText(/we could not find that city/i)).toBeInTheDocument();
    // The wizard returns to the location step so the field is visible.
    await waitFor(() => expect(step()).toBe(3));
  });
});
