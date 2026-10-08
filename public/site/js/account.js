// Account page: profile details, order history and logout.
import { authFetch, fetchProfile, isAdmin, isSignedIn, saveProfile, signOut } from "./session.js";
import { formatPrice, updateHeaderCounts, esc } from "./ui.js";

if (!isSignedIn()) {
  window.location.replace("/site/auth.html?next=/site/account.html");
}

isAdmin().then((admin) => {
  if (admin) document.getElementById("admin-nav-link").hidden = false;
});

const profileForm = document.getElementById("profile-form");
const profileMessage = document.getElementById("profile-message");
const ordersList = document.getElementById("orders-list");
const subtitle = document.getElementById("account-subtitle");

const PAYMENT_LABELS = {
  paid: "Paid",
  verifying: "Payment being verified",
  awaiting_payment: "Not paid",
  failed: "Payment failed",
  refunded: "Refunded",
  pending: "Payment pending",
};

function statusLabel(order) {
  const status = order.status.charAt(0).toUpperCase() + order.status.slice(1);
  const payment = PAYMENT_LABELS[order.payment_status] || "Payment pending";
  return status + " &middot; " + payment;
}

function orderMarkup(order) {
  const items = Array.isArray(order.order_items) ? order.order_items : [];
  const placed = new Date(order.created_at).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    '<article class="order-card">' +
    '<div class="order-head"><strong>' + order.order_number + "</strong><span>" + placed + "</span></div>" +
    '<p class="order-status">' + statusLabel(order) + "</p>" +
    "<ul>" +
    items
      .map(
        (item) =>
          "<li>" + esc(item.product_name) + " &times; " + item.quantity + "<span>" + formatPrice(Number(item.line_total)) + "</span></li>"
      )
      .join("") +
    "</ul>" +
    '<div class="order-total"><span>Order total</span><strong>' + formatPrice(Number(order.total)) + "</strong></div>" +
    '<p class="order-address">Delivering to ' + esc(order.address_line1) + ", " + esc(order.city) + ", " + esc(order.state) + " " + esc(order.pincode) + "</p>" +
    '<p><a class="btn btn-ghost" href="/site/order.html?order=' + encodeURIComponent(order.order_number) + '">View details &amp; track</a></p>' +
    "</article>"
  );
}

async function loadProfile() {
  try {
    const profile = await fetchProfile();
    if (!profile) return;

    profileForm.elements.fullName.value = profile.full_name;
    profileForm.elements.phone.value = profile.phone;
    subtitle.textContent = "Customer ID " + profile.customer_code;
  } catch (error) {
    profileMessage.textContent = error.message;
    profileMessage.className = "form-message error";
  }
}

async function loadOrders() {
  ordersList.innerHTML = '<p class="empty">Loading your orders...</p>';

  try {
    const orders = await authFetch(
      "/orders?select=id,order_number,status,payment_status,total,created_at,address_line1,city,state,pincode," +
        "order_items(product_name,quantity,line_total)&order=created_at.desc"
    );

    ordersList.innerHTML = orders.length
      ? orders.map(orderMarkup).join("")
      : '<p class="empty">No orders yet. <a href="/site/index.html">Browse the collection</a>.</p>';
  } catch (error) {
    ordersList.innerHTML = '<p class="empty">' + error.message + "</p>";
  }
}

profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(profileForm);
  profileMessage.textContent = "Saving...";
  profileMessage.className = "form-message";

  try {
    await saveProfile({
      full_name: String(data.get("fullName")).trim(),
      phone: String(data.get("phone")).trim(),
    });
    profileMessage.textContent = "Your details are saved.";
    profileMessage.className = "form-message success";
  } catch (error) {
    profileMessage.textContent = error.message;
    profileMessage.className = "form-message error";
  }
});

document.getElementById("logout-btn").addEventListener("click", async () => {
  await signOut();
  window.location.href = "/site/index.html";
});

updateHeaderCounts();
loadProfile();
loadOrders();
