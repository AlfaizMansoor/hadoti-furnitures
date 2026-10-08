// Full-screen image lightbox.
// Any element with a `data-lightbox` attribute opens its value (or src) in an
// overlay when clicked. Close with the × button, clicking the backdrop, or Escape.

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let overlay = null;

function closeLightbox() {
  if (!overlay) return;
  overlay.classList.remove("open");
  const node = overlay;
  overlay = null;
  window.setTimeout(() => node.remove(), reduceMotion ? 0 : 220);
  document.removeEventListener("keydown", onKey);
  document.body.classList.remove("lightbox-locked");
}

function onKey(event) {
  if (event.key === "Escape") closeLightbox();
}

export function openLightbox(src, alt) {
  if (!src) return;
  closeLightbox();

  overlay = document.createElement("div");
  overlay.className = "lightbox-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Image preview");

  overlay.innerHTML =
    '<button class="lightbox-close" type="button" aria-label="Close image">&times;</button>' +
    '<img src="' + src + '" alt="' + (alt || "") + '">';

  document.body.appendChild(overlay);
  document.body.classList.add("lightbox-locked");
  document.addEventListener("keydown", onKey);

  requestAnimationFrame(() => {
    if (overlay) overlay.classList.add("open");
  });

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay || event.target.closest(".lightbox-close")) {
      event.preventDefault();
      closeLightbox();
    }
  });
}

function onDocumentClick(event) {
  const target = event.target.closest("[data-lightbox]");
  if (!target) return;

  const src = target.dataset.lightbox || target.src;
  if (!src) return;

  event.preventDefault();
  event.stopPropagation();
  openLightbox(src, target.alt || "");
}

document.addEventListener("click", onDocumentClick);
