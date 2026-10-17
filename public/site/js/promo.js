// Promotional system for Hadoti Furnitures.
//
//   1. Offer BANNER             - permanent, part of the Home page (default)
//   2. Festival offer popup     - once per browser session (optional)
//   3. Floating festival offer  - Home page only (optional)
//   4. Sign-up popup            - every N minutes, logged-out visitors only
//
// Which of 1-3 are used is chosen with `show` in offer-config.js.
//
// Everything offer-specific (image, link, alt, on/off, interval) lives in
// ./offer-config.js. Nothing here is festival-specific, and no offer text is
// ever generated: the graphic you supply is shown as-is.
//
// Loaded for every page through site-info.js. Pages that must never be
// interrupted (checkout, orders, login, admin...) are skipped automatically.
import { festivalOffer, signupPopup } from "./offer-config.js";
import { isSignedIn } from "./session.js";

const CSS_HREF = "/site/css/promo.css";
const OFFER_SEEN_KEY = "hf_offer_popup_seen"; // sessionStorage: image path already shown
const FLOAT_CLOSED_KEY = "hf_offer_float_closed"; // sessionStorage: image path dismissed
const SIGNUP_NEXT_KEY = "hf_signup_popup_next"; // localStorage: timestamp of next allowed popup
const CRITICAL_PAGES = ["checkout", "order", "auth", "reset-password", "admin"];

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------------------------------------------------------------- utilities --

function safeStorage(name) {
  try {
    return window[name];
  } catch (error) {
    return null;
  }
}

const session = safeStorage("sessionStorage");
const local = safeStorage("localStorage");

function read(store, key) {
  try {
    return store ? store.getItem(key) : null;
  } catch (error) {
    return null;
  }
}

function write(store, key, value) {
  try {
    if (store) store.setItem(key, value);
  } catch (error) {
    // Private mode / storage blocked: the feature just degrades gracefully.
  }
}

// Every timer goes through here so teardown() can clear them all (no leaks,
// no duplicate timers).
const timers = new Set();

function later(fn, ms) {
  const id = window.setTimeout(() => {
    timers.delete(id);
    fn();
  }, ms);
  timers.add(id);
  return id;
}

function cancel(id) {
  if (id == null) return;
  window.clearTimeout(id);
  timers.delete(id);
}

function waitUntil(test, pollMs) {
  return new Promise((resolve) => {
    (function check() {
      if (test()) resolve();
      else later(check, pollMs);
    })();
  });
}

// Plain-language reasons for "why is nothing showing?", visible in the browser
// console (F12). Silent for normal visitors.
function say(message) {
  if (window.console && console.info) console.info("[promo] " + message);
}

function drop(store, key) {
  try {
    if (store) store.removeItem(key);
  } catch (error) {
    // ignore
  }
}

function make(tag, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function currentPage() {
  const last = window.location.pathname.split("/").pop() || "index";
  return last.replace(/\.html$/i, "").toLowerCase();
}

function isCriticalPage() {
  const page = currentPage();
  return CRITICAL_PAGES.some((name) => page.indexOf(name) === 0);
}

function isHomePage() {
  return currentPage() === "index";
}

// Only site-relative paths and http(s) URLs are allowed as an offer link.
function safeHref(link) {
  if (typeof link !== "string") return null;
  const value = link.trim();
  if (/^\/(?!\/)/.test(value) || /^https?:\/\//i.test(value)) return value;
  return null;
}

function isExternal(href) {
  try {
    return new URL(href, window.location.href).origin !== window.location.origin;
  } catch (error) {
    return false;
  }
}

// ------------------------------------------------- one-source-of-truth data --

function offerActive() {
  return Boolean(
    festivalOffer && festivalOffer.enabled && typeof festivalOffer.image === "string" && festivalOffer.image.trim()
  );
}

function showOpts() {
  return Object.assign({ banner: true, popup: true, floating: true }, (festivalOffer && festivalOffer.show) || {});
}

function offerImageSrc() {
  return festivalOffer.image.trim();
}

let stylesPromise = null;

function loadStyles() {
  if (!stylesPromise) {
    stylesPromise = new Promise((resolve) => {
      const link = make("link");
      link.rel = "stylesheet";
      link.href = CSS_HREF;
      let done = false;
      const finish = (ok) => {
        if (done) return; // the 5s timeout must not fire after a successful load
        done = true;
        if (!ok) console.warn("[promo] could not load " + CSS_HREF + " - make sure promo.css is inside public/site/css/");
        resolve(ok);
      };
      link.onload = () => finish(true);
      link.onerror = () => finish(false);
      document.head.appendChild(link);
      window.setTimeout(() => finish(false), 5000);
    });
  }
  return stylesPromise;
}

// The image is requested ONCE; the popup and the floating offer both reuse the
// browser-cached copy. A missing/broken file resolves to null, in which case
// nothing is shown (never a broken-image popup).
let imagePromise = null;

function loadOfferImage() {
  if (!imagePromise) {
    imagePromise = new Promise((resolve) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => resolve({ width: image.naturalWidth || 1, height: image.naturalHeight || 1 });
      image.onerror = () => {
        console.warn(
          "[promo] Offer image not found: " + offerImageSrc() +
            "  ->  put the file inside public/offers/ and make sure the name in offer-config.js matches exactly (capital letters and .png/.jpg too)"
        );
        resolve(null);
      };
      image.src = offerImageSrc();
    });
  }
  return imagePromise;
}

// Builds the graphic, optionally wrapped in a link (never a fake button).
function buildOfferMedia(className, dims, lazy) {
  const href = safeHref(festivalOffer.link);
  const media = make(href ? "a" : "div", className);
  media.style.setProperty("--ratio", String(dims.width / dims.height));
  media.style.setProperty("--nw", String(dims.width));

  if (href) {
    media.href = href;
    if (isExternal(href)) {
      media.target = "_blank";
      media.rel = "noopener noreferrer";
    }
  }

  const image = make("img");
  image.src = offerImageSrc();
  image.alt = festivalOffer.alt || "";
  image.decoding = "async";
  image.draggable = false;
  if (lazy) image.loading = "lazy";
  media.appendChild(image);
  return { media, href };
}

// ------------------------------------------------------ popup coordination --

// Only one popup is ever on screen. Priority order:
//   1. festival offer (first visit)   2. existing site modals   3. sign-up
const popups = { active: null };

function externalModalOpen() {
  return (
    Boolean(
      document.querySelector(".flip-overlay, .lightbox-overlay, .modal-overlay:not([hidden]), .editorial-intro")
    ) ||
    document.body.classList.contains("flip-locked") ||
    document.body.classList.contains("lightbox-locked") ||
    document.body.classList.contains("editorial-intro-active")
  );
}

function pageSettled() {
  return (
    document.readyState === "complete" &&
    !document.body.classList.contains("editorial-intro-active") &&
    !document.querySelector(".editorial-intro")
  );
}

async function whenReadyForPopup() {
  await waitUntil(pageSettled, 150);
  await new Promise((resolve) => later(resolve, 600)); // let the page settle visually
  await waitUntil(() => !externalModalOpen() && !popups.active, 800);
}

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

// Shared modal shell: backdrop, centred dialog, "x" button, Escape, click
// outside, focus trap + focus restore, and a short open/close animation.
function openDialog(name, label, content, onClosed, labelledBy) {
  const backdrop = make("div", "promo-backdrop");
  const dialog = make("div", "promo-dialog promo-dialog--" + name);
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  if (labelledBy) dialog.setAttribute("aria-labelledby", labelledBy);
  else dialog.setAttribute("aria-label", label);

  const closeButton = make("button", "promo-close");
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Close");
  closeButton.textContent = "\u00d7";

  dialog.appendChild(closeButton);
  dialog.appendChild(content);
  backdrop.appendChild(dialog);

  const previouslyFocused = document.activeElement;
  let closed = false;

  function finish() {
    backdrop.remove();
    popups.active = null;
    if (previouslyFocused && typeof previouslyFocused.focus === "function") {
      previouslyFocused.focus({ preventScroll: true });
    }
    if (onClosed) onClosed();
  }

  function close() {
    if (closed) return;
    closed = true;
    document.removeEventListener("keydown", onKey, true);
    backdrop.classList.remove("is-open");
    backdrop.classList.add("is-closing");
    if (reduceMotion) finish();
    else later(finish, 230);
  }

  function onKey(event) {
    if (event.key === "Escape") {
      event.stopPropagation();
      close();
      return;
    }

    if (event.key !== "Tab") return;
    const items = Array.prototype.slice.call(dialog.querySelectorAll(FOCUSABLE));
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;

    if (!dialog.contains(active)) {
      event.preventDefault();
      first.focus();
    } else if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  closeButton.addEventListener("click", close);
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) close();
  });
  document.addEventListener("keydown", onKey, true);

  document.body.appendChild(backdrop);
  popups.active = name;
  window.requestAnimationFrame(() => window.requestAnimationFrame(() => backdrop.classList.add("is-open")));
  closeButton.focus({ preventScroll: true });

  return { close };
}

// ------------------------------------------------------ 0. offer banner ----

// Where the banner goes: an element you placed yourself (<div data-offer-banner>)
// on ANY page, otherwise automatically on the Home page just below the trust
// strip (or the hero if there is no trust strip).
function bannerSlot() {
  const placed = document.querySelector("[data-offer-banner]");
  if (placed) return { node: placed, placed: true };
  if (!isHomePage()) return null;

  const section = make("section", "offer-banner");
  const anchor = document.querySelector(".trust-strip") || document.querySelector(".hero");
  if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(section, anchor.nextSibling);
  else {
    const main = document.querySelector("main") || document.body;
    main.insertBefore(section, main.firstChild);
  }
  return { node: section, placed: false };
}

async function showBanner() {
  if (!offerActive() || !showOpts().banner) return;
  if (!document.querySelector("[data-offer-banner]") && !isHomePage()) return;
  if (document.querySelector(".offer-banner-media")) return;

  const [styled, dims] = await Promise.all([loadStyles(), loadOfferImage()]);
  if (!styled || !dims) return;
  if (document.querySelector(".offer-banner-media")) return;

  const slot = bannerSlot();
  if (!slot) return;

  slot.node.classList.add("offer-banner");
  slot.node.setAttribute("aria-label", "Festival offer");

  const { media } = buildOfferMedia("offer-banner-media", dims, true);
  const holder = make("div", "wrap offer-banner-inner");
  holder.appendChild(media);
  slot.node.appendChild(holder);

  // Gentle fade-up the first time it scrolls into view.
  if (reduceMotion || !("IntersectionObserver" in window)) {
    media.classList.add("is-in");
  } else {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          media.classList.add("is-in");
          observer.disconnect();
        }
      },
      { threshold: 0.12 }
    );
    observer.observe(media);
  }
}

// ------------------------------------------------------ 1. festival popup ---

// Resolves true if the popup was shown (and has now been closed).
async function runFestivalFlow() {
  if (!offerActive()) {
    say("festival offer is OFF (enabled: false) or has no image in public/site/js/offer-config.js");
    return false;
  }
  if (!showOpts().popup) {
    say("popup is turned off (show.popup is false in offer-config.js)");
    return false;
  }
  if (isCriticalPage()) {
    say("skipped on this page: checkout, login, orders and admin pages are never interrupted");
    return false;
  }
  if (read(session, OFFER_SEEN_KEY) === offerImageSrc()) {
    say("popup already shown in this browser session. Open the site in a new private window, or add ?promo-reset=1 to the URL, to see it again");
    return false; // already seen this session
  }

  const [styled, dims] = await Promise.all([loadStyles(), loadOfferImage()]);
  if (!styled || !dims) return false;

  await whenReadyForPopup();

  const { media, href } = buildOfferMedia("promo-offer-media", dims, false);
  write(session, OFFER_SEEN_KEY, offerImageSrc());

  return new Promise((resolve) => {
    const dialog = openDialog("offer", festivalOffer.alt || "Festival offer", media, () => resolve(true));
    if (href) media.addEventListener("click", () => dialog.close()); // tidy up if the link opens in a new tab
  });
}

// ------------------------------------------------------ 2. floating offer ---

async function showFloating() {
  if (!offerActive() || !showOpts().floating || !isHomePage() || isCriticalPage()) return;
  if (read(session, FLOAT_CLOSED_KEY) === offerImageSrc()) {
    say("floating offer was hidden with its x button earlier in this session. Add ?promo-reset=1 to the URL to bring it back");
    return;
  }
  if (document.querySelector(".promo-float")) return;

  const [styled, dims] = await Promise.all([loadStyles(), loadOfferImage()]);
  if (!styled || !dims) return;

  await waitUntil(pageSettled, 200);

  const wrapper = make("aside", "promo-float");
  wrapper.setAttribute("aria-label", "Festival offer");
  wrapper.style.setProperty("--ratio", String(dims.width / dims.height));
  if (dims.width / dims.height > 1.25) wrapper.classList.add("is-wide");

  const { media } = buildOfferMedia("promo-float-media", dims, true);

  // The close button is a SIBLING of the link, so tapping it never navigates.
  const closeButton = make("button", "promo-float-close");
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Hide festival offer");
  closeButton.textContent = "\u00d7";
  closeButton.addEventListener("click", () => {
    write(session, FLOAT_CLOSED_KEY, offerImageSrc());
    wrapper.classList.remove("is-visible");
    wrapper.classList.add("is-hiding");
    if (reduceMotion) wrapper.remove();
    else later(() => wrapper.remove(), 320);
  });

  wrapper.appendChild(media);
  wrapper.appendChild(closeButton);
  document.body.appendChild(wrapper);
  window.requestAnimationFrame(() => window.requestAnimationFrame(() => wrapper.classList.add("is-visible")));
}

// ------------------------------------------------------- 3. signup popup ----

const signupConfig = signupPopup || {};
const intervalMs = Math.max(1000, Number(signupConfig.intervalMinutes || 10) * 60 * 1000);
const retryMs = Math.min(5000, intervalMs);
let signupTimer = null;
let festivalSettled = false;

function signupEligible() {
  return signupConfig.enabled !== false && !isSignedIn() && !isCriticalPage();
}

function readNext() {
  const value = Number(read(local, SIGNUP_NEXT_KEY));
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function writeNext(timestamp) {
  write(local, SIGNUP_NEXT_KEY, String(timestamp));
}

// (Re)computes the single signup timer from the PERSISTED "next allowed" time,
// so a page navigation or reload never resets the 10-minute clock.
function scheduleSignup(afterFestival) {
  cancel(signupTimer);
  signupTimer = null;
  if (!signupEligible()) return;

  const now = Date.now();
  let next = readNext();

  if (!next) {
    next = now + intervalMs; // first visit: first popup is one interval away
    writeNext(next);
  } else if (afterFestival) {
    next = Math.max(next, now + intervalMs); // never right after the festival popup
    writeNext(next);
  }

  const grace = Math.min(30000, intervalMs); // never pops up the instant a page loads
  signupTimer = later(trySignup, Math.max(next - now, grace));
}

function trySignup() {
  signupTimer = null;

  // Signed in meanwhile (or page now critical)? Stop for good.
  if (!signupEligible()) return;

  // Another tab already showed it, or the clock was pushed back: re-plan.
  if (Date.now() < readNext()) {
    scheduleSignup(false);
    return;
  }

  // Wait our turn: festival popup first, then existing modals, never stacked.
  if (!festivalSettled || document.hidden || popups.active || externalModalOpen()) {
    signupTimer = later(trySignup, retryMs);
    return;
  }

  showSignup();
}

function authUrl(register) {
  const params = [];
  if (register) params.push("tab=register");
  const here = window.location.pathname + window.location.search;
  if (here.indexOf("/site/") === 0) params.push("next=" + encodeURIComponent(here));
  return "/site/auth.html" + (params.length ? "?" + params.join("&") : "");
}

function showSignup() {
  loadStyles().then((styled) => {
    if (!styled) return;
    if (!signupEligible() || popups.active || externalModalOpen()) {
      signupTimer = later(trySignup, retryMs);
      return;
    }

    // Start the next interval NOW (stops duplicates across tabs/reloads)...
    writeNext(Date.now() + intervalMs);

    const body = make("div", "promo-signup");

    const kicker = make("p", "promo-signup-kicker");
    kicker.textContent = "Hadoti Furnitures";

    const title = make("h2", "promo-signup-title");
    title.id = "promo-signup-title";
    title.textContent = "Create your free account";

    const text = make("p", "promo-signup-text");
    text.textContent = "Sign up to place orders, track your delivery and manage everything from your account.";

    const actions = make("div", "promo-signup-actions");

    const signUp = make("a", "btn");
    signUp.href = authUrl(true);
    signUp.textContent = "Sign Up";

    const logIn = make("a", "btn btn-ghost");
    logIn.href = authUrl(false);
    logIn.textContent = "I already have an account";

    actions.appendChild(signUp);
    actions.appendChild(logIn);
    body.appendChild(kicker);
    body.appendChild(title);
    body.appendChild(text);
    body.appendChild(actions);

    openDialog(
      "signup",
      "Create your account",
      body,
      () => {
        // ...and restart it from the moment the visitor closes it.
        writeNext(Date.now() + intervalMs);
        scheduleSignup(false);
      },
      "promo-signup-title"
    );
  });
}

// -------------------------------------------------------------- lifecycle ---

function onStorage(event) {
  // Logged in from another tab: cancel any pending signup popup.
  if (event.key && event.key.indexOf("session") !== -1 && isSignedIn()) {
    cancel(signupTimer);
    signupTimer = null;
  }
}

function onVisibility() {
  if (!document.hidden && festivalSettled && !popups.active) scheduleSignup(false);
}

function teardown() {
  clearAllTimers();
  window.removeEventListener("storage", onStorage);
  document.removeEventListener("visibilitychange", onVisibility);
}

function clearAllTimers() {
  timers.forEach((id) => window.clearTimeout(id));
  timers.clear();
  signupTimer = null;
}

function start() {
  if (/[?&]promo-reset=1(&|$)/.test(window.location.search)) {
    drop(session, OFFER_SEEN_KEY);
    drop(session, FLOAT_CLOSED_KEY);
    drop(local, SIGNUP_NEXT_KEY);
    say("reset: popup, floating offer and sign-up timer will behave like a first visit");
  }

  window.addEventListener("storage", onStorage);
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pagehide", teardown);
  window.addEventListener("pageshow", (event) => {
    // Restored from the back/forward cache: timers were cleared on pagehide.
    if (event.persisted) {
      window.addEventListener("storage", onStorage);
      document.addEventListener("visibilitychange", onVisibility);
      scheduleSignup(false);
    }
  });

  showBanner();

  runFestivalFlow()
    .catch(() => false)
    .then((shown) => {
      festivalSettled = true;
      showFloating();
      scheduleSignup(shown);
    });
}

// Guard against the module ever being evaluated twice on one page.
if (!window.__hfPromoStarted) {
  window.__hfPromoStarted = true;
  start();
}
