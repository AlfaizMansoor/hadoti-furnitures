// Animated "Product Spotlight" hero showcase.
// Everything shown comes from the products table: featured pieces first, then
// any other active product. Hotspot labels come from each product's own
// specifications, so nothing here is hardcoded or invented.
import { fetchProducts } from "./api.js";
import { addToCart } from "./store.js";
import { formatPrice, isSoldOut, primaryImage, sellingPrice, updateHeaderCounts } from "./ui.js";

const root = document.getElementById("spotlight");
const MAX_ITEMS = 6;
const AUTOPLAY_MS = 6500;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Hotspot positions (percent of the image). Labels are filled from specs.
const HOTSPOTS = [
  { x: 30, y: 38 },
  { x: 68, y: 64 },
];

let items = [];
let index = 0;
let timer = null;
let paused = false;
let frontLayer = 0;

function esc(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pickItems(catalogue) {
  const featured = catalogue.filter((product) => product.is_featured);
  const rest = catalogue.filter((product) => !product.is_featured);
  return featured.concat(rest).slice(0, MAX_ITEMS);
}

function pad(number) {
  return String(number).padStart(2, "0");
}

function shell() {
  root.innerHTML =
    '<div class="wrap"><div class="spotlight-panel" id="spot-panel">' +
    '<span class="spot-orb o1"></span><span class="spot-orb o2"></span><span class="spot-orb o3"></span>' +
    '<div class="spot-copy" id="spot-copy"></div>' +
    '<div class="spot-stage"><div class="spot-frame" id="spot-frame">' +
    '<img alt="" id="spot-img-0"><img alt="" id="spot-img-1"></div>' +
    '<div id="spot-hots"></div></div>' +
    '<div class="spot-bar">' +
    '<div class="spot-count" id="spot-count"></div>' +
    '<div class="spot-thumbs">' +
    '<button type="button" class="spot-arrow" id="spot-prev" aria-label="Previous piece">&#8249;</button>' +
    '<div class="spot-strip" id="spot-strip"></div>' +
    '<button type="button" class="spot-arrow" id="spot-next" aria-label="Next piece">&#8250;</button>' +
    "</div></div>" +
    '<div class="spot-progress" id="spot-progress"></div>' +
    "</div></div>";
}

function copyMarkup(product) {
  const link = "/site/product.html?product=" + encodeURIComponent(product.slug);
  const hasOffer = product.discount_price != null && Number(product.discount_price) < Number(product.price);
  const soldOut = isSoldOut(product);

  return (
    '<span class="eyebrow">Featured Piece</span>' +
    '<h2 class="spot-title">' + esc(product.name) + "</h2>" +
    '<p class="spot-desc">' + esc(product.description) + "</p>" +
    '<div class="spot-price"><strong>' + formatPrice(sellingPrice(product)) + "</strong>" +
    (hasOffer ? "<s>" + formatPrice(product.price) + "</s>" : "") + "</div>" +
    '<div class="spot-actions">' +
    '<a class="btn" href="' + link + '">View Details</a>' +
    (soldOut
      ? '<button class="btn btn-ghost" type="button" disabled>Sold Out</button>'
      : '<button class="btn btn-ghost" type="button" data-spot-add="' + esc(product.id) + '">Add to Cart</button>') +
    "</div>"
  );
}

function hotspotMarkup(product) {
  const specs = Array.isArray(product.specifications) ? product.specifications : [];
  return HOTSPOTS.slice(0, specs.length)
    .map((spot, i) => {
      const spec = specs[i];
      const text = esc(spec.label) + ": " + esc(spec.value);
      return (
        '<button type="button" class="spot-hot" style="left:' + spot.x + "%;top:" + spot.y + '%" aria-label="' + text + '">+' +
        '<span class="spot-tip"><span>' + text + "</span></span></button>"
      );
    })
    .join("");
}

function swapImage(src, alt) {
  const next = frontLayer === 0 ? 1 : 0;
  const incoming = document.getElementById("spot-img-" + next);
  const outgoing = document.getElementById("spot-img-" + frontLayer);

  incoming.src = src;
  incoming.alt = alt;
  incoming.classList.add("is-on");
  outgoing.classList.remove("is-on");
  frontLayer = next;
}

function restartProgress() {
  const bar = document.getElementById("spot-progress");
  bar.classList.remove("run");
  if (reduceMotion || paused || items.length < 2) return;

  // Force a reflow so the CSS animation restarts from zero.
  void bar.offsetWidth;
  bar.style.setProperty("--spot-ms", AUTOPLAY_MS + "ms");
  bar.classList.add("run");
}

function show(nextIndex, firstRender) {
  index = (nextIndex + items.length) % items.length;
  const product = items[index];

  const copy = document.getElementById("spot-copy");
  const paint = () => {
    copy.classList.remove("is-swapping");
    copy.innerHTML = copyMarkup(product);
    // Re-trigger the staggered entrance animation.
    copy.style.animation = "none";
    void copy.offsetWidth;
    copy.style.animation = "";
    document.getElementById("spot-hots").innerHTML = hotspotMarkup(product);
  };

  swapImage(primaryImage(product), product.name);
  document.getElementById("spot-count").innerHTML = "<b>" + pad(index + 1) + "</b> / " + pad(items.length);

  document.querySelectorAll(".spot-thumb").forEach((thumb, i) => {
    thumb.classList.toggle("is-active", i === index);
  });

  const active = document.querySelector(".spot-thumb.is-active");
  if (active && active.scrollIntoView) {
    const strip = document.getElementById("spot-strip");
    strip.scrollTo({ left: active.offsetLeft - strip.clientWidth / 2 + active.clientWidth / 2, behavior: reduceMotion ? "auto" : "smooth" });
  }

  if (firstRender || reduceMotion) {
    paint();
  } else {
    copy.classList.add("is-swapping");
    document.getElementById("spot-hots").innerHTML = "";
    window.setTimeout(paint, 240);
  }

  restartProgress();
}

function schedule() {
  window.clearTimeout(timer);
  if (reduceMotion || paused || items.length < 2) return;
  timer = window.setTimeout(() => {
    show(index + 1);
    schedule();
  }, AUTOPLAY_MS);
}

function go(nextIndex) {
  show(nextIndex);
  schedule();
}

function bind() {
  const panel = document.getElementById("spot-panel");

  document.getElementById("spot-prev").addEventListener("click", () => go(index - 1));
  document.getElementById("spot-next").addEventListener("click", () => go(index + 1));

  document.getElementById("spot-strip").addEventListener("click", (event) => {
    const thumb = event.target.closest("[data-spot-index]");
    if (thumb) go(Number(thumb.dataset.spotIndex));
  });

  panel.addEventListener("click", (event) => {
    // Tap a hotspot to open its label (hover does the same on desktop).
    const hot = event.target.closest(".spot-hot");
    if (hot) {
      panel.querySelectorAll(".spot-hot.is-open").forEach((item) => {
        if (item !== hot) item.classList.remove("is-open");
      });
      hot.classList.toggle("is-open");
      return;
    }

    const add = event.target.closest("[data-spot-add]");
    if (add) {
      addToCart(add.dataset.spotAdd, 1);
      updateHeaderCounts();
      add.textContent = "Added to Cart";
      window.setTimeout(() => {
        add.textContent = "Add to Cart";
      }, 1400);
    }
  });

  // Pause while the visitor is interacting; resume afterwards.
  const pause = () => {
    paused = true;
    window.clearTimeout(timer);
    document.getElementById("spot-progress").classList.remove("run");
  };
  const resume = () => {
    paused = false;
    restartProgress();
    schedule();
  };
  panel.addEventListener("pointerenter", (event) => {
    if (event.pointerType === "mouse") pause();
  });
  panel.addEventListener("pointerleave", (event) => {
    if (event.pointerType === "mouse") resume();
  });
  panel.addEventListener("focusin", pause);
  panel.addEventListener("focusout", resume);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pause();
    else resume();
  });

  // Swipe left/right on the image (mobile).
  const stage = panel.querySelector(".spot-stage");
  let startX = null;
  stage.addEventListener("touchstart", (event) => {
    startX = event.touches[0].clientX;
  }, { passive: true });
  stage.addEventListener("touchend", (event) => {
    if (startX == null) return;
    const delta = event.changedTouches[0].clientX - startX;
    startX = null;
    if (Math.abs(delta) > 45) go(index + (delta < 0 ? 1 : -1));
  }, { passive: true });
}

async function start() {
  if (!root) return;

  let catalogue = [];
  try {
    catalogue = await fetchProducts();
  } catch (error) {
    return;
  }

  items = pickItems(catalogue);
  if (!items.length) return;

  shell();
  document.getElementById("spot-strip").innerHTML = items
    .map(
      (product, i) =>
        '<button type="button" class="spot-thumb" data-spot-index="' + i + '" aria-label="Show ' + esc(product.name) + '">' +
        '<img src="' + esc(primaryImage(product)) + '" alt="" loading="lazy"></button>'
    )
    .join("");

  if (items.length < 2) {
    document.getElementById("spot-prev").hidden = true;
    document.getElementById("spot-next").hidden = true;
  }

  bind();
  root.hidden = false;
  show(0, true);
  schedule();
}

start();
