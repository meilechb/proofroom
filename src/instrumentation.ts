import type { Instrumentation } from "next";

/**
 * Runs once per server instance. Nothing to register yet; kept so
 * onRequestError below is picked up (Next only loads this file when it exists).
 */
export async function register() {}

/**
 * Every uncaught server error (render, route handler, Server Action, proxy)
 * becomes one structured JSON line. Vercel's runtime logs (and a log drain,
 * when one is attached) can then filter on event=server_error. Headers are
 * not logged: they can carry cookies and tokens.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const message = error instanceof Error ? error.message : String(error);
  const digest = typeof error === "object" && error !== null && "digest" in error ? String((error as { digest: unknown }).digest) : undefined;
  const stack = error instanceof Error && process.env.NODE_ENV !== "production" ? error.stack : undefined;
  console.error(
    JSON.stringify({
      level: "error",
      event: "server_error",
      time: new Date().toISOString(),
      message,
      digest,
      method: request.method,
      path: request.path,
      routePath: context.routePath,
      routeType: context.routeType,
      renderSource: context.renderSource,
      stack,
    })
  );
};
