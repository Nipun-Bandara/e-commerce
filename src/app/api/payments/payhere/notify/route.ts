import type { NextRequest } from "next/server";

import {
  getPayHereConfig,
  isValidNotifySignature,
  parseGatewayAmount,
  paymentOutcome,
} from "@/lib/payhere";
import { applyPayHereNotification } from "@/server/payments";

/**
 * PayHere's payment notification. The only thing in this app that marks an
 * order `PAID`.
 *
 * ## Why this and not the return URL
 *
 * When a payment is approved PayHere does two things: it redirects the
 * customer's browser to `return_url`, and it POSTs here from its own servers.
 * Only the second is evidence. The first is a URL anybody can type, arrives
 * from a machine we do not control, and would hand a free order to anyone who
 * guessed a number. So `/checkout/success/[orderNumber]` reads a status and
 * this route is what writes one.
 *
 * ## What is checked, in order
 *
 * Each step is cheaper than the one after it, and each is refused before any
 * work the next would waste:
 *
 *  1. **Shape.** The six signed fields must be present, form-encoded.
 *  2. **Merchant.** `merchant_id` must be ours. Strictly redundant — the
 *     signature below is computed with our secret and would fail anyway — but
 *     it turns a confusing signature failure into an accurate log line.
 *  3. **Signature.** `md5sig`, recomputed from the merchant secret. Everything
 *     after this point is trusted to have come from PayHere; nothing before it
 *     touches the database.
 *  4. **Money.** The amount and currency must equal the stored order total,
 *     checked inside the transaction in `server/payments.ts`.
 *
 * ## Status codes
 *
 * `200` for anything successfully processed, including a duplicate and an
 * unknown order — PayHere retries anything else, and retrying will not make an
 * order number exist. `400` for a request that was never valid: no signature
 * failure or wrong amount becomes correct on a second delivery. `500` only when
 * *we* are broken, which is the one case where a retry is worth having.
 *
 * ## Authentication
 *
 * There is none, and there must not be: PayHere's servers hold no session
 * cookie. The signature is the authentication. `src/proxy.ts` matches
 * `/account`, `/admin`, `/checkout`, `/login` and `/register` and nothing under
 * `/api/payments`, so this route is already outside it — see the note on the
 * matcher there before adding a broader pattern.
 */

/** The six fields the signature covers. Missing any one is a bad request. */
const SIGNED_FIELDS = [
  "merchant_id",
  "order_id",
  "payhere_amount",
  "payhere_currency",
  "status_code",
  "md5sig",
] as const;

type SignedField = (typeof SIGNED_FIELDS)[number];

/**
 * Read the signed fields, or `null` if any is absent.
 *
 * Values are taken exactly as received and never trimmed or normalised.
 * PayHere signed the characters it sent, so tidying one of them up before
 * hashing would reject perfectly valid notifications.
 */
function readSignedFields(form: FormData): Record<SignedField, string> | null {
  const fields = {} as Record<SignedField, string>;

  for (const name of SIGNED_FIELDS) {
    const value = form.get(name);
    if (typeof value !== "string" || value === "") return null;

    fields[name] = value;
  }

  return fields;
}

/** PayHere ignores the body; the status line is the whole answer. */
function reply(status: number, body: string): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

export async function POST(request: NextRequest): Promise<Response> {
  const config = getPayHereConfig();
  // `getPayHereConfig` has already logged which variables are missing. A 500
  // is right here where it would be wrong elsewhere: the notification may well
  // be genuine, and a retry after the deployment is fixed should be able to
  // land it.
  if (!config) return reply(500, "Payments are not configured");

  // "The request parameters are encoded in the 'application/x-www-form-urlencoded'
  // format, not 'application/json'." — the Checkout API reference. Anything
  // else throws, and is not a notification.
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    console.warn("PayHere notify: body was not form-encoded. Rejected.");
    return reply(400, "Expected form-encoded body");
  }

  const fields = readSignedFields(form);
  if (!fields) {
    console.warn("PayHere notify: missing required fields. Rejected.");
    return reply(400, "Missing required fields");
  }

  const {
    merchant_id: merchantId,
    order_id: orderNumber,
    payhere_amount: amountText,
    payhere_currency: currency,
    status_code: statusCode,
    md5sig: signature,
  } = fields;

  // Only ever logged, never trusted or stored — the schema has no column for it
  // and the brief does not ask for one. It is the reference a human needs when
  // one of the rejections below has to be explained to PayHere's support.
  const paymentId = form.get("payment_id");

  if (merchantId !== config.merchantId) {
    console.warn(
      "PayHere notify: merchant_id %s is not ours. Order %s, rejected.",
      merchantId,
      orderNumber,
    );
    return reply(400, "Unknown merchant");
  }

  if (
    !isValidNotifySignature(
      config.merchantSecret,
      {
        merchantId,
        orderId: orderNumber,
        amount: amountText,
        currency,
        statusCode,
      },
      signature,
    )
  ) {
    // The loudest line in this file. A signature that does not verify is either
    // a misconfigured secret or somebody trying to buy something for nothing,
    // and both are worth a person looking at.
    console.error(
      "PayHere notify: SIGNATURE MISMATCH for order %s (status_code %s, payment_id %s). Rejected — no order was changed.",
      orderNumber,
      statusCode,
      paymentId,
    );
    return reply(400, "Invalid signature");
  }

  const amount = parseGatewayAmount(amountText);
  if (!amount) {
    console.error(
      "PayHere notify: amount %s for order %s is not a number. Rejected.",
      amountText,
      orderNumber,
    );
    return reply(400, "Invalid amount");
  }

  const outcome = paymentOutcome(statusCode);
  if (outcome === "unrecognised") {
    // Not a rejection: the notification is genuine and correctly signed, we
    // simply do not know what the code means. Leaving the order alone and
    // answering 200 is safer than guessing, and stops a retry loop over
    // something no retry will clarify.
    console.warn(
      "PayHere notify: unrecognised status_code %s for order %s. Order left unchanged.",
      statusCode,
      orderNumber,
    );
  }

  const result = await applyPayHereNotification({
    orderNumber,
    outcome,
    amount,
    currency,
  });

  switch (result.status) {
    case "unknown-order":
      // 200, and nothing else. A 404 would confirm which order numbers exist to
      // anyone who has a valid signature for an amount — which, on a shared
      // sandbox merchant account, is not nobody.
      console.warn(
        "PayHere notify: no order %s. Acknowledged and ignored.",
        orderNumber,
      );
      return reply(200, "OK");

    case "amount-mismatch":
      console.error(
        "PayHere notify: AMOUNT MISMATCH for order %s — expected %s, notified %s (payment_id %s). Rejected — the order was not marked paid.",
        orderNumber,
        result.expected,
        result.received,
        paymentId,
      );
      return reply(400, "Amount does not match the order");

    case "paid":
      console.info(
        "PayHere notify: order %s paid (payment_id %s).",
        orderNumber,
        paymentId,
      );
      return reply(200, "OK");

    case "cancelled":
      console.info(
        "PayHere notify: order %s cancelled with status_code %s. Stock restored.",
        orderNumber,
        statusCode,
      );
      return reply(200, "OK");

    case "unchanged":
      if (outcome === "paid" && result.orderStatus === "CANCELLED") {
        // Money taken for an order that is no longer open — its owner cancelled
        // it, or a `failed` notification arrived first. Nothing automatic is
        // right here: reinstating it would resell stock that has been put back,
        // and staying quiet would lose a payment. So it is logged as the
        // refund conversation it is.
        console.error(
          "PayHere notify: order %s was paid (payment_id %s) but is CANCELLED. Needs a manual refund.",
          orderNumber,
          paymentId,
        );
      } else {
        console.info(
          "PayHere notify: order %s is already %s. Nothing to do.",
          orderNumber,
          result.orderStatus,
        );
      }

      return reply(200, "OK");
  }
}
