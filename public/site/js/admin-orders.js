// Administrator order panel: lists every placed order with its items,
// quantities, totals, payment details and delivery status.
import { authFetch, getSession, isSignedIn, sendPasswordReset, setNewPassword, signIn, signOut, verifyRecoveryCode } from "./session.js";
import { formatPrice } from "./ui.js";

const status = document.getElementById("admin-status");
const gate = document.getElementById("admin-gate");
const panel = document.getElementById("orders-panel");
const listBox = document.getElementById("orders-list");
const statsBox = document.getElementById("order-stats");
// Set only while the OTP reset form is open, so its submit knows which
// email the code belongs to.
let resetEmail = "";
const statusFilter = document.getElementById("status-filter");
const searchInput = document.getElementById("order-search");

const ORDER_STATUSES = ["placed", "confirmed", "in_production", "dispatched", "delivered", "cancelled"];
const PAYMENT_STATUSES = ["awaiting_payment", "verifying", "paid", "failed", "refunded"];

const ORDER_FIELDS =
  "id,order_number,status,payment_status,payment_method,payment_reference,contact_name,contact_phone," +
  "contact_email,address_line1,address_line2,landmark,city,state,pincode,notes,subtotal,delivery_charge,total,created_at," +
  "razorpay_order_id,razorpay_payment_id,payment_verified_at," +
  "order_items(id,product_name,sku,unit_price,quantity,line_total)";

let orders = [];

function setStatus(text, tone) {
  status.textContent = text || "";
  status.className = "form-message" + (tone ? " " + tone : "");
}

function readable(value) {
  return String(value || "").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value) {
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function options(values, selected) {
  return values
    .map((value) => '<option value="' + value + '"' + (value === selected ? " selected" : "") + ">" + readable(value) + "</option>")
    .join("");
}

function itemRows(order) {
  const items = Array.isArray(order.order_items) ? order.order_items : [];
  if (!items.length) return '<p class="empty">No items recorded for this order.</p>';

  return (
    '<table class="order-table"><thead><tr><th>Product</th><th>SKU</th><th>Unit price</th><th>Qty</th><th>Line total</th></tr></thead><tbody>' +
    items
      .map(
        (item) =>
          "<tr><td>" + item.product_name + "</td><td>" + item.sku + "</td><td>" + formatPrice(item.unit_price) +
          "</td><td>" + item.quantity + "</td><td>" + formatPrice(item.line_total) + "</td></tr>"
      )
      .join("") +
    "</tbody></table>"
  );
}

function orderCard(order) {
  const address = [order.address_line1, order.address_line2, order.landmark, order.city, order.state, order.pincode]
    .filter(Boolean)
    .join(", ");

  // Only manual methods (UPI / bank transfer) that have not already been
  // verified get this button. Razorpay orders are verified by the server
  // automatically and never need an admin to touch payment_status.
  const needsManualVerification = order.payment_method !== "razorpay" && !order.payment_verified_at;

  return (
    '<article class="order-card" data-order="' + order.id + '">' +
    '<header class="order-card-head">' +
    "<div><h3>" + order.order_number + "</h3><small>" + formatDate(order.created_at) + "</small></div>" +
    '<div class="order-total"><strong>' + formatPrice(order.total) + "</strong>" +
    "<small>" + readable(order.payment_method) + "</small></div>" +
    "</header>" +
    '<div class="order-customer">' +
    "<p><strong>" + order.contact_name + "</strong> &middot; " + order.contact_phone +
    (order.contact_email ? " &middot; " + order.contact_email : "") + "</p>" +
    "<p>" + address + "</p>" +
    (order.notes ? "<p><em>" + order.notes + "</em></p>" : "") +
    (order.payment_reference ? "<p>Payment reference: <strong>" + order.payment_reference + "</strong></p>" : "") +
    verificationLine(order) +
    "</div>" +
    itemRows(order) +
    '<div class="order-summary-row"><span>Items</span><span>' + formatPrice(order.subtotal) + "</span></div>" +
    '<div class="order-summary-row"><span>Delivery</span><span>' + formatPrice(order.delivery_charge) + "</span></div>" +
    '<div class="order-summary-row total"><span>Total</span><span>' + formatPrice(order.total) + "</span></div>" +
    '<div class="order-controls">' +
    "<label>Order status<select data-status>" + options(ORDER_STATUSES, order.status) + "</select></label>" +
    "<label>Payment status<select data-payment>" + options(PAYMENT_STATUSES, order.payment_status) + "</select></label>" +
    '<button class="btn" type="button" data-save>Update</button>' +
    (needsManualVerification
      ? '<button class="btn btn-ghost" type="button" data-verify-payment>Verify Payment</button>'
      : "") +
    '<a class="btn btn-ghost" href="/site/order.html?order=' + encodeURIComponent(order.order_number) + '" target="_blank" rel="noopener">Tracking page</a>' +
    '<span class="form-message" data-row-message></span>' +
    "</div>" +
    "</article>"
  );
}

// Shows at a glance whether a payment was checked by our server or still
// needs a human to match it against the bank or UPI account.
function verificationLine(order) {
  if (order.payment_verified_at) {
    return (
      '<p class="order-verified">Verified automatically on ' + formatDate(order.payment_verified_at) +
      (order.razorpay_payment_id ? " &middot; Razorpay payment " + order.razorpay_payment_id : "") +
      "</p>"
    );
  }

  if (order.payment_method === "razorpay") {
    return '<p class="order-unverified">Online payment not completed' +
      (order.razorpay_order_id ? " &middot; Razorpay order " + order.razorpay_order_id : "") + "</p>";
  }

  if (order.payment_status === "verifying") {
    return '<p class="order-unverified">Check this reference against the account before marking it paid.</p>';
  }

  return "";
}

function visibleOrders() {
  const wanted = statusFilter.value;
  const query = searchInput.value.trim().toLowerCase();

  return orders.filter((order) => {
    if (wanted && order.status !== wanted) return false;
    if (!query) return true;

    const haystack = [
      order.order_number,
      order.contact_name,
      order.contact_phone,
      order.city,
      ...(Array.isArray(order.order_items) ? order.order_items.map((item) => item.product_name) : []),
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
}

function renderStats() {
  const revenue = orders
    .filter((order) => order.status !== "cancelled")
    .reduce((sum, order) => sum + Number(order.total), 0);
  const pending = orders.filter((order) => order.payment_status !== "paid" && order.status !== "cancelled").length;
  const delivered = orders.filter((order) => order.status === "delivered").length;

  statsBox.innerHTML =
    '<div class="stat"><strong>' + orders.length + "</strong><span>Orders</span></div>" +
    '<div class="stat"><strong>' + formatPrice(revenue) + "</strong><span>Order value</span></div>" +
    '<div class="stat"><strong>' + pending + "</strong><span>Awaiting payment</span></div>" +
    '<div class="stat"><strong>' + delivered + "</strong><span>Delivered</span></div>";
}

function render() {
  renderStats();
  const rows = visibleOrders();

  listBox.innerHTML = rows.length
    ? rows.map(orderCard).join("")
    : '<p class="empty">No orders match this view yet.</p>';
}

async function loadOrders() {
  setStatus("Loading orders...");
  orders = await authFetch("/orders?select=" + ORDER_FIELDS + "&order=created_at.desc");
  render();
  setStatus(orders.length ? "Showing every placed order." : "No orders have been placed yet.", "success");
}

async function isAdministrator() {
  const rows = await authFetch("/user_roles?select=role&role=eq.admin&limit=1");
  return Array.isArray(rows) && rows.length > 0;
}

function showGate(message, tone) {
  gate.hidden = false;
  panel.hidden = true;
  setStatus(message, tone);
}

async function start() {
  if (!isSignedIn()) {
    showGate("Please sign in with an administrator account.");
    return;
  }

  try {
    if (await isAdministrator()) {
      gate.hidden = true;
      panel.hidden = false;
      await loadOrders();
    } else {
      showGate("This account does not have administrator access.", "error");
    }
  } catch (error) {
    showGate(error.message, "error");
  }
}

document.getElementById("admin-login").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(event.target);
  setStatus("Signing in...");

  try {
    await signIn(String(data.get("email")).trim(), String(data.get("password")));
    await start();
  } catch (error) {
    setStatus(error.message, "error");
  }
});

document.getElementById("forgot-btn").addEventListener("click", async () => {
  const loginForm = document.getElementById("admin-login");
  const email = String(new FormData(loginForm).get("email") || "").trim();

  if (!email) {
    setStatus("Enter your email address first, then tap the reset link.", "error");
    return;
  }

  try {
    await sendPasswordReset(email);
    resetEmail = email;
    loginForm.hidden = true;
    document.getElementById("reset-otp-form").hidden = false;
    setStatus("Check " + email + " for a 6-digit code.", "success");
  } catch (error) {
    setStatus(error.message || "We could not send the reset email right now.", "error");
  }
});

document.getElementById("reset-otp-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(event.target);
  setStatus("Verifying code...");

  try {
    await verifyRecoveryCode(resetEmail, String(data.get("code")).trim());
    await setNewPassword(String(data.get("newPassword")));
    setStatus("Password updated. Signing you in...", "success");
    document.getElementById("reset-otp-form").hidden = true;
    await start();
  } catch (error) {
    setStatus(error.message || "That code did not work. Please check it and try again.", "error");
  }
});

document.getElementById("reset-otp-cancel").addEventListener("click", () => {
  document.getElementById("reset-otp-form").hidden = true;
  document.getElementById("admin-login").hidden = false;
  setStatus("");
});

document.getElementById("admin-signout").addEventListener("click", async () => {
  await signOut();
  window.location.href = "/site/index.html";
});

document.getElementById("refresh-orders").addEventListener("click", () => {
  loadOrders().catch((error) => setStatus(error.message, "error"));
});

statusFilter.addEventListener("change", render);
searchInput.addEventListener("input", render);

listBox.addEventListener("click", async (event) => {
  const verifyButton = event.target.closest("[data-verify-payment]");
  if (verifyButton) {
    const card = verifyButton.closest("[data-order]");
    const note = card.querySelector("[data-row-message]");
    const record = orders.find((order) => order.id === card.dataset.order);
    const session = getSession();

    if (!confirm("Confirm that you have checked this payment against the bank/UPI account?")) return;

    verifyButton.disabled = true;
    note.textContent = "Verifying...";
    note.className = "form-message";

    // Deliberately touches only payment/status fields — never subtotal,
    // delivery_charge or total, so a verification click can never change
    // what the customer owes.
    const payload = {
      payment_status: "paid",
      status: record && record.status === "placed" ? "confirmed" : record ? record.status : "confirmed",
      payment_verified_at: new Date().toISOString(),
      paid_at: new Date().toISOString(),
      admin_verified_by: session && session.user ? session.user.id : null,
    };

    try {
      await authFetch("/orders?id=eq." + card.dataset.order, { method: "PATCH", body: payload });
      if (record) Object.assign(record, payload);
      note.textContent = "Payment verified and order confirmed.";
      note.className = "form-message success";
      render();
    } catch (error) {
      note.textContent = error.message;
      note.className = "form-message error";
      verifyButton.disabled = false;
    }
    return;
  }

  const button = event.target.closest("[data-save]");
  if (!button) return;

  const card = button.closest("[data-order]");
  const note = card.querySelector("[data-row-message]");
  const payload = {
    status: card.querySelector("[data-status]").value,
    payment_status: card.querySelector("[data-payment]").value,
  };
  const record = orders.find((order) => order.id === card.dataset.order);
  const becameDelivered = record && record.status !== "delivered" && payload.status === "delivered";

  if (payload.payment_status === "paid") payload.paid_at = new Date().toISOString();

  button.disabled = true;
  note.textContent = "Saving...";
  note.className = "form-message";

  try {
    await authFetch("/orders?id=eq." + card.dataset.order, { method: "PATCH", body: payload });
    if (record) Object.assign(record, payload);
    note.textContent = becameDelivered
      ? "Marked delivered. Customer delivery confirmation is ready to send when email is activated."
      : "Updated.";
    note.className = "form-message success";
    renderStats();
  } catch (error) {
    note.textContent = error.message;
    note.className = "form-message error";
  } finally {
    button.disabled = false;
  }
});

start();
