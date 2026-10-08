// Presentation only: reveals sections as they enter the viewport, adds a
// condensed header on scroll and staggers product cards as they render.
const REVEAL_SELECTOR = [
  ".section-head",
  ".page-head",
  ".toolbar",
  ".category-nav",
  ".product",
  ".product-detail-section .detail-copy",
  ".cart-line",
  ".order-card",
  ".auth-card",
  ".contact-card",
  ".map-card",
  ".summary",
  ".order-block",
  ".admin-fieldset",
].join(", ");

const MEDIA_SELECTOR = ".gallery-main, .map-frame, .footer-map";

function createEditorialIntro() {
  const hero = document.querySelector(".hero");
  if (!hero || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const intro = document.createElement("div");
  intro.className = "editorial-intro";
  intro.setAttribute("aria-hidden", "true");
  intro.innerHTML =
    '<div class="intro-frame intro-frame-one"><img src="/site/img/coffee-table.jpg" alt=""></div>' +
    '<div class="intro-frame intro-frame-two"><img src="/site/img/chair.jpg" alt=""></div>' +
    '<div class="intro-frame intro-frame-three"><img src="/site/img/hero.jpg" alt=""></div>' +
    '<div class="intro-curtain"></div>';

  document.body.appendChild(intro);
  document.body.classList.add("editorial-intro-active");

  const finish = () => {
    intro.remove();
    document.body.classList.remove("editorial-intro-active");
  };

  intro.addEventListener("animationend", (event) => {
    if (event.target === intro) finish();
  });
  window.setTimeout(finish, 3600);
}

function markRevealed(node) {
  node.classList.add("is-visible");
}

function createObserver() {
  if (!("IntersectionObserver" in window)) return null;

  return new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        markRevealed(entry.target);
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
  );
}

const observer = createObserver();

function watch(node) {
  if (!node || node.dataset.revealBound === "1") return;
  node.dataset.revealBound = "1";
  node.classList.add("reveal");

  if (!observer) {
    markRevealed(node);
    return;
  }

  observer.observe(node);
}

function watchMedia(node) {
  if (!node || node.dataset.mediaRevealBound === "1") return;
  node.dataset.mediaRevealBound = "1";
  node.classList.add("media-reveal");

  if (!observer) {
    markRevealed(node);
    return;
  }

  observer.observe(node);
}

export function watchReveals(root) {
  const scope = root || document;
  scope.querySelectorAll(REVEAL_SELECTOR).forEach(watch);
  scope.querySelectorAll(MEDIA_SELECTOR).forEach(watchMedia);
}

function staggerCards(root) {
  (root || document).querySelectorAll(".grid").forEach((grid) => {
    Array.from(grid.children).forEach((card, index) => {
      if (card.dataset.cardMotionBound === "1") return;
      card.dataset.cardMotionBound = "1";
      card.style.setProperty("--card-delay", Math.min(index, 8) * 60 + "ms");
      card.classList.add("card-enter");
    });
  });
}

function bindHeaderState() {
  const header = document.querySelector(".site-header");
  if (!header) return;

  const apply = () => header.classList.toggle("is-scrolled", window.scrollY > 24);
  apply();
  window.addEventListener("scroll", apply, { passive: true });
}

function watchDynamicContent() {
  const target = document.querySelector("main") || document.body;

  const mutationObserver = new MutationObserver(() => {
    watchReveals(target);
    staggerCards(target);
  });

  mutationObserver.observe(target, { childList: true, subtree: true });
}

/* Hero parallax: background drifts at ~35% of scroll speed. */
function bindHeroParallax() {
  const hero = document.querySelector(".hero");
  if (!hero) return;

  let ticking = false;

  const update = () => {
    ticking = false;
    const travelled = window.scrollY - hero.offsetTop;
    if (travelled < -window.innerHeight || travelled > hero.offsetHeight) return;
    const shift = Math.max(0, Math.min(60, travelled * 0.18));
    hero.style.setProperty("--hero-shift", shift.toFixed(1) + "px");
  };

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(update);
  };

  update();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
}

/* Ripple feedback on primary buttons. */
function bindRipples() {
  document.addEventListener("pointerdown", (event) => {
    const button = event.target.closest(".btn");
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const ripple = document.createElement("span");

    ripple.className = "ripple";
    ripple.style.width = ripple.style.height = size + "px";
    ripple.style.left = event.clientX - rect.left - size / 2 + "px";
    ripple.style.top = event.clientY - rect.top - size / 2 + "px";

    button.appendChild(ripple);
    ripple.addEventListener("animationend", () => ripple.remove());
  });
}

/* Fade the page out before following an internal link, and in on arrival. */
function bindPageTransitions() {
  document.body.classList.add("page-fade");

  window.addEventListener("pageshow", () => {
    document.body.classList.remove("is-leaving");
  });

  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const link = event.target.closest("a[href]");
    if (!link || link.target === "_blank" || link.hasAttribute("download")) return;

    const url = new URL(link.getAttribute("href"), window.location.href);
    if (url.origin !== window.location.origin) return;
    if (url.pathname === window.location.pathname && url.hash) return;

    event.preventDefault();
    document.body.classList.add("is-leaving");
    window.setTimeout(() => {
      window.location.href = url.href;
    }, 200);
  });
}

export function startMotion() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    document.querySelectorAll(REVEAL_SELECTOR).forEach(markRevealed);
    return;
  }

  createEditorialIntro();
  watchReveals(document);
  staggerCards(document);
  bindHeaderState();
  bindHeroParallax();
  bindRipples();
  bindPageTransitions();
  watchDynamicContent();
}

startMotion();
