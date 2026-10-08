// Product detail page: gallery, specifications, stock aware buy actions.
import { fetchProductBySlug, fetchProducts } from "./api.js";
import {
  bindCardActions,
  discountPercent,
  esc,
  formatPrice,
  isSoldOut,
  renderGrid,
  sellingPrice,
  updateHeaderCounts,
} from "./ui.js";
import { addToCart, getViewed, isWishlisted, rememberViewed, toggleWishlist } from "./store.js";
import { setupSearch } from "./search.js";
import { DELIVERY_POLICY, WARRANTY_POLICY } from "./business.js";
import "./flip-details.js";

const view = document.getElementById("product-view");
let current = null;
let quantity = 1;

function specRows(product) {
  const specs = Array.isArray(product.specifications) ? product.specifications : [];
  if (!specs.length) return "";

  return (
    '<h3 style="margin-top:28px">Specifications</h3><table class="spec-table"><tbody>' +
    specs.map((spec) => "<tr><th>" + esc(spec.label) + "</th><td>" + esc(spec.value) + "</td></tr>").join("") +
    "</tbody></table>"
  );
}

function detailSection(product) {
  const text = (product.long_description || "").trim();
  if (!text) return "";

  const paragraphs = text
    .split(/\n{2,}|\r\n\r\n/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => "<p>" + esc(part).replace(/\n/g, "<br>") + "</p>")
    .join("");

  return '<section class="section product-detail-section" id="description"><div class="wrap">' +
    '<div class="section-head"><h2>Product Description</h2><p>Everything you should know about this piece</p></div>' +
    '<div class="detail-copy">' + paragraphs + "</div>" +
    "</div></section>";
}


function render(product) {
  const soldOut = isSoldOut(product);
  const images = Array.isArray(product.images) && product.images.length ? product.images : ["/site/img/hero.jpg"];
  const percent = discountPercent(product);
  const name = esc(product.name);

  view.innerHTML =
    '<div class="product">' +
    "<div>" +
    '<div class="gallery-main"><img id="main-image" src="' + esc(images[0]) + '" alt="' + name + '" data-lightbox="' + esc(images[0]) + '" width="1024" height="1024"></div>' +
    (images.length > 1
      ? '<div class="thumbs">' +
        images.map((src, index) => '<img src="' + esc(src) + '" alt="" data-index="' + index + '" class="' + (index === 0 ? "active" : "") + '">').join("") +
        "</div>"
      : "") +
    "</div>" +
    "<div>" +
    '<span class="card-sku">' + esc(product.sku) + "</span>" +
    "<h1>" + name + "</h1>" +
    '<div class="price"><strong>' + formatPrice(sellingPrice(product)) + "</strong>" +
    (percent ? "<s>" + formatPrice(product.price) + '</s><span class="saving">Save ' + percent + "%</span>" : "") +
    "</div>" +
    '<p class="stock-line' + (soldOut ? " out" : "") + '">' +
    (soldOut ? "Sold Out - this piece is temporarily unavailable." : product.stock + " in stock") +
    "</p>" +
    "<p>" + esc(product.description) + "</p>" +
    '<div class="buy-row">' +
    (soldOut
      ? '<button class="btn" disabled>Sold Out</button>'
      : '<div class="qty"><button type="button" data-step="-1">-</button><span id="qty-value">1</span><button type="button" data-step="1">+</button></div>' +
        '<button class="btn" id="add-button">Add to Cart</button>' +
        '<button class="btn btn-ghost" id="buy-button">Buy Now</button>') +
    '<button class="btn btn-ghost" id="wish-button">' + (isWishlisted(product.id) ? "Saved" : "Add to Wishlist") + "</button>" +
    "</div>" +
    specRows(product) +
    '<h3 style="margin-top:28px">Delivery, Warranty &amp; Returns</h3>' +
    '<ul class="note-list">' +
    "<li>Delivered and assembled within 7 to 12 working days.</li>" +
    "<li>" + DELIVERY_POLICY.summary + "</li>" +
    "<li>" + WARRANTY_POLICY.summary + "</li>" +
    "<li>Returns accepted within 7 days for manufacturing defects.</li>" +
    "</ul>" +
    "</div></div>" +
    detailSection(product);

  document.getElementById("crumb-name").textContent = product.name;
  document.title = product.name + " | Hadoti Furnitures";
}

function resetBuyButton() {
  const button = document.getElementById("buy-button");
  if (!button) return;
  button.disabled = false;
  button.textContent = "Buy Now";
}

// Phones keep the previous page in memory and bring it straight back on the
// Back gesture. Without this, a customer who tapped Buy Now, then swiped back
// from the login/checkout page, found the button still disabled.
window.addEventListener("pageshow", (event) => {
  if (event.persisted) resetBuyButton();
});

function bindDetailActions() {
  view.addEventListener("click", (event) => {
    const thumb = event.target.closest("[data-index]");
    if (thumb) {
      const main = document.getElementById("main-image");
      main.src = thumb.src;
      main.dataset.lightbox = thumb.src;
      view.querySelectorAll(".thumbs img").forEach((item) => item.classList.remove("active"));
      thumb.classList.add("active");
      return;
    }

    const stepButton = event.target.closest("[data-step]");
    if (stepButton) {
      const next = quantity + Number(stepButton.dataset.step);
      quantity = Math.min(Math.max(next, 1), current.stock);
      document.getElementById("qty-value").textContent = quantity;
      return;
    }

    if (event.target.closest("#add-button")) {
      const addButton = event.target.closest("#add-button");
      addToCart(current.id, quantity);
      updateHeaderCounts();
      addButton.textContent = "Added to Cart";
      return;
    }

    // Buy Now skips the cart page and goes straight to checkout, where the
    // payment window opens.
    const buyButton = event.target.closest("#buy-button");
    if (buyButton) {
      addToCart(current.id, quantity);
      try {
        updateHeaderCounts();
      } catch (error) {
        // A header-count glitch must never block the purchase.
      }
      buyButton.disabled = true;
      buyButton.textContent = "Taking you to checkout...";
      // Safety net: if the navigation is interrupted, never leave the button
      // dead. (Phones also restore this page from memory on Back; see the
      // pageshow handler below.)
      window.setTimeout(resetBuyButton, 4000);
      window.location.assign("/site/checkout.html");
      return;
    }

    const wishButton = event.target.closest("#wish-button");
    if (wishButton) {
      const added = toggleWishlist(current.id);
      wishButton.textContent = added ? "Saved" : "Add to Wishlist";
      updateHeaderCounts();
    }
  });
}

async function start() {
  updateHeaderCounts();
  bindCardActions(document.body);
  bindDetailActions();

  const slug = new URLSearchParams(window.location.search).get("product");
  if (!slug) {
    view.innerHTML = '<p class="empty">No product selected. <a href="/site/index.html">Back to home</a></p>';
    return;
  }

  const [product, catalogue] = await Promise.all([fetchProductBySlug(slug), fetchProducts()]);

  if (!product) {
    view.innerHTML = '<p class="empty">This product is no longer available. <a href="/site/index.html">Back to home</a></p>';
    return;
  }

  current = product;
  render(product);

  const viewedIds = getViewed().filter((id) => id !== product.id);
  rememberViewed(product.id);

  // The catalogue has no category field, so "similar" is approximated by
  // price closeness — pieces near the same price point tend to be the same
  // kind of furniture (a bed close in price to another bed, etc). Anything
  // else in the catalogue fills in after that so the section still shows
  // something useful even on a small catalogue.
  const currentPrice = Number(product.discount_price || product.price) || 0;
  const suggested = catalogue
    .filter((item) => item.id !== product.id)
    .sort((a, b) => {
      const priceA = Number(a.discount_price || a.price) || 0;
      const priceB = Number(b.discount_price || b.price) || 0;
      return Math.abs(priceA - currentPrice) - Math.abs(priceB - currentPrice);
    })
    .slice(0, 8);
  if (suggested.length) {
    document.getElementById("suggested-section").hidden = false;
    renderGrid(document.querySelector('[data-grid="suggested"]'), suggested, "");
  }

  const viewed = viewedIds.map((id) => catalogue.find((item) => item.id === id)).filter(Boolean).slice(0, 8);
  if (viewed.length) {
    document.getElementById("viewed-section").hidden = false;
    renderGrid(document.querySelector('[data-grid="viewed"]'), viewed, "");
  }

  setupSearch(catalogue, () => {});
}

start();

