# Order confirmation, tracking, and customer emails

## What will change
- Send customers from checkout to a dedicated confirmation page showing their order number, products, quantities, subtotal, per-piece delivery charge, total, delivery address, payment state, and current order status.
- Add a customer-safe tracking link that reloads the same order from their signed-in account and displays progress from placed through delivered.
- Keep the existing admin order controls and make delivered status updates explicit, with clear save feedback.
- Send an order confirmation email after the order and its items are saved, using the customer’s registered email and including order totals, delivery information, and the tracking link.
- Send a delivery confirmation email only when an administrator changes an order to delivered.

## Safety and reliability
- Validate the signed-in customer or administrator on the server before reading an order or sending an email.
- Use fixed email templates and recipients from the order record; the browser cannot choose arbitrary templates or recipients.
- Make email sends idempotent so retries do not duplicate customer messages.
- Do not create an email queue or email database tables; delivery and suppression are handled by the managed email service.
- Order placement remains successful if email delivery is temporarily unavailable, while the confirmation page still appears.

## Email prerequisite
- A sender domain owned by Hadoti Furnitures must be connected before real emails can be delivered. The order, admin, confirmation, and tracking features can be completed first; sending starts after domain verification.

## Verification
- Place a test order and confirm the new page shows the correct items, delivery charge, total, and tracking progress.
- Update a test order to delivered in the admin panel and confirm the customer view changes.
- Check mobile and desktop layouts, page errors, and the latest application health report.
