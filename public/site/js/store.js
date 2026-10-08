// Browser side cart, wishlist and recently viewed storage.
// These move to the database once customer accounts are in place.
const CART_KEY = "hf_cart";
const WISHLIST_KEY = "hf_wishlist";
const VIEWED_KEY = "hf_recently_viewed";

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
  document.dispatchEvent(new CustomEvent("store:changed"));
}

/* Cart ------------------------------------------------------------------ */
export function getCart() {
  return read(CART_KEY, []);
}

export function addToCart(productId, quantity) {
  const cart = getCart();
  const line = cart.find((item) => item.productId === productId);

  if (line) {
    line.quantity += quantity;
  } else {
    cart.push({ productId: productId, quantity: quantity });
  }

  write(CART_KEY, cart);
}

export function cartCount() {
  return getCart().reduce((total, item) => total + item.quantity, 0);
}

/* Wishlist -------------------------------------------------------------- */
export function getWishlist() {
  return read(WISHLIST_KEY, []);
}

export function isWishlisted(productId) {
  return getWishlist().indexOf(productId) !== -1;
}

export function toggleWishlist(productId) {
  const list = getWishlist();
  const index = list.indexOf(productId);

  if (index === -1) {
    list.push(productId);
  } else {
    list.splice(index, 1);
  }

  write(WISHLIST_KEY, list);
  return index === -1;
}

export function wishlistCount() {
  return getWishlist().length;
}

/* Recently viewed ------------------------------------------------------- */
export function rememberViewed(productId) {
  const list = read(VIEWED_KEY, []).filter((id) => id !== productId);
  list.unshift(productId);
  write(VIEWED_KEY, list.slice(0, 8));
}

export function getViewed() {
  return read(VIEWED_KEY, []);
}

/* Cart line editing ----------------------------------------------------- */
export function setCartQuantity(productId, quantity) {
  const cart = getCart();
  const line = cart.find((item) => item.productId === productId);
  if (!line) return;

  if (quantity < 1) {
    write(CART_KEY, cart.filter((item) => item.productId !== productId));
    return;
  }

  line.quantity = quantity;
  write(CART_KEY, cart);
}

export function removeFromCart(productId) {
  write(CART_KEY, getCart().filter((item) => item.productId !== productId));
}

export function clearCart() {
  write(CART_KEY, []);
}

export function removeFromWishlist(productId) {
  write(WISHLIST_KEY, getWishlist().filter((id) => id !== productId));
}
