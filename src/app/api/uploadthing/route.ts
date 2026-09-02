import { createRouteHandler } from "uploadthing/next";

import { uploadRouter } from "@/server/uploadthing";

/**
 * The two endpoints UploadThing's client talks to.
 *
 * `POST` is the one that matters: it runs the router's middleware and, if that
 * middleware allows it, hands back a presigned URL. `GET` serves the route
 * config so the client knows the size and count limits before it tries.
 *
 * `UPLOADTHING_TOKEN` is read from the environment on demand, inside the
 * request — not when this module is imported. That is what lets `pnpm build`
 * succeed on a machine with no UploadThing account: without a token this route
 * exists and answers with a "missing token" error when called, and the admin
 * form never calls it, because it renders the paste-a-URL fallback instead.
 * See `ProductImageManager`.
 */
export const { GET, POST } = createRouteHandler({ router: uploadRouter });
