// Creates an order from the customer's cart.
//
// Every price, delivery charge and total is recalculated here from the
// products table. Whatever amount the browser claims is ignored, so a tampered
// page cannot buy a sofa for one rupee.
//
// For the "razorpay" method a matching Razorpay order is created and its id is
// returned so the browser can open the checkout popup. For "upi" and
// "bank_transfer" the order is saved awaiting manual verification by the admin.

import {
  corsHeaders,
  errorResponse,
  jsonResponse,
  logPaymentEvent,
  razorpayRequest,
  requiredEnv,
  requireUser,
  serviceClient,
} from "../_shared/payments.ts";

// Kept in step with DELIVERY_POLICY.standardCharge in public/site/js/business.js.
const DELIVERY_CHARGE_PER_PIECE = 500;
const ONLINE_METHODS = ["razorpay"];
const MANUAL_METHODS = ["upi", "bank_transfer"];

type CartLine = { productId: string; quantity: number };

function cleanText(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function validateDetails(body: Record<string, unknown>): string | null {
  if (!cleanText(body.contactName)) return "Please enter your full name.";
  if (!/^[0-9+ ]{10,15}$/.test(cleanText(body.contactPhone))) return "Please enter a valid mobile number.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanText(body.contactEmail))) return "Please enter a valid email address.";
  if (!cleanText(body.addressLine1)) return "Please enter your house / flat / building.";
  if (!cleanText(body.addressLine2)) return "Please enter your street / area.";
  if (!cleanText(body.city)) return "Please enter your city.";
  if (!cleanText(body.state)) return "Please enter your state.";
  if (!/^[0-9]{6}$/.test(cleanText(body.pincode))) return "Please enter a valid 6 digit PIN code.";
  return null;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const user = await requireUser(request);
    if (!user) return errorResponse("Please sign in to place an order.", 401);

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const paymentMethod = cleanText(body.paymentMethod, 40);
    if (![...ONLINE_METHODS, ...MANUAL_METHODS].includes(paymentMethod)) {
      return errorResponse("Please choose a valid payment method.");
    }

    const detailsError = validateDetails(body);
    if (detailsError) return errorResponse(detailsError);

    const lines = Array.isArray(body.lines) ? (body.lines as CartLine[]) : [];
    if (!lines.length) return errorResponse("Your cart is empty.");

    const quantityById = new Map<string, number>();
    for (const line of lines) {
      const id = cleanText(line?.productId, 64);
      const quantity = Math.floor(Number(line?.quantity));
      if (!id || !Number.isFinite(quantity) || quantity < 1 || quantity > 99) {
        return errorResponse("Your cart contains an invalid item.");
      }
      quantityById.set(id, (quantityById.get(id) || 0) + quantity);
    }

    const supabase = serviceClient();

    // Authoritative product data, straight from the database.
    const { data: products, error: productError } = await supabase
      .from("products")
      .select("id,name,sku,price,discount_price,stock,is_active,status")
      .in("id", [...quantityById.keys()]);

    if (productError) throw productError;
    if (!products || products.length !== quantityById.size) {
      return errorResponse("One of the products in your cart is no longer available.");
    }

    let subtotal = 0;
    let pieces = 0;
    const items: Record<string, unknown>[] = [];

    for (const product of products) {
      const quantity = quantityById.get(product.id) as number;

      if (!product.is_active) {
        return errorResponse(product.name + " is no longer available.");
      }
      if (Number(product.stock) < quantity) {
        return errorResponse("Only " + product.stock + " left of " + product.name + ".");
      }

      const discount = Number(product.discount_price);
      const unitPrice = discount > 0 && discount < Number(product.price) ? discount : Number(product.price);
      const lineTotal = unitPrice * quantity;

      subtotal += lineTotal;
      pieces += quantity;

      items.push({
        product_id: product.id,
        product_name: product.name,
        sku: product.sku || "",
        unit_price: unitPrice,
        quantity: quantity,
        line_total: lineTotal,
      });
    }

    const deliveryCharge = pieces * DELIVERY_CHARGE_PER_PIECE;
    const total = subtotal + deliveryCharge;

    if (!(total > 0)) return errorResponse("This order total could not be calculated.");

    const isOnline = ONLINE_METHODS.includes(paymentMethod);

    const { data: inserted, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id: user.id,
        contact_name: cleanText(body.contactName, 120),
        contact_phone: cleanText(body.contactPhone, 20),
        // The checkout form's own email field, not necessarily the login
        // email — the customer may want order updates sent elsewhere.
        contact_email: cleanText(body.contactEmail, 200),
        address_line1: cleanText(body.addressLine1, 200),
        address_line2: cleanText(body.addressLine2, 200),
        landmark: cleanText(body.landmark, 200),
        city: cleanText(body.city, 80),
        state: cleanText(body.state, 80),
        pincode: cleanText(body.pincode, 10),
        notes: cleanText(body.notes, 500),
        payment_method: paymentMethod,
        payment_reference: isOnline ? "" : cleanText(body.paymentReference, 80),
        // Online orders are not "verifying" until money actually moves.
        payment_status: isOnline ? "awaiting_payment" : "verifying",
        subtotal: subtotal,
        delivery_charge: deliveryCharge,
        total: total,
      })
      .select("id,order_number,total")
      .single();

    if (orderError) throw orderError;

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(items.map((item) => ({ ...item, order_id: inserted.id })));

    if (itemsError) {
      // Never leave a total without the lines that explain it.
      await supabase.from("orders").delete().eq("id", inserted.id);
      throw itemsError;
    }

    if (!isOnline) {
      await logPaymentEvent({
        order_id: inserted.id,
        event: "manual_order_created",
        amount: total,
        detail: { payment_method: paymentMethod },
      });

      return jsonResponse({
        success: true,
        mode: "manual",
        orderNumber: inserted.order_number,
        total: total,
      });
    }

    // Razorpay works in paise.
    const razorpayOrder = await razorpayRequest("/orders", {
      method: "POST",
      body: JSON.stringify({
        amount: Math.round(total * 100),
        currency: "INR",
        receipt: inserted.order_number,
        notes: { order_number: inserted.order_number, order_id: inserted.id },
      }),
    });

    const { error: linkError } = await supabase
      .from("orders")
      .update({ razorpay_order_id: razorpayOrder.id })
      .eq("id", inserted.id);

    if (linkError) throw linkError;

    await logPaymentEvent({
      order_id: inserted.id,
      razorpay_order_id: razorpayOrder.id,
      event: "razorpay_order_created",
      amount: total,
    });

    return jsonResponse({
      success: true,
      mode: "razorpay",
      orderNumber: inserted.order_number,
      total: total,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      razorpayOrderId: razorpayOrder.id,
      // The key id is public by design; the secret never leaves this function.
      razorpayKeyId: requiredEnv("RAZORPAY_KEY_ID"),
      customer: { name: cleanText(body.contactName, 120), email: cleanText(body.contactEmail, 200), contact: cleanText(body.contactPhone, 20) },
    });
  } catch (error) {
    console.error("create-payment-order failed", error);
    return errorResponse("We could not start your order. Please try again.", 500);
  }
});
