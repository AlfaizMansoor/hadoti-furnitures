// Razorpay webhook: the safety net.
//
// If the customer's browser closes, loses signal or crashes between paying and
// the verify-payment call, Razorpay still tells us here. This keeps the order
// from sitting in "awaiting_payment" forever after real money has moved.
//
// This function must be deployed with JWT verification turned off, because
// Razorpay calls it, not a signed-in customer. Its authentication is the
// webhook signature instead — see supabase/config.toml.

import {
  errorResponse,
  isValidWebhookSignature,
  jsonResponse,
  logPaymentEvent,
  serviceClient,
} from "../_shared/payments.ts";

Deno.serve(async (request) => {
  if (request.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    // The raw body is what the signature covers, so read it before parsing.
    const rawBody = await request.text();
    const signature = request.headers.get("x-razorpay-signature") || "";

    if (!signature || !(await isValidWebhookSignature(rawBody, signature))) {
      console.warn("Rejected webhook with a bad signature");
      return errorResponse("Invalid signature", 401);
    }

    const payload = JSON.parse(rawBody);
    const event = String(payload?.event || "");
    const payment = payload?.payload?.payment?.entity;

    if (!payment?.order_id) {
      return jsonResponse({ success: true, ignored: true });
    }

    const supabase = serviceClient();

    const { data: order } = await supabase
      .from("orders")
      .select("id,order_number,total,payment_status")
      .eq("razorpay_order_id", payment.order_id)
      .maybeSingle();

    if (!order) {
      await logPaymentEvent({
        razorpay_order_id: payment.order_id,
        razorpay_payment_id: payment.id,
        event: "webhook_order_not_found",
        detail: { event },
      });
      return jsonResponse({ success: true, ignored: true });
    }

    const now = new Date().toISOString();

    if (event === "payment.captured") {
      const amountMatches = Number(payment.amount) === Math.round(Number(order.total) * 100);

      if (!amountMatches) {
        await logPaymentEvent({
          order_id: order.id,
          razorpay_order_id: payment.order_id,
          razorpay_payment_id: payment.id,
          event: "webhook_amount_mismatch",
          amount: Number(payment.amount || 0) / 100,
        });
        return jsonResponse({ success: true, ignored: true });
      }

      // Do not overwrite an order the customer already settled in the browser.
      if (order.payment_status !== "paid") {
        await supabase
          .from("orders")
          .update({
            payment_status: "paid",
            status: "confirmed",
            razorpay_payment_id: payment.id,
            payment_reference: payment.id,
            payment_verified_at: now,
            paid_at: now,
          })
          .eq("id", order.id);
      }

      await logPaymentEvent({
        order_id: order.id,
        razorpay_order_id: payment.order_id,
        razorpay_payment_id: payment.id,
        event: "webhook_payment_captured",
        amount: Number(order.total),
      });
    }

    if (event === "payment.failed") {
      if (order.payment_status !== "paid") {
        await supabase
          .from("orders")
          .update({ payment_status: "failed", razorpay_payment_id: payment.id })
          .eq("id", order.id);
      }

      await logPaymentEvent({
        order_id: order.id,
        razorpay_order_id: payment.order_id,
        razorpay_payment_id: payment.id,
        event: "webhook_payment_failed",
        detail: { reason: payment.error_description || "" },
      });
    }

    return jsonResponse({ success: true });
  } catch (error) {
    console.error("razorpay-webhook failed", error);
    // A 500 makes Razorpay retry, which is what we want on a transient fault.
    return errorResponse("Webhook processing failed", 500);
  }
});
