// Shared helpers for the payment edge functions.
// Nothing in this file ever reaches the browser: the Razorpay key secret and
// the Supabase service role key stay on the server.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.113.0";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-razorpay-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ success: false, message }, status);
}

/* Environment ------------------------------------------------------------ */
export function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error("Missing environment variable: " + name);
  return value;
}

export function serviceClient() {
  return createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });
}

/* Customer identity ------------------------------------------------------ */
// Reads the signed-in customer from the Authorization header. The browser can
// send any body it likes, but it cannot forge this token.
export async function requireUser(request: Request) {
  const header = request.headers.get("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return null;

  const { data, error } = await serviceClient().auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

/* Razorpay --------------------------------------------------------------- */
export function razorpayAuthHeader(): string {
  const keyId = requiredEnv("RAZORPAY_KEY_ID");
  const keySecret = requiredEnv("RAZORPAY_KEY_SECRET");
  return "Basic " + btoa(keyId + ":" + keySecret);
}

export async function razorpayRequest(path: string, init?: RequestInit) {
  const response = await fetch("https://api.razorpay.com/v1" + path, {
    ...init,
    headers: {
      Authorization: razorpayAuthHeader(),
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail = payload?.error?.description || payload?.message || "Razorpay request failed";
    throw new Error(detail);
  }

  return payload;
}

/* HMAC SHA-256 ----------------------------------------------------------- */
async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));

  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

// Comparison that does not leak how many characters matched.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// The signature Razorpay returns to the browser after a successful payment.
export async function isValidPaymentSignature(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  signature: string,
): Promise<boolean> {
  const expected = await hmacSha256Hex(
    requiredEnv("RAZORPAY_KEY_SECRET"),
    razorpayOrderId + "|" + razorpayPaymentId,
  );
  return timingSafeEqual(expected, signature);
}

// The signature Razorpay sends on webhook calls (signed with the webhook
// secret, not the key secret).
export async function isValidWebhookSignature(rawBody: string, signature: string): Promise<boolean> {
  const expected = await hmacSha256Hex(requiredEnv("RAZORPAY_WEBHOOK_SECRET"), rawBody);
  return timingSafeEqual(expected, signature);
}

/* Audit ------------------------------------------------------------------ */
export async function logPaymentEvent(fields: {
  order_id?: string | null;
  razorpay_order_id?: string | null;
  razorpay_payment_id?: string | null;
  event: string;
  amount?: number | null;
  detail?: Record<string, unknown>;
}) {
  try {
    await serviceClient().from("payment_events").insert({
      order_id: fields.order_id ?? null,
      razorpay_order_id: fields.razorpay_order_id ?? null,
      razorpay_payment_id: fields.razorpay_payment_id ?? null,
      event: fields.event,
      amount: fields.amount ?? null,
      detail: fields.detail ?? {},
    });
  } catch (error) {
    // An audit write must never break a real payment.
    console.error("payment_events insert failed", error);
  }
}
