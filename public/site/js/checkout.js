// Checkout: delivery details, order summary, payment and order placement.
//
// The browser no longer writes orders to the database. It sends the cart and
// the delivery details to the create-payment-order edge function, which
// recalculates every price from the products table. For online payments the
// Razorpay popup opens and the resulting signature is checked by the
// verify-payment edge function before the order is confirmed.
import { fetchProductsByIds } from "./api.js";
import { clearCart, getCart } from "./store.js";
import { formatPrice, isSoldOut, sellingPrice, updateHeaderCounts } from "./ui.js";
import {
  BUSINESS,
  DELIVERY_POLICY,
  PAYMENT,
  WARRANTY_POLICY,
  isOnlineMethod,
  upiPayUrl,
  upiQrUrl,
} from "./business.js";
import { fetchProfile, functionFetch, getSession, isSignedIn } from "./session.js";

if (!isSignedIn()) {
  window.location.replace("/site/auth.html?next=/site/checkout.html");
}

const form = document.getElementById("checkout-form");
const summaryBox = document.getElementById("checkout-summary");
const message = document.getElementById("checkout-message");
const methodsBox = document.getElementById("payment-methods");
const detailsBox = document.getElementById("payment-details");
const button = document.getElementById("place-order");
const successModal = document.getElementById("success-modal");
const successOrderText = document.getElementById("success-order-text");
const successContinueBtn = document.getElementById("success-continue");
const DELIVERY_CHARGE_PER_PIECE = DELIVERY_POLICY.standardCharge;
const RAZORPAY_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

let entries = [];
// Razorpay is the default and only method shown up front; UPI and bank
// transfer are tucked behind the "pay another way" toggle for customers who
// cannot pay online.
let paymentMethod = "razorpay";
let submitting = false;

function totals() {
  const subtotal = entries.reduce((sum, entry) => sum + sellingPrice(entry.product) * entry.quantity, 0);
  const pieces = entries.reduce((sum, entry) => sum + entry.quantity, 0);
  const delivery = pieces * DELIVERY_CHARGE_PER_PIECE;
  return { subtotal: subtotal, pieces: pieces, delivery: delivery, total: subtotal + delivery };
}

function renderSummary() {
  const sums = totals();

  summaryBox.innerHTML =
    "<h2>Order Summary</h2>" +
    entries
      .map(
        (entry) =>
          '<div class="summary-row"><span>' + entry.product.name + " &times; " + entry.quantity + "</span><span>" +
          formatPrice(sellingPrice(entry.product) * entry.quantity) + "</span></div>"
      )
      .join("") +
    '<div class="summary-row"><span>Subtotal</span><span>' + formatPrice(sums.subtotal) + "</span></div>" +
    '<div class="summary-row"><span>Delivery (' + sums.pieces + " piece" + (sums.pieces === 1 ? "" : "s") + ")</span><span>" +
    formatPrice(sums.delivery) + "</span></div>" +
    '<div class="summary-row total"><span>Payable</span><span>' + formatPrice(sums.total) + "</span></div>" +
    '<p class="note">' + DELIVERY_POLICY.summary + " " + WARRANTY_POLICY.summary + "</p>" +
    '<p class="note">This total is confirmed again on our server before payment, so the amount you pay always matches current prices.</p>';
}

function renderMethods() {
  const primary = PAYMENT.methods.find((method) => method.value === "razorpay") || PAYMENT.methods[0];
  const backups = PAYMENT.methods.filter((method) => method.value !== primary.value);

  methodsBox.innerHTML =
    "<legend>Payment Method</legend>" +
    '<label class="pay-option pay-option-primary"><input type="radio" name="paymentMethod" value="' +
    primary.value + '" checked><span>' + primary.label +
    (primary.note ? '<small class="pay-option-note">' + primary.note + "</small>" : "") + "</span></label>" +
    '<button type="button" class="link-btn" id="backup-toggle">Cannot pay online? Use UPI or bank transfer</button>' +
    '<div id="backup-methods" hidden>' +
    backups
      .map(
        (method) =>
          '<label class="pay-option"><input type="radio" name="paymentMethod" value="' + method.value + '"><span>' +
          method.label + (method.note ? '<small class="pay-option-note">' + method.note + "</small>" : "") +
          "</span></label>"
      )
      .join("") +
    "</div>";

  document.getElementById("backup-toggle").addEventListener("click", () => {
    const box = document.getElementById("backup-methods");
    const opening = box.hidden;
    box.hidden = !opening;

    if (opening) {
      // Picking a backup method only makes sense once it is visible; nothing
      // is auto-selected until the customer actually chooses one.
      box.querySelector('input[type="radio"]').focus();
    }
  });
}

function renderPaymentDetails() {
  const sums = totals();
  const note = "Hadoti Furnitures order";

  if (paymentMethod === "razorpay") {
    detailsBox.innerHTML =
      '<div class="pay-box">' +
      "<h4>Pay " + formatPrice(sums.total) + " online</h4>" +
      "<p>The secure Razorpay window opens when you place the order. Pay by UPI, card, net banking or wallet.</p>" +
      '<p class="note">Your payment is verified on our server before the order is confirmed. Do not close the window until you see the confirmation page.</p>' +
      "</div>";
    setButtonLabel();
    return;
  }

  if (paymentMethod === "upi") {
    detailsBox.innerHTML =
      '<div class="pay-box">' +
      "<h4>Pay " + formatPrice(sums.total) + " by UPI</h4>" +
      '<div class="pay-upi">' +
      '<img class="pay-qr" src="' + upiQrUrl(sums.total, note) + '" alt="UPI payment QR code" width="220" height="220">' +
      "<div><p>Scan the code with any UPI app, or pay to:</p>" +
      '<p class="pay-id">' + PAYMENT.upi.id + "</p>" +
      '<p><a class="btn btn-ghost" href="' + upiPayUrl(sums.total, note) + '">Open UPI app</a></p></div>' +
      "</div>" +
      '<label>UPI transaction reference<input type="text" name="paymentReference" placeholder="12 digit UPI reference number" required></label>' +
      '<p class="note">Pay first, then enter the reference here. We match it against our account and confirm your order.</p>' +
      (PAYMENT.sample
        ? '<p class="note">These are sample payment details. Replace them with your real UPI ID and bank account when your accounts are ready.</p>'
        : "") +
      "</div>";
    setButtonLabel();
    return;
  }

  detailsBox.innerHTML =
    '<div class="pay-box">' +
    "<h4>Transfer " + formatPrice(sums.total) + " by NEFT or IMPS</h4>" +
    '<table class="spec-table"><tbody>' +
    "<tr><th>Account name</th><td>" + PAYMENT.bank.accountName + "</td></tr>" +
    "<tr><th>Account number</th><td>" + PAYMENT.bank.accountNumber + "</td></tr>" +
    "<tr><th>IFSC</th><td>" + PAYMENT.bank.ifsc + "</td></tr>" +
    "<tr><th>Bank</th><td>" + PAYMENT.bank.bankName + "</td></tr>" +
    "</tbody></table>" +
    '<label>Transfer reference number<input type="text" name="paymentReference" placeholder="Bank transaction reference" required></label>' +
    '<p class="note">Transfer first, then enter the reference here. We confirm your order once the amount lands in our account.</p>' +
    (PAYMENT.sample
      ? '<p class="note">These are sample payment details. Replace them with your real UPI ID and bank account when your accounts are ready.</p>'
      : "") +
    "</div>";
  setButtonLabel();
}

function setButtonLabel() {
  if (submitting) return;
  const sums = totals();
  button.textContent = isOnlineMethod(paymentMethod)
    ? "Proceed to Payment \u2014 " + formatPrice(sums.total)
    : "Place Order";
}

function show(text, kind) {
  message.textContent = text;
  message.className = "form-message " + (kind || "");
}

function lock(state, label) {
  submitting = state;
  button.disabled = state;
  if (state && label) button.textContent = label;
  if (!state) setButtonLabel();
}

/* Razorpay ---------------------------------------------------------------- */
// Loaded on demand so the script never blocks a customer paying by UPI.
function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve();

  const existing = document.querySelector('script[data-razorpay]');
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("The payment window could not be loaded.")));
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = RAZORPAY_SCRIPT;
    script.async = true;
    script.dataset.razorpay = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("The payment window could not be loaded. Check your connection."));
    document.head.appendChild(script);
  });
}

function goToOrder(orderNumber) {
  clearCart();
  window.location.href = "/site/order.html?order=" + encodeURIComponent(orderNumber) + "&placed=1";
}

// The green-tick popup is only for payments our server has actually
// verified — a Razorpay payment that passed signature and amount checks.
// UPI and bank transfer orders go straight to the order page instead,
// because those are not verified yet at this point and saying "confirmed"
// would be misleading.
function showSuccessModal(orderNumber) {
  clearCart();
  successOrderText.textContent = "Order " + orderNumber + " is confirmed and being prepared.";
  successModal.hidden = false;

  successContinueBtn.onclick = () => {
    window.location.href = "/site/order.html?order=" + encodeURIComponent(orderNumber) + "&placed=1";
  };
}

// Opens the Razorpay popup and settles the order once the payment returns.
function payWithRazorpay(created) {
  return new Promise((resolve) => {
    const checkout = new window.Razorpay({
      key: created.razorpayKeyId,
      amount: created.amount,
      currency: created.currency || "INR",
      name: BUSINESS.storeName,
      description: "Order " + created.orderNumber,
      order_id: created.razorpayOrderId,
      prefill: {
        name: created.customer ? created.customer.name : "",
        email: created.customer ? created.customer.email : "",
        contact: created.customer ? created.customer.contact : "",
      },
      notes: { order_number: created.orderNumber },
      theme: { color: "#6b4423" },
      retry: { enabled: false },
      handler: async function (response) {
        show("Verifying your payment. Please wait, do not close this page...");

        try {
          const verified = await functionFetch("verify-payment", {
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });

          show("Payment verified. Confirming your order...", "success");
          showSuccessModal(verified.orderNumber || created.orderNumber);
        } catch (error) {
          // The money may well have left the customer's account, so never tell
          // them to simply pay again.
          lock(false);
          show(
            (error.message || "We could not verify this payment.") +
              " Your order number is " + created.orderNumber +
              ". Please call " + BUSINESS.mobile + " before paying again.",
            "error"
          );
        }

        resolve();
      },
      modal: {
        ondismiss: function () {
          lock(false);
          show(
            "Payment was cancelled. Order " + created.orderNumber +
              " is saved and unpaid \u2014 you can pay for it from your account page.",
            "error"
          );
          resolve();
        },
      },
    });

    checkout.on("payment.failed", function (response) {
      const reason = (response && response.error && response.error.description) || "The payment did not go through.";
      lock(false);
      show(reason + " Order " + created.orderNumber + " is saved and unpaid. Please try again.", "error");
      resolve();
    });

    checkout.open();
  });
}

/* Page load --------------------------------------------------------------- */
async function start() {
  const lines = getCart();

  if (!lines.length) {
    window.location.replace("/site/cart.html");
    return;
  }

  let products = [];
  try {
    products = await fetchProductsByIds(lines.map((line) => line.productId));
  } catch (error) {
    show("We could not load your cart. Please refresh the page.", "error");
    return;
  }

  entries = lines
    .map((line) => ({
      product: products.find((product) => product.id === line.productId) || null,
      quantity: line.quantity,
    }))
    .filter((entry) => entry.product && !isSoldOut(entry.product));

  if (!entries.length) {
    window.location.replace("/site/cart.html");
    return;
  }

  renderSummary();
  renderMethods();
  renderPaymentDetails();

  // Warm the payment script up while the customer fills the form.
  loadRazorpay().catch(() => {
    /* retried on submit, with a message the customer can act on */
  });

  // The account email is a sensible starting point, but the customer can
  // still edit it — order updates might need to go somewhere else.
  const session = getSession();
  if (session && session.user && session.user.email) {
    form.elements.contactEmail.value = session.user.email;
  }

  try {
    const profile = await fetchProfile();
    if (profile) {
      form.elements.contactName.value = profile.full_name;
      form.elements.contactPhone.value = profile.phone;
    }
  } catch (error) {
    /* the customer can still type the details */
  }
}

/* Submit ------------------------------------------------------------------ */
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (submitting) return;

  const data = new FormData(form);
  const online = isOnlineMethod(paymentMethod);
  const reference = String(data.get("paymentReference") || "").trim();

  if (!online && !reference) {
    show("Please enter the payment reference number after paying.", "error");
    return;
  }

  lock(true, online ? "Opening payment..." : "Placing your order...");
  show(online ? "Preparing your payment..." : "Placing your order...");

  try {
    if (online) await loadRazorpay();

    const created = await functionFetch("create-payment-order", {
      paymentMethod: paymentMethod,
      contactName: String(data.get("contactName")).trim(),
      contactPhone: String(data.get("contactPhone")).trim(),
      contactEmail: String(data.get("contactEmail")).trim(),
      addressLine1: String(data.get("addressLine1")).trim(),
      addressLine2: String(data.get("addressLine2")).trim(),
      landmark: String(data.get("landmark") || "").trim(),
      city: String(data.get("city")).trim(),
      state: String(data.get("state")).trim(),
      pincode: String(data.get("pincode")).trim(),
      notes: String(data.get("notes") || "").trim(),
      paymentReference: reference,
      lines: entries.map((entry) => ({ productId: entry.product.id, quantity: entry.quantity })),
    });

    if (created.mode === "razorpay") {
      show("Complete the payment in the window that just opened.");
      await payWithRazorpay(created);
      return;
    }

    goToOrder(created.orderNumber);
  } catch (error) {
    lock(false);
    show(error.message || "We could not place your order. Please try again.", "error");

    if (String(error.message || "").includes("session has expired")) {
      setTimeout(() => {
        window.location.href = "/site/auth.html?next=/site/checkout.html";
      }, 1800);
    }
  }
});

methodsBox.addEventListener("change", (event) => {
  const option = event.target.closest('input[name="paymentMethod"]');
  if (!option) return;

  paymentMethod = option.value;
  renderPaymentDetails();
});

updateHeaderCounts();
start();
