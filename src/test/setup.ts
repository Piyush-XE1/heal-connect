import "@testing-library/jest-dom/vitest";

// jsdom does not implement smooth scrolling, which the wizard uses to move
// between steps.
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

/**
 * Shared test setup. DOM suites run in jsdom; the backend integration suite
 * opts into the node environment, where `window` does not exist.
 */
if (typeof window !== "undefined") {
  Object.defineProperty(window, "scrollTo", {
    writable: true,
    value: () => {},
  });

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    }),
  });
}

// jsdom lacks the observer and pointer APIs that Radix primitives expect.
if (typeof window !== "undefined") {
  class StubObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }

  for (const name of ["ResizeObserver", "IntersectionObserver", "MutationObserver"]) {
    if (!(name in window)) {
      Object.defineProperty(window, name, { writable: true, value: StubObserver });
    }
  }

  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
  }
}
