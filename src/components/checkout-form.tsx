"use client";

import { useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { TriangleAlertIcon } from "lucide-react";

import FormField from "@/components/form-field";
import { Button } from "@/components/ui/button";
import {
  emptyCheckoutFormState,
  type CheckoutField,
  type CheckoutFormState,
} from "@/lib/checkout-schemas";
import { cn } from "@/lib/utils";
import type { SavedAddress } from "@/server/addresses";
import { placeOrderAction } from "@/server/checkout-actions";

/**
 * Where the order is going, and the button that places it.
 *
 * **Controlled, unlike the auth forms.** Picking a saved address rewrites six
 * inputs at once, and that is only expressible if React owns their values.
 * Editing any field after picking one flips the selection to "a different
 * address", because that is what it has become — the radio would otherwise
 * claim the order is going somewhere it is not.
 *
 * **The saved-address radio is not the address.** It posts, and the server
 * ignores it. What gets validated and stored is whatever is in the text inputs,
 * so there is no path where the order ships to a row the visitor did not see.
 *
 * **Double submit.** `isPending` stays true from the moment the action is
 * dispatched until React has finished the resulting navigation, so the button
 * cannot be pressed into a second request. That is the courtesy, not the
 * guarantee: a disabled button is a DOM attribute, and the real protection is
 * the cart row lock in `createOrder`, which makes a second submission find an
 * empty cart. Both are needed, and neither is a substitute for the other.
 */

/** The radio value for "not one of my saved addresses". */
const NEW_ADDRESS = "new";

/** A rejected action means the request never landed — say so, don't hang. */
const UNEXPECTED_ERROR = "Something went wrong. Please try again.";

/** Every field is a string in the DOM; the schema is what gives them meaning. */
type AddressValues = Record<CheckoutField, string>;

/** A saved row as form values: a `null` line 2 becomes an empty input. */
function toAddressValues(address: SavedAddress): AddressValues {
  return {
    fullName: address.fullName,
    phone: address.phone,
    line1: address.line1,
    line2: address.line2 ?? "",
    city: address.city,
    postalCode: address.postalCode,
  };
}

/** A blank address, except for the name we can reasonably guess. */
function blankAddressValues(fullName: string): AddressValues {
  return { fullName, phone: "", line1: "", line2: "", city: "", postalCode: "" };
}

function describeAddress(address: SavedAddress): string {
  return [address.line1, address.line2, address.city, address.postalCode]
    .filter(Boolean)
    .join(", ");
}

export default function CheckoutForm({
  addresses,
  suggestedName,
}: {
  /** Every address on the account, default first — see `listAddresses`. */
  addresses: SavedAddress[];
  /** The account holder's name, used when there is no address to pre-fill from. */
  suggestedName: string;
}) {
  // The default address is what the form opens on. `listAddresses` puts it
  // first, but this looks for the flag rather than the position: a list that is
  // reordered later should not silently change which address is pre-filled.
  const defaultAddress = addresses.find((address) => address.isDefault) ?? null;

  const [values, setValues] = useState<AddressValues>(() =>
    defaultAddress
      ? toAddressValues(defaultAddress)
      : blankAddressValues(suggestedName),
  );
  const [selectedId, setSelectedId] = useState(
    defaultAddress?.id ?? NEW_ADDRESS,
  );
  const [state, setState] = useState<CheckoutFormState>(emptyCheckoutFormState);
  const [isPending, startTransition] = useTransition();

  const isNewAddress = selectedId === NEW_ADDRESS;

  function selectSaved(address: SavedAddress) {
    setSelectedId(address.id);
    setValues(toAddressValues(address));
  }

  function selectNew() {
    setSelectedId(NEW_ADDRESS);
    setValues(blankAddressValues(suggestedName));
  }

  function setField(field: CheckoutField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    // Typing over a saved address makes it a different address.
    setSelectedId(NEW_ADDRESS);
  }

  function submit(formData: FormData) {
    startTransition(async () => {
      try {
        const result = await placeOrderAction(formData);
        // A placed order redirects, so anything that comes back is a refusal.
        if (result) setState(result);
      } catch (error) {
        // `redirect()` reaches the client as a thrown control-flow signal.
        // Catching it here would swallow the navigation to the confirmation
        // page and report a success as a failure.
        unstable_rethrow(error);
        setState({ formError: UNEXPECTED_ERROR, fieldErrors: {} });
      }
    });
  }

  function field(name: CheckoutField) {
    return {
      name,
      value: values[name],
      error: state.fieldErrors[name],
      onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
        setField(name, event.target.value),
    };
  }

  return (
    <form action={submit} className="flex flex-col gap-6">
      {state.formError ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          {state.formError}
        </p>
      ) : null}

      {addresses.length > 0 ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">Deliver to</legend>

          {addresses.map((address) => (
            <AddressChoice
              key={address.id}
              value={address.id}
              checked={selectedId === address.id}
              onSelect={() => selectSaved(address)}
              title={address.fullName}
              detail={describeAddress(address)}
              isDefault={address.isDefault}
            />
          ))}

          <AddressChoice
            value={NEW_ADDRESS}
            checked={isNewAddress}
            onSelect={selectNew}
            title="A different address"
            detail="Enter the details below."
          />
        </fieldset>
      ) : null}

      <div className="flex flex-col gap-4">
        <FormField
          {...field("fullName")}
          label="Full name"
          autoComplete="name"
          required
        />

        <FormField
          {...field("phone")}
          label="Phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          hint="Sri Lankan number, e.g. 0712345678."
          required
        />

        <FormField
          {...field("line1")}
          label="Address line 1"
          autoComplete="address-line1"
          required
        />

        <FormField
          {...field("line2")}
          label="Address line 2"
          autoComplete="address-line2"
          hint="Optional."
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            {...field("city")}
            label="City"
            autoComplete="address-level2"
            required
          />

          <FormField
            {...field("postalCode")}
            label="Postal code"
            inputMode="numeric"
            autoComplete="postal-code"
            hint="5 digits."
            required
          />
        </div>
      </div>

      {/* Only when there is something new to save. Offering to save an address
          that is already on the account is a button that does nothing. */}
      {isNewAddress ? (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="saveAddress"
            className="size-4 rounded border-border accent-primary"
          />
          Save this address to my account
        </label>
      ) : null}

      <div className="flex flex-col gap-2">
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "Placing order…" : "Place order"}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          No payment is taken at this step.
        </p>
      </div>
    </form>
  );
}

function AddressChoice({
  value,
  checked,
  onSelect,
  title,
  detail,
  isDefault = false,
}: {
  value: string;
  checked: boolean;
  onSelect: () => void;
  title: string;
  detail: string;
  isDefault?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors",
        checked ? "border-foreground bg-muted/40" : "border-border hover:bg-muted/30",
      )}
    >
      <input
        type="radio"
        // Posted and ignored: the order is built from the inputs below, never
        // from this id. See the note at the top of the file.
        name="savedAddress"
        value={value}
        checked={checked}
        onChange={onSelect}
        className="mt-0.5 size-4 shrink-0 accent-primary"
      />

      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="font-medium">
          {title}
          {isDefault ? (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              Default
            </span>
          ) : null}
        </span>
        <span className="text-xs text-muted-foreground">{detail}</span>
      </span>
    </label>
  );
}
