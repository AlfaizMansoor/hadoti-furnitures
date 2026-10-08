// Fills the shared footer, contact and map blocks from the business settings
// module, so contact, location and policy details live in exactly one place.
import {
  BUSINESS,
  DELIVERY_POLICY,
  MAP_LOCATION,
  SOCIAL,
  WARRANTY_POLICY,
  addressLines,
  directionsUrl,
  mapEmbedUrl,
  mapLinkUrl,
  telHref,
  whatsappUrl,
} from "./business.js";
import "./session.js";
import "./motion.js";

// Minimal, currentColor line icons so they inherit the theme automatically.
const SOCIAL_ICONS = {
  whatsapp:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M20.5 11.9a8.4 8.4 0 0 1-12.2 7.5L4 20.5l.9-4.1a8.4 8.4 0 1 1 15.6-4.5Z"/><path d="M8.7 8.6c.2-.5.5-.5.7-.5h.5c.2 0 .4 0 .6.4.2.4.6 1.4.7 1.5.1.1.1.3 0 .5-.1.2-.2.3-.4.5-.1.2-.3.3-.1.6.2.4.9 1.4 1.9 2.3 1.3 1.1 2 1.3 2.3 1.5.3.1.5.1.6-.1.2-.2.7-.8.9-1 .2-.2.4-.2.6-.1l1.6.8c.2.1.4.2.4.4.1.6-.1 1.4-.5 1.9-.4.5-1.3.9-2.2.8-1.9-.1-3.9-1.2-5.4-2.6-1.5-1.5-2.4-3.3-2.6-4.6-.1-.9.3-1.7.8-2.1Z" fill="currentColor" stroke="none"/></svg>',
  instagram:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none"/></svg>',
  facebook:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M14.5 21v-7.2h2.4l.4-2.8h-2.8V9.1c0-.8.2-1.4 1.4-1.4h1.5V5.2c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.1H9v2.8h2.5V21"/></svg>',
  youtube:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="6.5" width="18" height="11" rx="3.5"/><path d="M10.5 9.8v4.4l3.8-2.2Z" fill="currentColor" stroke="none"/></svg>',
  pinterest:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="8.5"/><path d="M9.5 18c.6-2.2 1.4-5.3 1.9-7.4.3-1.3 2.4-1.6 3.3-.5.6.7.6 1.7.3 2.9-.4 1.6-.7 3-2.2 3-1.1 0-1.7-.8-1.5-2 .2-1 .7-2.5.7-3.3 0-1.9-2.7-1.6-2.7 1 0 .6.1 1 .3 1.3-.4 1.7-1 4-1 4.5 0 .6 0 1.2.1 1.7" fill="none"/></svg>',
};

function socialMarkup() {
  const links = [
    { key: "whatsapp", url: whatsappUrl(), label: "Chat on WhatsApp" },
    { key: "instagram", url: SOCIAL.instagram, label: "Follow on Instagram" },
    { key: "facebook", url: SOCIAL.facebook, label: "Follow on Facebook" },
    { key: "youtube", url: SOCIAL.youtube, label: "Watch on YouTube" },
    { key: "pinterest", url: SOCIAL.pinterest, label: "Follow on Pinterest" },
  ].filter((item) => item.url && item.url !== "#");

  if (!links.length) return "";

  return (
    '<div class="social-icons">' +
    links
      .map(
        (item) =>
          '<a href="' + item.url + '" target="_blank" rel="noopener" aria-label="' + item.label + '" title="' + item.label + '">' +
          SOCIAL_ICONS[item.key] +
          "</a>"
      )
      .join("") +
    "</div>"
  );
}

function contactMarkup() {
  return (
    '<p class="contact-name">' + BUSINESS.ownerName + "</p>" +
    '<p class="contact-branch">' + BUSINESS.branch + "</p>" +
    '<p class="contact-address">' + addressLines().join("<br>") + "</p>" +
    '<p>Mobile: <a href="' + telHref() + '">' + BUSINESS.mobile + "</a></p>" +
    '<p>Email: <a href="mailto:' + BUSINESS.email + '">' + BUSINESS.email + "</a></p>" +
    '<p><a class="map-link" href="' + mapLinkUrl() + '" target="_blank" rel="noopener">View location on Google Maps</a></p>' +
    socialMarkup()
  );
}

function mapMarkup() {
  return (
    '<div class="map-card">' +
    '<div class="map-frame">' +
    '<iframe title="' + BUSINESS.storeName + ' location on Google Maps" src="' + mapEmbedUrl() +
    '" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>' +
    "</div>" +
    '<div class="map-foot">' +
    "<div>" +
    '<p class="map-title">' + BUSINESS.branch + "</p>" +
    "<p>" + MAP_LOCATION.label + "</p>" +
    "</div>" +
    '<a class="btn" href="' + directionsUrl() + '" target="_blank" rel="noopener">Get Directions</a>' +
    "</div>" +
    "</div>"
  );
}

function footerMarkup() {
  return (
    '<div class="wrap footer-grid">' +
    "<div>" +
    "<h4>" + BUSINESS.storeName + "</h4>" +
    "<p>Solid wood furniture built by hand, finished with care and delivered across India.</p>" +
    "</div>" +
    "<div>" +
    "<h4>Visit</h4>" +
    "<ul>" + BUSINESS.hours.map((line) => "<li>" + line + "</li>").join("") + "</ul>" +
    '<p><a class="map-link" href="' + directionsUrl() + '" target="_blank" rel="noopener">Get directions</a></p>' +
    '<p><a class="map-link" href="/site/catalog.html">Browse full catalog</a></p>' +
    "</div>" +
    "<div>" +
    "<h4>Policies</h4>" +
    "<ul>" +
    "<li>" + DELIVERY_POLICY.summary + "</li>" +
    "<li>" + WARRANTY_POLICY.summary + "</li>" +
    '<li><a href="/site/about.html">About Us</a></li>' +
    '<li><a href="/site/contact.html">Contact Us</a></li>' +
    '<li><a href="/site/shipping-policy.html">Shipping Policy</a></li>' +
    '<li><a href="/site/return-refund.html">Return &amp; Refund Policy</a></li>' +
    '<li><a href="/site/cancellation-policy.html">Cancellation Policy</a></li>' +
    '<li><a href="/site/privacy.html">Privacy Policy</a></li>' +
    '<li><a href="/site/terms-conditions.html">Terms &amp; Conditions</a></li>' +
    "</ul>" +
    "</div>" +
    '<div class="footer-contact">' +
    "<h4>Contact Us</h4>" +
    contactMarkup() +
    "</div>" +
    "</div>" +
    '<div class="wrap footer-map">' +
    '<div class="map-frame">' +
    '<iframe title="' + BUSINESS.storeName + ' location on Google Maps" src="' + mapEmbedUrl() +
    '" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>' +
    "</div>" +
    "</div>"
  );
}

export function mountSiteInfo() {
  const footer = document.querySelector("[data-site-footer]");
  if (footer) footer.innerHTML = footerMarkup();

  document.querySelectorAll("[data-contact-block]").forEach((node) => {
    node.innerHTML = contactMarkup();
  });

  document.querySelectorAll("[data-map-block]").forEach((node) => {
    node.innerHTML = mapMarkup();
  });

  document.querySelectorAll("[data-delivery-policy]").forEach((node) => {
    node.textContent = DELIVERY_POLICY.summary;
  });

  document.querySelectorAll("[data-warranty-policy]").forEach((node) => {
    node.textContent = WARRANTY_POLICY.summary;
  });
}

mountSiteInfo();
