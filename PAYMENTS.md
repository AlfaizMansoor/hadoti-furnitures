# Payments & Order Verification — Setup

Cash on delivery has been removed. The store now accepts:

| Method | Verified how |
| --- | --- |
| `razorpay` | Automatically, by our server, against Razorpay's API |
| `upi` | Manually — admin matches the reference in the admin panel |
| `bank_transfer` | Manually — admin matches the reference in the admin panel |

---

## 1. Why there is a server now

Previously the browser inserted orders straight into the database **and sent its
own total**. Anyone could open DevTools and place a ₹15,999 order for ₹1.

Order creation now happens in the `create-payment-order` edge function, which
recalculates every unit price, delivery charge and total from the `products`
table. The amount the browser claims is ignored. The migration therefore
revokes client-side `INSERT` on `orders` and `order_items`.

## 2. Razorpay account

1. Create an account at razorpay.com and finish KYC (needed for live mode).
2. **Settings → API Keys** → generate keys. You get a **Key ID**
   (`rzp_test_…` / `rzp_live_…`) and a **Key Secret**.
3. The Key Secret must never appear in any file under `public/`. It lives only
   in Supabase secrets, below.

## 3. Webhook

In the Razorpay dashboard: **Settings → Webhooks → Add New Webhook**.

- URL: `https://<your-project-ref>.supabase.co/functions/v1/razorpay-webhook`
- Active events: `payment.captured` and `payment.failed`
- Set a **webhook secret** and keep it — it is a *different* value from the key
  secret.

The webhook is the safety net for when a customer's browser closes or loses
signal after paying but before the verification call returns. Without it those
orders would sit unpaid even though the money moved.

## 4. Store the secrets

```bash
supabase login
supabase link --project-ref <your-project-ref>

supabase secrets set RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
supabase secrets set RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxx
supabase secrets set RAZORPAY_WEBHOOK_SECRET=xxxxxxxxxxxxxxxx
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

## 5. Apply the migration and deploy

```bash
supabase db push

supabase functions deploy create-payment-order
supabase functions deploy verify-payment
supabase functions deploy razorpay-webhook
```

`razorpay-webhook` is declared with `verify_jwt = false` in
`supabase/config.toml` because Razorpay's servers cannot hold a Supabase JWT.
Its authentication is the webhook HMAC signature instead — do not remove that
check.

## 6. Test before going live

Use test keys and Razorpay's test instruments:

- UPI success: `success@razorpay`
- UPI failure: `failure@razorpay`
- Card: `4111 1111 1111 1111`, any future expiry, any CVV

Worth walking through each of these:

1. **Happy path** — pay, land on the confirmation page, order shows
   *Paid / Confirmed* with a verified timestamp.
2. **Cancel the popup** — order stays `awaiting_payment`, cart is not cleared,
   the customer is told the order is saved and unpaid.
3. **Failed payment** — order marked `failed`, message explains no money was
   taken.
4. **Close the tab right after paying** — the order should still flip to `paid`
   within a few seconds via the webhook. This is the one people forget to test.
5. **UPI / bank transfer** — order is created as `verifying`, admin panel shows
   the "check this reference" prompt.

## 7. Going live

- Swap the test keys for live keys (`supabase secrets set` again, then redeploy).
- Point the webhook at the live mode section of the dashboard as well — test and
  live webhooks are configured separately.
- Replace the sample UPI ID and bank details in `public/site/js/business.js` and
  set `PAYMENT.sample = false` to hide the "these are sample details" notice.

---

## Known gap worth fixing

`DELIVERY_CHARGE_PER_PIECE` is defined **twice**:

- `public/site/js/business.js` → `DELIVERY_POLICY.standardCharge` (browser)
- `supabase/functions/create-payment-order/index.ts` (server, authoritative)

If you change the delivery charge in only one place, the summary the customer
sees and the amount actually charged will disagree. Moving it into a
`store_settings` table that both read would remove the trap.

## Payment states

| `payment_status` | Meaning |
| --- | --- |
| `awaiting_payment` | Online order created, customer has not paid yet |
| `verifying` | UPI/bank reference submitted, awaiting admin confirmation |
| `paid` | Verified — signature checked *and* amount confirmed with Razorpay |
| `failed` | Attempt failed, or a signature did not verify |
| `refunded` | Refunded |

Every gateway event is written to the `payment_events` table, which admins can
read. If a customer ever says "I paid but my order says unpaid", that table is
where you look first.


# Payments & Order Verification — Setup

Cash on delivery has been removed. The store now accepts:

| Method | Verified how |
| --- | --- |
| `razorpay` | Automatically, by our server, against Razorpay's API |
| `upi` | Manually — admin matches the reference in the admin panel |
| `bank_transfer` | Manually — admin matches the reference in the admin panel |

---

## 1. Why there is a server now

Previously the browser inserted orders straight into the database **and sent its
own total**. Anyone could open DevTools and place a ₹15,999 order for ₹1.

Order creation now happens in the `create-payment-order` edge function, which
recalculates every unit price, delivery charge and total from the `products`
table. The amount the browser claims is ignored. The migration therefore
revokes client-side `INSERT` on `orders` and `order_items`.

## 2. Razorpay account

1. Create an account at razorpay.com and finish KYC (needed for live mode).
2. **Settings → API Keys** → generate keys. You get a **Key ID**
   (`rzp_test_…` / `rzp_live_…`) and a **Key Secret**.
3. The Key Secret must never appear in any file under `public/`. It lives only
   in Supabase secrets, below.

## 3. Webhook

In the Razorpay dashboard: **Settings → Webhooks → Add New Webhook**.

- URL: `https://<your-project-ref>.supabase.co/functions/v1/razorpay-webhook`
- Active events: `payment.captured` and `payment.failed`
- Set a **webhook secret** and keep it — it is a *different* value from the key
  secret.

The webhook is the safety net for when a customer's browser closes or loses
signal after paying but before the verification call returns. Without it those
orders would sit unpaid even though the money moved.

## 4. Store the secrets

```bash
supabase login
supabase link --project-ref <your-project-ref>

supabase secrets set RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
supabase secrets set RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxx
supabase secrets set RAZORPAY_WEBHOOK_SECRET=xxxxxxxxxxxxxxxx
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

## 5. Apply the migration and deploy

```bash
supabase db push

supabase functions deploy create-payment-order
supabase functions deploy verify-payment
supabase functions deploy razorpay-webhook
```

`razorpay-webhook` is declared with `verify_jwt = false` in
`supabase/config.toml` because Razorpay's servers cannot hold a Supabase JWT.
Its authentication is the webhook HMAC signature instead — do not remove that
check.

## 6. Test before going live

Use test keys and Razorpay's test instruments:

- UPI success: `success@razorpay`
- UPI failure: `failure@razorpay`
- Card: `4111 1111 1111 1111`, any future expiry, any CVV

Worth walking through each of these:

1. **Happy path** — pay, land on the confirmation page, order shows
   *Paid / Confirmed* with a verified timestamp.
2. **Cancel the popup** — order stays `awaiting_payment`, cart is not cleared,
   the customer is told the order is saved and unpaid.
3. **Failed payment** — order marked `failed`, message explains no money was
   taken.
4. **Close the tab right after paying** — the order should still flip to `paid`
   within a few seconds via the webhook. This is the one people forget to test.
5. **UPI / bank transfer** — order is created as `verifying`, admin panel shows
   the "check this reference" prompt.

## 7. Going live

- Swap the test keys for live keys (`supabase secrets set` again, then redeploy).
- Point the webhook at the live mode section of the dashboard as well — test and
  live webhooks are configured separately.
- Replace the sample UPI ID and bank details in `public/site/js/business.js` and
  set `PAYMENT.sample = false` to hide the "these are sample details" notice.

---

## Known gap worth fixing

`DELIVERY_CHARGE_PER_PIECE` is defined **twice**:

- `public/site/js/business.js` → `DELIVERY_POLICY.standardCharge` (browser)
- `supabase/functions/create-payment-order/index.ts` (server, authoritative)

If you change the delivery charge in only one place, the summary the customer
sees and the amount actually charged will disagree. Moving it into a
`store_settings` table that both read would remove the trap.

## Payment states

| `payment_status` | Meaning |
| --- | --- |
| `awaiting_payment` | Online order created, customer has not paid yet |
| `verifying` | UPI/bank reference submitted, awaiting admin confirmation |
| `paid` | Verified — signature checked *and* amount confirmed with Razorpay |
| `failed` | Attempt failed, or a signature did not verify |
| `refunded` | Refunded |

Every gateway event is written to the `payment_events` table, which admins can
read. If a customer ever says "I paid but my order says unpaid", that table is
where you look first.

## Password reset now uses a 6-digit code, not just a link

Email reset links can be unreliable — some email clients "click" links
automatically while scanning for safety, which burns Supabase's one-time
token before the person ever opens their inbox. All three sign-in pages
(customer, and the two admin panels) now also let people type a 6-digit
code straight from the email instead of clicking anything.

**One-time setup required in the Supabase dashboard** — the code only
appears in the email if the template includes it:

1. Dashboard → **Authentication → Email Templates → Reset Password**
2. Make sure the template includes `{{ .Token }}` somewhere in the body —
   this is the 6-digit code. Supabase's default template usually already
   has it; if you've customized the template, add a line like:
   `Your code: {{ .Token }}`
3. Save.

No code change needed beyond this — `verifyRecoveryCode()` and
`setNewPassword()` in `session.js` handle the rest, and are wired into
`auth.html`, `admin.html`, and `admin-orders.html`.

The old "click the link" flow still works too, in case the email client
renders both.