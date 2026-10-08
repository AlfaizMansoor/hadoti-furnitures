// Wishlist page: shows every saved product with the usual card actions.
import { fetchProductsByIds } from "./api.js";
import { getWishlist } from "./store.js";
import { renderGrid, bindCardActions, updateHeaderCounts } from "./ui.js";
import "./flip-details.js";

const grid = document.getElementById("wishlist-grid");
const summary = document.getElementById("wishlist-summary");

async function start() {
  updateHeaderCounts();

  const ids = getWishlist();

  if (!ids.length) {
    grid.innerHTML =
      '<p class="empty">Nothing saved yet. Tap the heart on any piece to keep it here.</p>';
    summary.textContent = "0 items saved";
    return;
  }

  let products = [];

  try {
    products = await fetchProductsByIds(ids);
  } catch (error) {
    grid.innerHTML = '<p class="empty">We could not load your wishlist right now. Please refresh.</p>';
    return;
  }

  // Keep the order in which the customer saved the items.
  products.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));

  summary.textContent = products.length + (products.length === 1 ? " item saved" : " items saved");
  renderGrid(grid, products, "Nothing saved yet.");
  bindCardActions(grid);
}

// Removing an item from the wishlist should drop it off this page too.
document.addEventListener("store:changed", () => {
  updateHeaderCounts();
});

start();
