import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// Auto-cleanup only registers itself when vitest runs with `globals: true`,
// which this project does not. Without this, renders leak between tests and
// every `getByRole` finds the previous test's DOM as well.
afterEach(cleanup);

process.env.NEXT_PUBLIC_API_URL ??= "http://localhost:8000/api/v1";
process.env.NEXT_PUBLIC_WS_URL ??= "ws://localhost:8000/realtime";
process.env.NEXT_PUBLIC_APP_ENV ??= "development";
process.env.NEXT_PUBLIC_USE_MOCKS ??= "true";
