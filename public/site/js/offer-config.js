// =============================================================================
//  HADOTI FURNITURES  -  ACTIVE FESTIVAL OFFER  (the ONLY file you edit)
// =============================================================================
//
//  To switch offers:
//    1. Put your new graphic in   public/offers/        (e.g. diwali-2026.png)
//    2. Change the `image` line below to point at it
//    3. Deploy
//
//  The banner, popup and floating offer all read from this one object, so
//  nothing else ever needs to change. The graphic is shown exactly as you made
//  it - the website adds no text, colour or effects on top of it.
// =============================================================================

export const festivalOffer = {
  // true  = the offer is active (banner / popup / floating, see `show` below)
  // false = the offer does not appear anywhere on the site
  enabled: true,

  // >>> CHANGE THIS LINE to switch the active offer <<<
  image: "/img/diwali-2026.png",

  // Where clicking the graphic goes. Use null if it should not be clickable.
  // (Your catalog page is /site/catalog.html - there is no /products page.)
  link: "/site/catalog.html",

  // Describes the graphic for screen readers.
  alt: "Hadoti Furnitures Festival Offer",

  // WHERE the graphic is shown (true = show, false = hide):
  //   banner   - permanent banner on the Home page, just below the trust strip
  //   popup    - pop-up when a visitor first arrives (once per browser session)
  //   floating - small floating copy in the corner of the Home page
  show: {
    banner: true,
    popup: false,
    floating: false,
  },
};

// -----------------------------------------------------------------------------
//  Sign-up popup (separate from the festival offer). Shown only to visitors who
//  are not logged in.
// -----------------------------------------------------------------------------
export const signupPopup = {
  enabled: true,
  intervalMinutes: 5,
};
