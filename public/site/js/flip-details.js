// Flip-to-fullscreen product details.
// Intercepts the "Details" button on a product card, flips the card, then
// expands a full-screen detail panel. Falls back to the product page when
// the data cannot be loaded or motion is reduced.
import { fetchProductBySlug, fetchProducts } from "./api.js";
import { addToCart, isWishlisted, toggleWishlist } from "./store.js";
import { bindCardActions, discountPercent, formatPrice, isSoldOut, primaryImage, productCard, sellingPrice, updateHeaderCounts } from "./ui.js";
import { DELIVERY_POLICY, WARRANTY_POLICY } from "./business.js";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const cache = new Map();
let cataloguePromise = null;

// Fetched once and reused for every "Similar Products" row, rather than
// re-fetching the whole catalogue every time a details panel opens.
function getCatalogue() {
  if (!cataloguePromise) cataloguePromise = fetchProducts().catch(() => []);
  return cataloguePromise;
}

function similarProductsMarkup(current, catalogue) {
  const currentPrice = Number(current.discount_price || current.price) || 0;
  const similar = catalogue
    .filter((item) => item.id !== current.id)
    .sort((a, b) => {
      const priceA = Number(a.discount_price || a.price) || 0;
      const priceB = Number(b.discount_price || b.price) || 0;
      return Math.abs(priceA - currentPrice) - Math.abs(priceB - currentPrice);
    })
    .slice(0, 4);

  if (!similar.length) return "";

  return (
    '<section class="section" style="padding:32px 0 0">' +
    '<div class="section-head" style="margin-bottom:0"><h2 style="font-size:22px">Similar Products</h2></div>' +
    '<div class="grid" style="margin-top:18px">' + similar.map(productCard).join("") + "</div>" +
    "</section>"
  );
}

let overlay = null;
let activeCard = null;
let activeProduct = null;
let quantity = 1;

function specMarkup(product) {
  const specs = Array.isArray(product.specifications) ? product.specifications : [];
  if (!specs.length) return "";

  return (
    "<h3>Specifications</h3><table class=\"spec-table\"><tbody>" +
    specs.map((spec) => "<tr><th>" + spec.label + "</th><td>" + spec.value + "</td></tr>").join("") +
    "</tbody></table>"
  );
}

function longCopy(product) {
  const text = (product.long_description || "").trim();
  if (!text) return "";

  return (
    "<h3>Product Description</h3>" +
    text
      .split(/\n{2,}/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => "<p>" + part.replace(/\n/g, "<br>") + "</p>")
      .join("")
  );
}

function panelMarkup(product) {
  const soldOut = isSoldOut(product);
  const percent = discountPercent(product);
  const images = Array.isArray(product.images) && product.images.length ? product.images : [primaryImage(product)];

  return (
    '<div class="flip-panel" role="dialog" aria-modal="true" aria-label="' + product.name + ' details">' +
    '<button class="flip-close" type="button" data-flip-close aria-label="Close details">&times;</button>' +
    '<div class="flip-panel-inner">' +
    '<div class="flip-media">' +
    '<img class="flip-main" src="' + images[0] + '" alt="' + product.name + '" data-lightbox="' + images[0] + '" width="1024" height="1024">' +
    (images.length > 1
      ? '<div class="thumbs">' +
        images.map((src, index) => '<img src="' + src + '" alt="" data-flip-thumb class="' + (index === 0 ? "active" : "") + '">').join("") +
        "</div>"
      : "") +
    "</div>" +
    '<div class="flip-info">' +
    '<span class="card-sku">' + product.sku + "</span>" +
    "<h2>" + product.name + "</h2>" +
    '<div class="price"><strong>' + formatPrice(sellingPrice(product)) + "</strong>" +
    (percent ? "<s>" + formatPrice(product.price) + '</s><span class="saving">Save ' + percent + "%</span>" : "") +
    "</div>" +
    '<p class="stock-line' + (soldOut ? " out" : "") + '">' +
    (soldOut ? "Sold Out - this piece is temporarily unavailable." : product.stock + " in stock") +
    "</p>" +
    "<p>" + (product.description || "") + "</p>" +
    '<div class="buy-row">' +
    (soldOut
      ? '<button class="btn" disabled>Sold Out</button>'
      : '<div class="qty"><button type="button" data-flip-step="-1">-</button><span data-flip-qty>1</span><button type="button" data-flip-step="1">+</button></div>' +
        '<button class="btn" data-flip-add>Add to Cart</button>' +
        '<button class="btn" type="button" data-flip-buy>Buy Now</button>') +
    '<button class="btn btn-ghost" data-flip-wish>' + (isWishlisted(product.id) ? "Saved" : "Add to Wishlist") + "</button>" +
    "</div>" +
    specMarkup(product) +
    longCopy(product) +
    "<h3>Delivery, Warranty &amp; Returns</h3>" +
    '<ul class="note-list">' +
    "<li>Delivered and assembled within 7 to 12 working days.</li>" +
    "<li>" + DELIVERY_POLICY.summary + "</li>" +
    "<li>" + WARRANTY_POLICY.summary + "</li>" +
    "<li>Returns accepted within 7 days for manufacturing defects.</li>" +
    "</ul>" +
    "</div></div>" +
    '<div class="wrap" data-similar-slot></div>' +
    "</div>"
  );
}

function closeOverlay() {
  if (!overlay) return;

  overlay.classList.remove("open");
  if (activeCard) activeCard.classList.remove("flipping");
  document.body.classList.remove("flip-locked");

  const node = overlay;
  overlay = null;
  activeCard = null;
  activeProduct = null;

  window.setTimeout(() => node.remove(), reduceMotion ? 0 : 320);
}

function bindPanel() {
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay || event.target.closest("[data-flip-close]")) {
      closeOverlay();
      return;
    }

    const thumb = event.target.closest("[data-flip-thumb]");
    if (thumb) {
      const main = overlay.querySelector(".flip-main");
      main.src = thumb.src;
      main.dataset.lightbox = thumb.src;
      overlay.querySelectorAll("[data-flip-thumb]").forEach((item) => item.classList.remove("active"));
      thumb.classList.add("active");
      return;
    }

    const step = event.target.closest("[data-flip-step]");
    if (step) {
      const next = quantity + Number(step.dataset.flipStep);
      quantity = Math.min(Math.max(next, 1), Math.max(activeProduct.stock, 1));
      overlay.querySelector("[data-flip-qty]").textContent = quantity;
      return;
    }

    const add = event.target.closest("[data-flip-add]");
    if (add) {
      addToCart(activeProduct.id, quantity);
      updateHeaderCounts();
      add.textContent = "Added to Cart";
      window.setTimeout(() => {
        add.textContent = "Add to Cart";
      }, 1400);
      return;
    }

    const buy = event.target.closest("[data-flip-buy]");
    if (buy && activeProduct && !isSoldOut(activeProduct)) {
      addToCart(activeProduct.id, quantity);
      try {
        updateHeaderCounts();
      } catch (error) {
        // A header-count glitch must never block the purchase.
      }
      window.location.assign("/site/checkout.html");
      return;
    }

    const wish = event.target.closest("[data-flip-wish]");
    if (wish) {
      const added = toggleWishlist(activeProduct.id);
      wish.textContent = added ? "Saved" : "Add to Wishlist";
      updateHeaderCounts();
      const cardWish = activeCard && activeCard.querySelector("[data-wish]");
      if (cardWish) cardWish.classList.toggle("on", added);
    }
  });
}

async function loadProduct(slug) {
  if (cache.has(slug)) return cache.get(slug);

  const product = await fetchProductBySlug(slug);
  if (product) cache.set(slug, product);
  return product;
}

async function openDetails(card, slug) {
  const product = await loadProduct(slug);
  if (!product) return false;

  // Opening a "Similar Products" card from inside an already-open panel
  // must close that panel first -- otherwise it stacks a second overlay on
  // top and leaves the first one stuck in the page with no way to close it.
  if (overlay) {
    overlay.remove();
    overlay = null;
    document.body.classList.remove("flip-locked");
  }

  activeCard = card;
  activeProduct = product;
  quantity = 1;

  overlay = document.createElement("div");
  overlay.className = "flip-overlay";
  overlay.innerHTML = panelMarkup(product);
  document.body.appendChild(overlay);
  document.body.classList.add("flip-locked");
  bindPanel();

  requestAnimationFrame(() => {
    if (overlay) overlay.classList.add("open");
  });

  const close = overlay.querySelector("[data-flip-close]");
  if (close) close.focus();

  // Fill in "Similar Products" once the catalogue arrives -- kept separate
  // from the main render so a slow network never delays opening the panel.
  const openedOverlay = overlay;
  getCatalogue().then((catalogue) => {
    const slot = openedOverlay.querySelector("[data-similar-slot]");
    if (!slot || !catalogue.length) return;
    slot.innerHTML = similarProductsMarkup(product, catalogue);
    bindCardActions(slot);
  });

  return true;
}

document.addEventListener("click", (event) => {
  const trigger = event.target.closest("[data-flip]");
  if (!trigger || event.metaKey || event.ctrlKey || event.shiftKey || event.button > 0) return;

  const card = trigger.closest(".card");
  if (!card) return;

  event.preventDefault();
  card.classList.add("flipping");

  const delay = reduceMotion ? 0 : 260;
  window.setTimeout(() => {
    openDetails(card, trigger.dataset.flip).then((opened) => {
      if (!opened) window.location.href = trigger.getAttribute("href");
    }).catch(() => {
      window.location.href = trigger.getAttribute("href");
    });
  }, delay);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeOverlay();
});
