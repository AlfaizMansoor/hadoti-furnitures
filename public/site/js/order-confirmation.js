// Order confirmation and tracking page.
// Reads ?order=<order number> and shows the placed order with its items,
// delivery charge, payment status and a delivery progress tracker.
import { authFetch, isSignedIn } from "./session.js";
import { formatPrice, updateHeaderCounts } from "./ui.js";
import { BUSINESS, DELIVERY_POLICY, WARRANTY_POLICY } from "./business.js";

const params = new URLSearchParams(window.location.search);
const orderNumber = (params.get("order") || "").trim();
const justPlaced = params.get("placed") === "1";

if (!isSignedIn()) {
  window.location.replace(
    "/site/auth.html?next=" + encodeURIComponent("/site/order.html" + window.location.search)
  );
}

const title = document.getElementById("order-title");
const subtitle = document.getElementById("order-subtitle");
const message = document.getElementById("order-message");
const view = document.getElementById("order-view");

const STAGES = [
  { value: "placed", label: "Order placed" },
  { value: "confirmed", label: "Confirmed" },
  { value: "in_production", label: "In production" },
  { value: "dispatched", label: "Dispatched" },
  { value: "delivered", label: "Delivered" },
];

const FIELDS =
  "id,order_number,status,payment_status,payment_method,payment_reference,contact_name,contact_phone," +
  "contact_email,address_line1,address_line2,landmark,city,state,pincode,notes,subtotal,delivery_charge,total," +
  "created_at,razorpay_payment_id,payment_verified_at," +
  "order_items(product_name,sku,unit_price,quantity,line_total)";

// What each payment state means to the customer, in plain words.
const PAYMENT_NOTES = {
  paid: { tone: "success", text: "Payment received and verified. Your order is confirmed." },
  verifying: {
    tone: "",
    text: "We are matching your payment reference against our account. Your order is confirmed as soon as it clears.",
  },
  awaiting_payment: {
    tone: "error",
    text: "This order has not been paid for yet. Nothing is reserved until payment succeeds.",
  },
  pending: { tone: "", text: "Payment is still pending on this order." },
  failed: {
    tone: "error",
    text: "The last payment attempt did not go through. No money was taken for it.",
  },
  refunded: { tone: "", text: "This order has been refunded." },
};

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

function show(text, tone) {
  message.textContent = text || "";
  message.className = "form-message" + (tone ? " " + tone : "");
}

function tracker(order) {
  if (order.status === "cancelled") {
    return '<div class="track-cancelled">This order was cancelled. Please call ' + BUSINESS.mobile + " if this is unexpected.</div>";
  }

  const current = STAGES.findIndex((stage) => stage.value === order.status);
  const reached = current < 0 ? 0 : current;

  return (
    '<ol class="track-steps">' +
    STAGES.map(
      (stage, index) =>
        '<li class="track-step' + (index <= reached ? " done" : "") + (index === reached ? " current" : "") + '">' +
        '<span class="track-dot" aria-hidden="true"></span><span>' + stage.label + "</span></li>"
    ).join("") +
    "</ol>"
  );
}

function paymentNote(order) {
  const note = PAYMENT_NOTES[order.payment_status];
  if (!note) return "";

  const verified =
    order.payment_status === "paid" && order.payment_verified_at
      ? '<p class="note">Verified on ' + formatDate(order.payment_verified_at) +
        (order.razorpay_payment_id ? " &middot; Payment ID " + order.razorpay_payment_id : "") +
        "</p>"
      : "";

  return '<p class="pay-state ' + (note.tone || "") + '">' + note.text + "</p>" + verified;
}

function itemsTable(order) {
  const items = Array.isArray(order.order_items) ? order.order_items : [];

  return (
    '<table class="order-table"><thead><tr><th>Product</th><th>Unit price</th><th>Qty</th><th>Total</th></tr></thead><tbody>' +
    items
      .map(
        (item) =>
          "<tr><td>" + item.product_name + "</td><td>" + formatPrice(Number(item.unit_price)) +
          "</td><td>" + item.quantity + "</td><td>" + formatPrice(Number(item.line_total)) + "</td></tr>"
      )
      .join("") +
    "</tbody></table>"
  );
}

// Shown once, right after the customer lands here from checkout. Revisiting
// the order later (from the account page, or a shared tracking link) skips
// straight to the plain tracking view below — the celebration is a one-time
// moment, not a permanent banner.
function heroBanner(order) {
  if (!justPlaced) return "";

  if (order.payment_status === "paid") {
    return (
      '<section class="order-hero order-hero-confirmed">' +
      '<svg class="hero-check" viewBox="0 0 52 52"><circle class="hero-check-ring" cx="26" cy="26" r="24" fill="none"></circle>' +
      '<path class="hero-check-tick" fill="none" d="M14 27l7 7 16-16"></path></svg>' +
      "<h2>Order Confirmed!</h2>" +
      "<p>Order <strong>" + order.order_number + "</strong> is paid and confirmed. We are getting it ready.</p>" +
      '<a class="btn" href="/site/index.html">Continue Shopping</a>' +
      "</section>"
    );
  }

  return (
    '<section class="order-hero order-hero-pending">' +
    '<svg class="hero-pending-icon" viewBox="0 0 52 52"><circle cx="26" cy="26" r="24" fill="none"></circle>' +
    '<path d="M26 14v12l8 6" fill="none"></path></svg>' +
    "<h2>Order Received &mdash; Payment Verification Pending</h2>" +
    "<p>Order <strong>" + order.order_number + "</strong> is saved. Once we match your " +
    readable(order.payment_method) + " payment against our account, it will be confirmed.</p>" +
    "</section>"
  );
}

// A single, short confetti burst for the confirmed case only. Removes itself
// from the page once the animation finishes.
function launchConfetti() {
  const canvas = document.createElement("canvas");
  canvas.className = "confetti-canvas";
  document.body.appendChild(canvas);
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const ctx = canvas.getContext("2d");
  const colors = ["#c9a15a", "#6b4423", "#3d6b45", "#a6382e", "#e8d9bd"];
  const pieces = Array.from({ length: 60 }, () => ({
    x: canvas.width / 2 + (Math.random() - 0.5) * 60,
    y: canvas.height * 0.25 + (Math.random() - 0.5) * 40,
    vx: (Math.random() - 0.5) * 9,
    vy: -Math.random() * 9 - 4,
    size: Math.random() * 6 + 4,
    color: colors[Math.floor(Math.random() * colors.length)],
    spin: Math.random() * Math.PI,
    spinSpeed: (Math.random() - 0.5) * 0.3,
  }));

  const DURATION = 1500;
  let start = null;

  function frame(timestamp) {
    if (!start) start = timestamp;
    const elapsed = timestamp - start;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const piece of pieces) {
      piece.vy += 0.22;
      piece.x += piece.vx;
      piece.y += piece.vy;
      piece.spin += piece.spinSpeed;

      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - elapsed / DURATION);
      ctx.translate(piece.x, piece.y);
      ctx.rotate(piece.spin);
      ctx.fillStyle = piece.color;
      ctx.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size * 0.6);
      ctx.restore();
    }

    if (elapsed < DURATION) {
      requestAnimationFrame(frame);
    } else {
      canvas.remove();
    }
  }

  requestAnimationFrame(frame);
}

function render(order) {
  const items = Array.isArray(order.order_items) ? order.order_items : [];
  const pieces = items.reduce((sum, item) => sum + Number(item.quantity), 0);
  const address = [order.address_line1, order.address_line2, order.landmark, order.city, order.state, order.pincode]
    .filter(Boolean)
    .join(", ");
  const trackingLink = window.location.origin + "/site/order.html?order=" + encodeURIComponent(order.order_number);

  title.textContent = justPlaced ? "Thank you for your order" : "Order " + order.order_number;
  subtitle.textContent = justPlaced
    ? "Order " + order.order_number + " has been placed. You can follow its delivery progress here."
    : "Placed on " + formatDate(order.created_at);

  view.hidden = false;
  view.innerHTML =
    heroBanner(order) +
    '<div class="order-confirm">' +
    '<section class="order-block">' +
    "<h2>Delivery tracking</h2>" +
    tracker(order) +
    '<p class="note">Current status: <strong>' + readable(order.status) + "</strong> &middot; Payment: <strong>" +
    readable(order.payment_status) + "</strong> (" + readable(order.payment_method) + ")" +
    (order.payment_reference ? " &middot; Reference " + order.payment_reference : "") +
    "</p>" +
    paymentNote(order) +
    '<p class="note">Track this order any time: <a href="' + trackingLink + '">' + trackingLink + "</a></p>" +
    '<p><button class="btn btn-ghost" type="button" id="copy-tracking">Copy tracking link</button></p>' +
    "</section>" +
    '<section class="order-block">' +
    "<h2>Items</h2>" +
    itemsTable(order) +
    '<div class="order-summary-row"><span>Items subtotal</span><span>' + formatPrice(Number(order.subtotal)) + "</span></div>" +
    '<div class="order-summary-row"><span>Delivery charge (' + pieces + " piece" + (pieces === 1 ? "" : "s") + ")</span><span>" +
    formatPrice(Number(order.delivery_charge)) + "</span></div>" +
    '<div class="order-summary-row total"><span>Order total</span><span>' + formatPrice(Number(order.total)) + "</span></div>" +
    '<p class="note">' + DELIVERY_POLICY.summary + " " + WARRANTY_POLICY.summary + "</p>" +
    "</section>" +
    '<section class="order-block">' +
    "<h2>Delivery address</h2>" +
    "<p><strong>" + order.contact_name + "</strong><br>" + address + "</p>" +
    "<p>" + order.contact_phone + (order.contact_email ? " &middot; " + order.contact_email : "") + "</p>" +
    (order.notes ? "<p><em>" + order.notes + "</em></p>" : "") +
    '<p class="note">Questions about this order? Call ' + BUSINESS.mobile + " or write to " + BUSINESS.email + ".</p>" +
    '<p><a class="btn" href="/site/account.html">View all orders</a> <a class="btn btn-ghost" href="/site/index.html">Continue shopping</a></p>' +
    "</section>" +
    "</div>";

  const copyButton = document.getElementById("copy-tracking");
  copyButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(trackingLink);
      show("Tracking link copied.", "success");
    } catch (error) {
      show("Copy the link from the address above.", "error");
    }
  });

  if (justPlaced && order.payment_status === "paid") {
    launchConfetti();
  }
}

async function load() {
  if (!orderNumber) {
    subtitle.textContent = "No order was selected.";
    show("Open an order from your account page to see its details.", "error");
    return;
  }

  try {
    const rows = await authFetch(
      "/orders?select=" + FIELDS + "&order_number=eq." + encodeURIComponent(orderNumber) + "&limit=1"
    );

    if (!rows || !rows.length) {
      subtitle.textContent = "Order not found.";
      show("We could not find order " + orderNumber + " on your account.", "error");
      return;
    }

    render(rows[0]);
    if (justPlaced) show("Your order has been placed successfully.", "success");
  } catch (error) {
    subtitle.textContent = "Order could not be loaded.";
    show(error.message, "error");
  }
}

updateHeaderCounts();
load();
