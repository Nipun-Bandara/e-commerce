import "server-only";

import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";

import { MAX_PRODUCT_IMAGES } from "@/lib/product-schemas";
import { getCurrentUser } from "@/server/auth";

/**
 * Where product images go.
 *
 * UploadThing is a signed-upload service: the browser asks this endpoint for
 * permission, gets a short-lived URL, and uploads straight to storage. The file
 * never passes through the Next server, which is why a 4 MB photo does not need
 * a 4 MB Server Action body.
 *
 * The consequence worth understanding is that `middleware` below is the *only*
 * authorisation. It runs before the presigned URL is handed out; once the
 * browser has that URL the upload is already permitted. There is no second
 * check at `onUploadComplete` that could take it back.
 */

/**
 * 4 MB is comfortable for product photography and well inside the free tier.
 * The count matches `MAX_PRODUCT_IMAGES`, which the form and the Zod schema
 * also enforce — three checks on the same number, which is why it is a
 * constant in one place rather than the literal `8` in three files.
 */
const MAX_IMAGE_SIZE = "4MB" as const;

const f = createUploadthing();

export const uploadRouter = {
  productImage: f({
    image: {
      maxFileSize: MAX_IMAGE_SIZE,
      maxFileCount: MAX_PRODUCT_IMAGES,
    },
  })
    /**
     * The gate. A signed-in USER gets a 403 here, not an upload.
     *
     * **Why not `requireAdmin`.** That helper answers with `forbidden()` and
     * `redirect()`, which are Next navigation signals: they are how you refuse
     * someone who is *looking at a page*. Thrown inside this middleware they
     * would escape as an unhandled error and the browser would be told the
     * upload failed for an unknown reason. `UploadThingError` is the same
     * refusal in the vocabulary this endpoint speaks — the client sees
     * "Unauthorized", and no presigned URL is issued.
     *
     * The role is read from the session token, which is what `getCurrentUser`
     * returns. An admin demoted since their last sign-in would still pass here
     * until the token is reissued; the cost of that is an uploaded image, not a
     * write to the catalogue, and every write in `admin-product-actions.ts` is
     * checked separately.
     */
    .middleware(async () => {
      const user = await getCurrentUser();

      if (!user) {
        throw new UploadThingError("You must be signed in to upload images.");
      }
      if (user.role !== "ADMIN") {
        throw new UploadThingError("Only administrators can upload images.");
      }

      // Whatever is returned here reaches `onUploadComplete` as `metadata`.
      // The id is enough to attribute an upload if that is ever needed.
      return { userId: user.id };
    })
    /**
     * Runs on this server after the file lands in storage.
     *
     * Nothing is written to the database here, and that is deliberate. An
     * upload is not a product: the admin may still reorder the images, remove
     * this one, or close the tab without saving. The URL goes back to the form,
     * and the row is written when the form is submitted — by
     * `createProduct`/`updateProduct`, in one transaction with the product
     * itself.
     *
     * The return value is what `startUpload` resolves with on the client.
     * `ufsUrl` is the current field; `url` and `appUrl` are its deprecated
     * predecessors.
     */
    .onUploadComplete(async ({ file }) => ({ url: file.ufsUrl })),
} satisfies FileRouter;

export type UploadRouter = typeof uploadRouter;
