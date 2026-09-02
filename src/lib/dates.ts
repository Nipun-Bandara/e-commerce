/**
 * Dates, formatted the one way this store formats them.
 *
 * The store ships from Colombo, so the day an order was placed on is the day it
 * was there — not the day it was wherever the server happens to run, which for
 * a late-evening order is often a different one. Pinning the zone means the
 * confirmation page, the order list and the order detail cannot disagree about
 * what day something happened, and that a deploy to another region does not
 * silently move every date in the history.
 *
 * `Intl.DateTimeFormat` is safe here in a way it is not for money: it is given
 * a `Date`, not a `Decimal`, so there is no float round-trip to worry about.
 */

const ORDER_DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "long",
  timeZone: "Asia/Colombo",
});

/** The day an order was placed, e.g. `2 September 2026`. */
export function formatOrderDate(date: Date): string {
  return ORDER_DATE_FORMAT.format(date);
}
