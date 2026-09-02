import { generateReactHelpers } from "@uploadthing/react";

import type { UploadRouter } from "@/server/uploadthing";

/**
 * The typed client for the upload endpoint.
 *
 * `UploadRouter` is imported with `import type`, so TypeScript erases the line
 * entirely and the `server-only` module it names never reaches the browser
 * bundle. What survives is the shape: `useUploadThing("productImage", …)` knows
 * which endpoints exist and what each resolves with, so a renamed route is a
 * compile error rather than a 404 at upload time.
 *
 * Only `useUploadThing` is re-exported. The generator also returns
 * `uploadFiles`, `createUpload` and a route registry; exporting helpers nothing
 * calls would be three more ways to upload a file and three more things to keep
 * working.
 *
 * The prebuilt `<UploadButton>` and `<UploadDropzone>` are deliberately not
 * used. The image panel is not just a file picker — it reorders, removes and
 * marks a primary image — so it owns its own markup, and the hook is the part
 * of the library that does the work that is actually hard.
 */
export const { useUploadThing } = generateReactHelpers<UploadRouter>();
