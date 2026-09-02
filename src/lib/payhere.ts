import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

import { CURRENCY, money, type Money } from "@/lib/money";

/**
 * Everything this app knows about PayHere that is not a database write.
 *
 * One module, as the feature brief asks: the endpoint switch, the credentials,
 * the two hash formulas, the checkout payload and the meaning of a status code.
 * Nothing below touches Prisma — `src/server/payments.ts` owns the order rows,
 * and it calls into here for the arithmetic.
 *
 * ## Why `server-only` in `lib/`
 *
 * `src/lib/` is otherwise browser-safe, and this file breaks that on purpose.
 * `PAYHERE_MERCHANT_SECRET` is the single value that makes a forged payment
 * notification indistinguishable from a real one, and a stray import from a
 * Client Component is exactly how a secret ends up in a JavaScript bundle.
 * `server-only` turns that mistake into a build failure rather than a leak
 * nobody notices. The payload this module produces is meant to be posted from a
 * browser form and contains no secret — only a hash derived from one.
 *
 * ## Everything here is from the published spec
 *
 * Field names, the hash formulas and the status codes are PayHere's Checkout
 * API reference, not conventions invented here:
 * https://support.payhere.lk/api-&-mobile-sdk/checkout-api
 *
 * MD5 is not a defensible choice for a signature in 2026 — it is the algorithm
 * PayHere specifies, and interoperating means using theirs. What is in our gift
 * is comparing the digests in constant time, which {@link isValidNotifySignature}
 * does.
 */

/**
 * The two checkout endpoints, and the only two URLs in this codebase.
 *
 * Sandbox takes the test cards and moves no money; live takes real ones. The
 * pair lives here so that switching between them is one environment variable
 * rather than a search for hard-coded hosts.
 */
const SANDBOX_CHECKOUT_URL = "https://sandbox.payhere.lk/pay/checkout";
const LIVE_CHECKOUT_URL = "https://www.payhere.lk/pay/checkout";

/** Where PayHere posts the payment result. Mounted by `app/api/payments/…`. */
export const PAYHERE_NOTIFY_PATH = "/api/payments/payhere/notify";

/** Where the visitor lands after paying, and after abandoning. */
export function paymentReturnPath(orderNumber: string): string {
  return `/checkout/success/${orderNumber}`;
}

export function paymentCancelPath(orderNumber: string): string {
  return `/checkout/cancelled/${orderNumber}`;
}

/** The hand-off page that posts the form below. Also the "try again" target. */
export function paymentPath(orderNumber: string): string {
  return `/checkout/pay/${orderNumber}`;
}

/**
 * The store ships domestically only, and `country` is a required checkout
 * field. There is no column to read it from and inventing a country picker for
 * a one-country store would be worse than the constant.
 */
const PAYHERE_COUNTRY = "Sri Lanka";

export type PayHereConfig = {
  merchantId: string;
  merchantSecret: string;
  /** Sandbox or live, already decided. */
  checkoutUrl: string;
  /** Public origin PayHere redirects and calls back to, no trailing slash. */
  appUrl: string;
  isSandbox: boolean;
};

/**
 * Sandbox unless the environment says otherwise, in as many words.
 *
 * The default matters more than it looks. An unset or misspelled variable
 * resolving to *live* would mean a half-configured deployment quietly charging
 * real cards; resolving to sandbox means it quietly charges nothing. Only the
 * exact string `false` opts in to the live gateway, so going live is a
 * deliberate act rather than the consequence of a typo.
 */
function isSandboxMode(): boolean {
  return process.env.PAYHERE_SANDBOX !== "false";
}

/**
 * The configuration, or `null` if the environment is not set up for payments.
 *
 * Read inside the request rather than at module scope, for the reason
 * `app/api/uploadthing/route.ts` gives about its own token: `pnpm build` runs
 * on machines with no merchant account, and a module that throws on import
 * would fail the build rather than the payment. `null` lets the hand-off page
 * say "payments are not configured" and the webhook answer 500, both of which
 * are more useful than a stack trace.
 *
 * Which variables are missing is logged, never rendered — the list is a hint
 * about the deployment, and hints about the deployment belong in the logs.
 */
export function getPayHereConfig(): PayHereConfig | null {
  const merchantId = process.env.PAYHERE_MERCHANT_ID?.trim();
  const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET?.trim();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");

  const missing = [
    !merchantId && "PAYHERE_MERCHANT_ID",
    !merchantSecret && "PAYHERE_MERCHANT_SECRET",
    !appUrl && "NEXT_PUBLIC_APP_URL",
  ].filter((name): name is string => Boolean(name));

  if (!merchantId || !merchantSecret || !appUrl) {
    console.error(
      "PayHere is not configured. Missing environment variables: %s",
      missing.join(", "),
    );
    return null;
  }

  const isSandbox = isSandboxMode();

  return {
    merchantId,
    merchantSecret,
    appUrl,
    isSandbox,
    checkoutUrl: isSandbox ? SANDBOX_CHECKOUT_URL : LIVE_CHECKOUT_URL,
  };
}

/** `strtoupper(md5(x))`, the shape both PayHere formulas are built from. */
function md5Upper(value: string): string {
  return createHash("md5").update(value, "utf8").digest("hex").toUpperCase();
}

/**
 * The one formula both directions share:
 *
 *   `to_upper_case(md5(…fields + to_upper_case(md5(merchant_secret))))`
 *
 * The request hash concatenates merchant id, order id, amount and currency; the
 * notify signature is the same list with the status code appended. Writing it
 * once means the two can never drift into disagreeing about the secret's
 * casing, which is the part that is easy to get subtly wrong.
 */
function payHereHash(fields: readonly string[], merchantSecret: string): string {
  return md5Upper(fields.join("") + md5Upper(merchantSecret));
}

/**
 * Format money the way PayHere's own examples do: `number_format($x, 2, '.', '')`.
 *
 * Two decimal places, a dot, and no thousands separator. `Decimal.toFixed(2)`
 * produces exactly that from the stored `numeric(10, 2)` without ever becoming
 * a `number` — see the rule in `lib/money.ts`. The same string goes into the
 * hash and into the `amount` field, because the hash PayHere recomputes is over
 * what it received.
 */
export function formatGatewayAmount(value: Money): string {
  return value.toFixed(2);
}

/**
 * A gateway-supplied amount as exact money, or `null` if it is not a number.
 *
 * `payhere_amount` arrives as text on an HTTP request, so it is a claim about a
 * number rather than one. `Decimal` throws on anything it cannot parse, which
 * would turn a malformed webhook into a 500 and a retry loop; a `null` lets the
 * caller reject it as the bad request it is.
 */
export function parseGatewayAmount(value: string): Money | null {
  try {
    const parsed = money(value);

    // `Decimal` accepts `NaN` and `Infinity` as words. Neither is a payment.
    return parsed.isFinite() ? parsed : null;
  } catch {
    return null;
  }
}

export type PayHereCheckoutInput = {
  /** Our `Order.orderNumber`, sent as PayHere's `order_id`. */
  orderNumber: string;
  /** The stored order total. Never a figure the browser supplied. */
  total: Money;
  /** `items` — "Item title or Order/Invoice number" in the spec. */
  items: string;
  /** The order's shipping snapshot, plus the account's email. */
  customer: {
    fullName: string;
    email: string;
    phone: string;
    /** Address line 1 and line 2, already joined. */
    address: string;
    city: string;
  };
};

/**
 * `first_name` and `last_name` are both required, and we store one `shippingName`.
 *
 * Everything up to the last space is the first name, the last word is the
 * surname. A single-word name — common enough in Sri Lanka to be worth handling
 * rather than rejecting at checkout — repeats itself, because the alternative
 * is posting an empty required field and having PayHere refuse the payment.
 * Neither half is used for anything but the receipt PayHere prints: the order
 * is rendered from `shippingName`, which is untouched.
 */
function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  const lastName = parts.length > 1 ? parts[parts.length - 1] : parts[0];
  const firstName = parts.length > 1 ? parts.slice(0, -1).join(" ") : parts[0];

  return { firstName, lastName };
}

/**
 * The complete checkout form, ready to be posted to {@link PayHereConfig.checkoutUrl}.
 *
 * Every value is derived on the server from the stored `Order` row. Nothing
 * here is echoed back from a form the visitor filled in a moment ago, which is
 * what stops a browser deciding what its own order costs — the `hash` binds the
 * merchant id, order id, amount and currency together, and it cannot be
 * recomputed without the secret.
 *
 * Returned as a flat `Record` because that is what the hand-off page renders:
 * one `<input type="hidden">` per entry.
 */
export function buildCheckoutFields(
  config: PayHereConfig,
  input: PayHereCheckoutInput,
): Record<string, string> {
  const amount = formatGatewayAmount(input.total);
  const { firstName, lastName } = splitName(input.customer.fullName);

  return {
    merchant_id: config.merchantId,

    return_url: `${config.appUrl}${paymentReturnPath(input.orderNumber)}`,
    cancel_url: `${config.appUrl}${paymentCancelPath(input.orderNumber)}`,
    notify_url: `${config.appUrl}${PAYHERE_NOTIFY_PATH}`,

    order_id: input.orderNumber,
    items: input.items,
    currency: CURRENCY,
    amount,

    first_name: firstName,
    last_name: lastName,
    email: input.customer.email,
    phone: input.customer.phone,
    address: input.customer.address,
    city: input.customer.city,
    country: PAYHERE_COUNTRY,

    // `hash = to_upper_case(md5(merchant_id + order_id + amount + currency +
    // to_upper_case(md5(merchant_secret))))`. Mandatory since 2023-01-16.
    hash: payHereHash(
      [config.merchantId, input.orderNumber, amount, CURRENCY],
      config.merchantSecret,
    ),
  };
}

/**
 * The fields a notification is signed over, exactly as they arrived.
 *
 * `payhere_amount` is deliberately the raw received string and not a
 * re-formatted one: PayHere signed the characters it sent, so verifying against
 * anything we reconstructed would reject valid notifications the moment the two
 * spellings of a number disagreed. Checking that the number *means* the order
 * total is a separate step, and it happens after this one.
 */
export type PayHereNotifySignatureInput = {
  merchantId: string;
  orderId: string;
  amount: string;
  currency: string;
  statusCode: string;
};

/**
 * Was this notification signed with our merchant secret?
 *
 * `md5sig = strtoupper(md5(merchant_id + order_id + payhere_amount +
 * payhere_currency + status_code + strtoupper(md5(merchant_secret))))`.
 *
 * Compared with `timingSafeEqual` rather than `===`. A string comparison
 * returns as soon as two characters differ, and the time it took is a
 * measurable hint about how many leading characters were right — enough, over
 * many attempts, to walk a forged signature into place one character at a time.
 * The length is checked first because `timingSafeEqual` throws on mismatched
 * buffers, and a length is not a secret.
 */
export function isValidNotifySignature(
  merchantSecret: string,
  input: PayHereNotifySignatureInput,
  received: string,
): boolean {
  const expected = payHereHash(
    [
      input.merchantId,
      input.orderId,
      input.amount,
      input.currency,
      input.statusCode,
    ],
    merchantSecret,
  );

  const expectedBytes = Buffer.from(expected, "utf8");
  const receivedBytes = Buffer.from(received.trim().toUpperCase(), "utf8");
  if (expectedBytes.length !== receivedBytes.length) return false;

  return timingSafeEqual(expectedBytes, receivedBytes);
}

/**
 * PayHere's `status_code` values, from the spec's table.
 *
 * Strings, not numbers: they arrive as form fields and are concatenated into
 * the signature as text, so parsing them to a number and back is a round trip
 * with nothing to gain and a leading-zero question to answer.
 */
export const PAYHERE_STATUS_CODES = {
  SUCCESS: "2",
  PENDING: "0",
  CANCELED: "-1",
  FAILED: "-2",
  CHARGEDBACK: "-3",
} as const;

/**
 * What a status code means for the order, in this app's terms.
 *
 * `chargedback` is grouped with `failed` deliberately: both mean the shop is
 * not being paid for this order, and the response — release the stock, close
 * the order — is the same. A real chargeback also needs a human, which is what
 * the log line in the webhook is for.
 *
 * `unrecognised` exists because the list above is PayHere's today. A code we
 * have never seen must not be guessed into "paid".
 */
export type PaymentOutcome = "paid" | "pending" | "cancelled" | "unrecognised";

export function paymentOutcome(statusCode: string): PaymentOutcome {
  switch (statusCode) {
    case PAYHERE_STATUS_CODES.SUCCESS:
      return "paid";
    case PAYHERE_STATUS_CODES.PENDING:
      return "pending";
    case PAYHERE_STATUS_CODES.CANCELED:
    case PAYHERE_STATUS_CODES.FAILED:
    case PAYHERE_STATUS_CODES.CHARGEDBACK:
      return "cancelled";
    default:
      return "unrecognised";
  }
}
