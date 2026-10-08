// Shared rendering helpers used by the home and product pages.
import { CURRENCY } from "./config.js";
import { addToCart, cartCount, isWishlisted, toggleWishlist, wishlistCount } from "./store.js";
import "./lightbox.js";

// Escapes text before it is inserted via innerHTML. Anything that ultimately
// comes from a URL or a text input (search query, category filter, etc.)
// must go through this before being shown, or it becomes a reflected-XSS hole.
export function esc(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatPrice(amount) {
  return CURRENCY + Number(amount).toLocaleString("en-IN");
}

export function sellingPrice(product) {
  return product.discount_price != null ? Number(product.discount_price) : Number(product.price);
}

export function discountPercent(product) {
  if (product.discount_price == null) return 0;
  return Math.round((1 - Number(product.discount_price) / Number(product.price)) * 100);
}

export function isSoldOut(product) {
  return product.status === "sold_out" || product.stock < 1;
}

export function primaryImage(product) {
  const images = Array.isArray(product.images) ? product.images : [];
  return images[0] || "/site/img/hero.jpg";
}

export function updateHeaderCounts() {
  const cart = cartCount();
  const wish = wishlistCount();

  // Give the badge a small "pop" whenever its number actually changes.
  const setBadge = (badge, value) => {
    const changed = badge.textContent !== "" && badge.textContent !== String(value);
    badge.textContent = value;
    if (changed) {
      badge.classList.remove("pop");
      void badge.offsetWidth;
      badge.classList.add("pop");
    }
  };

  document.querySelectorAll("[data-cart-count]").forEach((badge) => setBadge(badge, cart));
  document.querySelectorAll("[data-wishlist-count]").forEach((badge) => setBadge(badge, wish));
}

function badgeMarkup(product) {
  const badges = [];

  if (isSoldOut(product)) badges.push('<span class="badge badge-out">Sold Out</span>');
  if (discountPercent(product) > 0) badges.push('<span class="badge badge-sale">' + discountPercent(product) + "% Off</span>");
  if (product.is_new_arrival) badges.push('<span class="badge badge-new">New</span>');
  if (product.is_bestseller) badges.push('<span class="badge badge-bestseller">Bestseller</span>');
  if (!isSoldOut(product) && product.stock > 0 && product.stock <= 3) {
    badges.push('<span class="badge">Limited Stock</span>');
  }

  return '<div class="badges">' + badges.join("") + "</div>";
}

export function productCard(product) {
  const soldOut = isSoldOut(product);
  const link = "/site/product.html?product=" + encodeURIComponent(product.slug);
  const oldPrice = product.discount_price != null ? "<s>" + formatPrice(product.price) + "</s>" : "";
  const saveAmount = product.discount_price != null ? Number(product.price) - Number(product.discount_price) : 0;
  const saveLine = saveAmount > 0 ? '<span class="price-save">You save ' + formatPrice(saveAmount) + "</span>" : "";
  const name = esc(product.name);
  const image = esc(primaryImage(product));

  return (
    '<article class="card">' +
    '<div class="card-media">' +
    '<a href="' + link + '"><img src="' + image + '" alt="' + name + '" data-lightbox="' + image + '" loading="lazy" width="1024" height="1024"></a>' +
    badgeMarkup(product) +
    '<button class="wish-btn' + (isWishlisted(product.id) ? " on" : "") +
    '" data-wish="' + product.id + '" aria-label="Save to wishlist">&#9825;</button>' +
    "</div>" +
    '<div class="card-body">' +
    '<span class="card-sku">' + esc(product.sku) + "</span>" +
    '<h3><a href="' + link + '">' + name + "</a></h3>" +
    '<div class="price"><strong>' + formatPrice(sellingPrice(product)) + "</strong>" + oldPrice + saveLine + "</div>" +
    '<div class="card-actions">' +
    (soldOut
      ? '<button class="btn" disabled>Sold Out</button>'
      : '<button class="btn" data-add="' + product.id + '">Add to Cart</button>') +
    '<a class="btn btn-ghost" href="' + link + '" data-flip="' + esc(product.slug) + '">Details</a>' +
    "</div></div></article>"
  );
}

export function renderGrid(container, products, emptyMessage) {
  if (!container) return;

  if (!products.length) {
    // emptyMessage can include text that ultimately came from the URL (the
    // category filter) or a search box, so it must be escaped -- otherwise
    // a crafted link like catalog.html?category=<img src=x onerror=...>
    // would execute arbitrary script for whoever opens it.
    container.innerHTML = '<p class="empty">' + esc(emptyMessage) + "</p>";
    return;
  }

  container.innerHTML = products.map(productCard).join("");
}

// One delegated listener handles every add-to-cart and wishlist button.
export function bindCardActions(root) {
  root.addEventListener("click", (event) => {
    const wishButton = event.target.closest("[data-wish]");
    if (wishButton) {
      const added = toggleWishlist(wishButton.dataset.wish);
      wishButton.classList.toggle("on", added);
      updateHeaderCounts();
      return;
    }

    const addButton = event.target.closest("[data-add]");
    if (addButton) {
      addToCart(addButton.dataset.add, 1);
      updateHeaderCounts();
      addButton.textContent = "Added";
      setTimeout(() => {
        addButton.textContent = "Add to Cart";
      }, 1200);
    }
  });
}
