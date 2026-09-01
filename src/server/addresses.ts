import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * Saved delivery addresses.
 *
 * An `Address` is a convenience — somewhere to keep "home" and "the office" so
 * they do not have to be retyped. It is **not** where an order shipped: that is
 * copied onto the Order as flat `shipping*` columns at the moment it is placed,
 * so editing or deleting one of these rows never rewrites delivery history.
 * Nothing in this module is read when rendering a past order.
 *
 * Every function takes a `userId` and filters on it. An address id on its own is
 * never enough to reach a row.
 */

export type SavedAddress = {
  id: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  postalCode: string;
  isDefault: boolean;
};

const addressSelect = {
  id: true,
  fullName: true,
  phone: true,
  line1: true,
  line2: true,
  city: true,
  postalCode: true,
  isDefault: true,
} as const;

/**
 * Every address this user has saved, default first.
 *
 * The default leads because that is the one checkout pre-selects; the rest are
 * ordered by city so a list of four does not reshuffle between visits.
 */
export async function listAddresses(userId: string): Promise<SavedAddress[]> {
  return prisma.address.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { city: "asc" }, { fullName: "asc" }],
    select: addressSelect,
  });
}
