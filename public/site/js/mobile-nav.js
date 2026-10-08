/* Bottom navigation bar for phones.
   Upgrades the plain markup in each page into labelled icon buttons so the
   home, wishlist, cart and account destinations stay readable on small screens. */

import { getSession } from "./session.js";
import { cartCount, wishlistCount } from "./store.js";

const ICONS = {
  home:
    '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">' +
    '<path d="M3.5 10.5 12 3.8l8.5 6.7V20a1 1 0 0 1-1 1h-5v-6h-5v6h-5a1 1 0 0 1-1-1z"' +
    ' fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  wishlist:
    '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">' +
    '<path d="M12 20s-7.5-4.6-7.5-9.4A4.1 4.1 0 0 1 12 8a4.1 4.1 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"' +
    ' fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  cart:
    '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">' +
    '<path d="M3 4h2.2l2.1 10.3a1.6 1.6 0 0 0 1.6 1.3h7.6a1.6 1.6 0 0 0 1.6-1.2L20 7.5H6.2"' +
    ' fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<circle cx="10" cy="19.2" r="1.3" fill="currentColor"/><circle cx="17" cy="19.2" r="1.3" fill="currentColor"/></svg>',
  account:
    '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">' +
    '<circle cx="12" cy="8" r="3.6" fill="none" stroke="currentColor" stroke-width="1.6"/>' +
    '<path d="M4.8 20c1.4-3.3 4.2-4.9 7.2-4.9s5.8 1.6 7.2 4.9"' +
    ' fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  catalog:
    '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">' +
    '<rect x="3.5" y="3.5" width="7" height="7" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.6"/>' +
    '<rect x="13.5" y="3.5" width="7" height="7" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.6"/>' +
    '<rect x="3.5" y="13.5" width="7" height="7" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.6"/>' +
    '<rect x="13.5" y="13.5" width="7" height="7" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
};

function kindOf(link) {
  if (link.hasAttribute("data-account-link")) return "account";
  const href = link.getAttribute("href") || "";
  if (href.indexOf("wishlist") > -1) return "wishlist";
  if (href.indexOf("cart") > -1) return "cart";
  if (href.indexOf("catalog") > -1) return "catalog";
  return "home";
}

function labelOf(kind, signedIn) {
  if (kind === "account") return signedIn ? "Account" : "Login";
  if (kind === "catalog") return "Catalog";
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

function render() {
  const nav = document.querySelector(".mobile-nav");
  if (!nav) return;

  const path = window.location.pathname;
  const signedIn = Boolean(getSession());

  nav.querySelectorAll("a").forEach((link) => {
    const kind = kindOf(link);
    const label = labelOf(kind, signedIn);
    const href =
      kind === "account" ? (signedIn ? "/site/account.html" : "/site/auth.html") : link.getAttribute("href");
    const countAttr =
      kind === "cart" ? ' data-cart-count' : kind === "wishlist" ? ' data-wishlist-count' : "";
    const count = kind === "cart" ? cartCount() : kind === "wishlist" ? wishlistCount() : 0;

    link.setAttribute("href", href);
    link.setAttribute("aria-label", label);
    link.setAttribute("title", label);
    link.classList.toggle("is-current", href === path);
    link.innerHTML =
      '<span class="mobile-nav-icon">' +
      ICONS[kind] +
      (countAttr ? "<span class=\"mobile-nav-count\"" + countAttr + ">" + count + "</span>" : "") +
      "</span>" +
      '<span class="mobile-nav-label">' + label + "</span>";
  });
}

/* The top bar used text glyphs, which several phone fonts draw as an empty
   box. Swap them for the same vector icons used in the bottom bar. */
function renderHeaderIcons() {
  document.querySelectorAll(".header-actions a").forEach((link) => {
    if (link.hasAttribute("data-account-link")) return;

    const kind = kindOf(link);
    const badge = link.querySelector(".count");

    link.innerHTML = '<span class="header-icon">' + ICONS[kind] + "</span>";
    if (badge) link.appendChild(badge);
  });
}

document.addEventListener("session:changed", render);
render();
renderHeaderIcons();
