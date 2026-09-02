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

const ORDER_DATE_TIME_FORMAT = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Asia/Colombo",
});

/** The day an order was placed, e.g. `2 September 2026`. */
export function formatOrderDate(date: Date): string {
  return ORDER_DATE_FORMAT.format(date);
}

/**
 * Day and time, e.g. `2 September 2026 at 14:05`.
 *
 * For the admin's "last updated", where the day alone is not enough: a status
 * moved through three stages in an afternoon needs the clock to be legible.
 */
export function formatOrderDateTime(date: Date): string {
  return ORDER_DATE_TIME_FORMAT.format(date);
}

/**
 * Colombo's offset from UTC, as an ISO 8601 suffix.
 *
 * Sri Lanka has been a fixed +05:30 since 2006 and observes no daylight saving,
 * so a literal offset is exact rather than an approximation. It is what makes a
 * date *filter* agree with the dates {@link formatOrderDate} prints: an admin
 * filtering to "2 September" means the day it was that in Colombo, and asking
 * Postgres for UTC midnight would quietly include the previous evening's orders
 * and drop the last five and a half hours of the day they meant.
 */
const COLOMBO_UTC_OFFSET = "+05:30";

/** Milliseconds in a day. Exact here: a fixed-offset zone has no short days. */
const DAY_MS = 24 * 60 * 60 * 1000;

/** The first instant of a `YYYY-MM-DD` day in Colombo. */
export function colomboDayStart(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000${COLOMBO_UTC_OFFSET}`);
}

/**
 * The first instant of the day *after* a `YYYY-MM-DD` day in Colombo.
 *
 * The exclusive upper bound for an inclusive "up to and including this day"
 * filter. Expressed as `< next midnight` rather than `<= 23:59:59` so that an
 * order placed in the last second of the day is not silently excluded.
 */
export function colomboDayEnd(isoDate: string): Date {
  return new Date(colomboDayStart(isoDate).getTime() + DAY_MS);
}

/** Today in Colombo as `YYYY-MM-DD`, for capping a date picker. */
export function colomboToday(): string {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}
