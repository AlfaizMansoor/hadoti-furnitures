// Verifies a completed Razorpay payment and confirms the order.
//
// Two independent checks run before an order is marked paid:
//   1. the HMAC signature Razorpay returned to the browser must match one
//      computed here with the key secret, and
//   2. the payment is fetched back from Razorpay's API and its status, order id
//      and captured amount must match our stored order.
//
// A browser that invents a "success" response passes neither check.

import {
  corsHeaders,
  errorResponse,
  isValidPaymentSignature,
  jsonResponse,
  logPaymentEvent,
  razorpayRequest,
  requireUser,
  serviceClient,
} from "../_shared/payments.ts";

function cleanText(value: unknown, max = 200): string {
  return String(value ?? "").trim().slice(0, max);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const user = await requireUser(request);
    if (!user) return errorResponse("Please sign in to continue.", 401);

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const razorpayOrderId = cleanText(body.razorpay_order_id);
    const razorpayPaymentId = cleanText(body.razorpay_payment_id);
    const signature = cleanText(body.razorpay_signature);

    if (!razorpayOrderId || !razorpayPaymentId || !signature) {
      return errorResponse("The payment details were incomplete.");
    }

    const supabase = serviceClient();

    const { data: order, error: lookupError } = await supabase
      .from("orders")
      .select("id,order_number,user_id,total,payment_status,razorpay_order_id")
      .eq("razorpay_order_id", razorpayOrderId)
      .maybeSingle();

    if (lookupError) throw lookupError;
    if (!order) return errorResponse("We could not find that order.", 404);

    // An order may only be settled by the customer who placed it.
    if (order.user_id !== user.id) {
      await logPaymentEvent({
        order_id: order.id,
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: razorpayPaymentId,
        event: "verification_rejected_wrong_user",
      });
      return errorResponse("This order belongs to another account.", 403);
    }

    // Already settled (usually by the webhook arriving first). Nothing to redo.
    if (order.payment_status === "paid") {
      return jsonResponse({ success: true, orderNumber: order.order_number, alreadyVerified: true });
    }

    /* Check 1: the signature ------------------------------------------- */
    const signatureValid = await isValidPaymentSignature(razorpayOrderId, razorpayPaymentId, signature);

    if (!signatureValid) {
      await supabase
        .from("orders")
        .update({ payment_status: "failed", razorpay_payment_id: razorpayPaymentId })
        .eq("id", order.id);

      await logPaymentEvent({
        order_id: order.id,
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: razorpayPaymentId,
        event: "signature_mismatch",
      });

      return errorResponse("This payment could not be verified. Please contact us before paying again.", 400);
    }

    /* Check 2: the payment itself, straight from Razorpay --------------- */
    const payment = await razorpayRequest("/payments/" + encodeURIComponent(razorpayPaymentId));

    const expectedPaise = Math.round(Number(order.total) * 100);
    const capturedOk = payment.status === "captured" || payment.status === "authorized";
    const amountOk = Number(payment.amount) === expectedPaise;
    const orderOk = payment.order_id === razorpayOrderId;

    if (!capturedOk || !amountOk || !orderOk) {
      await logPaymentEvent({
        order_id: order.id,
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: razorpayPaymentId,
        event: "payment_mismatch",
        amount: Number(payment.amount || 0) / 100,
        detail: { status: payment.status, expected_paise: expectedPaise, received_paise: payment.amount },
      });

      return errorResponse("The payment amount did not match this order. Please contact us.", 400);
    }

    /* Everything matches: confirm the order ----------------------------- */
    const now = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("orders")
      .update({
        payment_status: "paid",
        status: "confirmed",
        razorpay_payment_id: razorpayPaymentId,
        razorpay_signature: signature,
        payment_reference: razorpayPaymentId,
        payment_verified_at: now,
        paid_at: now,
      })
      .eq("id", order.id);

    if (updateError) throw updateError;

    await logPaymentEvent({
      order_id: order.id,
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
      event: "payment_verified",
      amount: Number(order.total),
      detail: { method: payment.method, status: payment.status },
    });

    return jsonResponse({
      success: true,
      orderNumber: order.order_number,
      paymentId: razorpayPaymentId,
    });
  } catch (error) {
    console.error("verify-payment failed", error);
    return errorResponse("We could not verify this payment. Please contact us before paying again.", 500);
  }
});
