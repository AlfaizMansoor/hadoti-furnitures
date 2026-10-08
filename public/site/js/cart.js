// Cart page: reads the stored lines, loads the matching products and
// keeps the totals in sync with every quantity change.
import { fetchProductsByIds } from "./api.js";
import { getCart, setCartQuantity, removeFromCart, clearCart } from "./store.js";
import { formatPrice, sellingPrice, isSoldOut, primaryImage, esc, updateHeaderCounts } from "./ui.js";
import { DELIVERY_POLICY, WARRANTY_POLICY } from "./business.js";
import { isSignedIn } from "./session.js";

const linesBox = document.getElementById("cart-lines");
const summaryBox = document.getElementById("cart-summary");
const DELIVERY_CHARGE_PER_PIECE = DELIVERY_POLICY.standardCharge;

let products = [];

function findProduct(productId) {
  return products.find((product) => product.id === productId) || null;
}

function activeLines() {
  return getCart()
    .map((line) => ({ line: line, product: findProduct(line.productId) }))
    .filter((entry) => entry.product !== null);
}

function lineMarkup(entry) {
  const product = entry.product;
  const quantity = entry.line.quantity;
  const unit = sellingPrice(product);
  const link = "/site/product.html?product=" + encodeURIComponent(product.slug);
  const soldOut = isSoldOut(product);
  const overStock = !soldOut && quantity > product.stock;

  let notice = "";
  if (soldOut) {
    notice = '<p class="meta">This piece is sold out and will not be ordered.</p>';
  } else if (overStock) {
    notice = '<p class="meta">Only ' + product.stock + " left in stock.</p>";
  }

  return (
    '<div class="cart-line">' +
    '<a href="' + link + '"><img src="' + esc(primaryImage(product)) + '" alt="' + esc(product.name) + '" width="108" height="108"></a>' +
    "<div>" +
    "<h3><a href=\"" + link + '">' + esc(product.name) + "</a></h3>" +
    '<p class="meta">SKU ' + esc(product.sku) + " &middot; " + formatPrice(unit) + " each</p>" +
    notice +
    '<div class="qty">' +
    '<button type="button" data-step="-1" data-id="' + product.id + '" aria-label="Decrease quantity">&minus;</button>' +
    "<span>" + quantity + "</span>" +
    '<button type="button" data-step="1" data-id="' + product.id + '" aria-label="Increase quantity">+</button>' +
    "</div>" +
    "</div>" +
    '<div class="line-end">' +
    "<strong>" + formatPrice(unit * quantity) + "</strong>" +
    '<button type="button" class="link-btn" data-remove="' + product.id + '">Remove</button>' +
    "</div>" +
    "</div>"
  );
}

function summaryMarkup(entries) {
  const payable = entries.filter((entry) => !isSoldOut(entry.product));
  const subtotal = payable.reduce(
    (total, entry) => total + sellingPrice(entry.product) * entry.line.quantity,
    0
  );
  const savings = payable.reduce((total, entry) => {
    const product = entry.product;
    if (product.discount_price == null) return total;
    return total + (Number(product.price) - Number(product.discount_price)) * entry.line.quantity;
  }, 0);
  const pieces = payable.reduce((total, entry) => total + entry.line.quantity, 0);
  const delivery = pieces * DELIVERY_CHARGE_PER_PIECE;

  return (
    "<h2>Order Summary</h2>" +
    '<div class="summary-row"><span>Subtotal</span><span>' + formatPrice(subtotal) + "</span></div>" +
    (savings > 0
      ? '<div class="summary-row"><span>You save</span><span>-' + formatPrice(savings) + "</span></div>"
      : "") +
    '<div class="summary-row"><span>Delivery (' + pieces + ' piece' + (pieces === 1 ? "" : "s") + ")</span><span>" +
    (delivery === 0 ? "Free" : formatPrice(delivery)) +
    "</span></div>" +
    '<div class="summary-row total"><span>Payable</span><span>' + formatPrice(subtotal + delivery) + "</span></div>" +
    '<button class="btn" type="button" id="checkout-btn"' + (payable.length ? "" : " disabled") + ">Proceed to Checkout</button>" +
    '<p class="note">' + DELIVERY_POLICY.summary + " " + WARRANTY_POLICY.summary +
    "</p>"
  );
}

function render() {
  const entries = activeLines();
  updateHeaderCounts();

  if (!entries.length) {
    linesBox.innerHTML =
      '<p class="empty">Your cart is empty. <a href="/site/index.html">Browse the collection</a>.</p>';
    summaryBox.innerHTML = "";
    return;
  }

  linesBox.innerHTML =
    entries.map(lineMarkup).join("") +
    '<div style="padding-top:18px"><button type="button" class="link-btn" id="clear-cart">Clear cart</button></div>';
  summaryBox.innerHTML = summaryMarkup(entries);
}

function handleClick(event) {
  const stepButton = event.target.closest("[data-step]");
  if (stepButton) {
    const productId = stepButton.dataset.id;
    const current = getCart().find((line) => line.productId === productId);
    if (current) setCartQuantity(productId, current.quantity + Number(stepButton.dataset.step));
    render();
    return;
  }

  const removeButton = event.target.closest("[data-remove]");
  if (removeButton) {
    removeFromCart(removeButton.dataset.remove);
    render();
    return;
  }

  if (event.target.id === "checkout-btn") {
    window.location.href = isSignedIn()
      ? "/site/checkout.html"
      : "/site/auth.html?next=/site/checkout.html";
    return;
  }

  if (event.target.id === "clear-cart") {
    clearCart();
    render();
  }
}

async function start() {
  const ids = getCart().map((line) => line.productId);

  if (ids.length) {
    try {
      products = await fetchProductsByIds(ids);
    } catch (error) {
      linesBox.innerHTML = '<p class="empty">We could not load your cart right now. Please refresh.</p>';
      return;
    }
  }

  render();
  document.addEventListener("click", handleClick);
}

start();
