// Single source of truth for business, contact, map and policy details.
// Update the values here (or later from the admin panel) and every page follows.
export const BUSINESS = {
  storeName: "Hadoti Furnitures",
  ownerName: "Chhotu Khan",
  branch: "Manufacturing Branch",
  address: {
    line1: "G-1/101, Sitapura Chhatral Circle",
    line2: "Sanganer, Jaipur, Rajasthan",
  },
  mobile: "9660073632",
  email: "support@hadotifurnitures.com",
  hours: ["Showroom open 10:00 - 20:00", "Monday to Saturday"],
};

// Social links shown as icons on the Contact section, the About Us page and
// the footer. WhatsApp is derived automatically from BUSINESS.mobile above.
// Replace the "#" placeholders with real profile URLs when ready — leaving
// a value as "#" simply hides that icon.
export const SOCIAL = {
  instagram: "#",
  facebook: "#",
  youtube: "#",
  pinterest: "#",
};

export function whatsappUrl() {
  return "https://wa.me/91" + BUSINESS.mobile;
}

// The pinned location shown on every map on the website.
export const MAP_LOCATION = {
  label: "Hadoti Furnitures, Sitapura Chhatral Circle, Sanganer, Jaipur",
  latitude: 26.7746,
  longitude: 75.848,
  zoom: 15,
};

export const DELIVERY_POLICY = {
  standardCharge: 500,
  reducedCharge: 400,
  summary: "Delivery Charges: \u20B9500 / \u20B9400 per piece, as applicable.",
  detail:
    "A delivery charge of \u20B9500 per piece applies to most locations. A reduced charge of \u20B9400 per piece applies where our delivery routes allow.",
};

export const WARRANTY_POLICY = {
  summary: "Warranty: 1-Year Warranty with Replacement.",
  detail:
    "Every piece carries a 1-year warranty covering manufacturing defects, with replacement provided where applicable.",
};

// Payment settings. Replace the sample values with the real account details
// once the bank and UPI accounts are ready; every checkout screen follows.
//
// Cash on delivery is no longer offered. Customers either pay online through
// Razorpay (verified automatically) or pay by UPI / bank transfer and quote a
// reference the admin confirms.
export const PAYMENT = {
  sample: false,
  upi: {
    id: "7850985334@axl",
    name: "Hadoti Furnitures",
  },
  bank: {
    accountName: "CHHOTU KHAN",
    accountNumber: "6345002100002850",
    ifsc: "PUNB0634500",
    bankName: "Punjab National Bank, Pratap Nagar, NRI Circle, Jaipur 302033",
  },
  methods: [
    {
      value: "razorpay",
      label: "Pay online now (UPI, card, net banking, wallet)",
      note: "Instantly verified. Your order is confirmed the moment payment succeeds.",
      online: true,
    },
    {
      value: "upi",
      label: "UPI (scan or pay to our UPI ID)",
      note: "We confirm your order once we match your UPI reference, usually within a few hours.",
      online: false,
    },
    {
      value: "bank_transfer",
      label: "Bank transfer (NEFT / IMPS)",
      note: "We confirm your order once the transfer lands in our account.",
      online: false,
    },
  ],
};

// Methods whose payment is verified by our server against the gateway.
export function isOnlineMethod(value) {
  const method = PAYMENT.methods.find((item) => item.value === value);
  return Boolean(method && method.online);
}

export function upiPayUrl(amount, note) {
  const params = new URLSearchParams({
    pa: PAYMENT.upi.id,
    pn: PAYMENT.upi.name,
    am: Number(amount || 0).toFixed(2),
    cu: "INR",
    tn: note || "Furniture order",
  });
  return "upi://pay?" + params.toString();
}

export function upiQrUrl(amount, note) {
  return (
    "https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=" +
    encodeURIComponent(upiPayUrl(amount, note))
  );
}

export function addressLines() {
  return [BUSINESS.address.line1, BUSINESS.address.line2];
}

export function telHref() {
  return "tel:+91" + BUSINESS.mobile;
}

/* Map helpers ------------------------------------------------------------ */
function mapQuery() {
  return MAP_LOCATION.latitude + "," + MAP_LOCATION.longitude + " (" + MAP_LOCATION.label + ")";
}

export function mapEmbedUrl() {
  return (
    "https://www.google.com/maps?q=" +
    encodeURIComponent(mapQuery()) +
    "&z=" +
    MAP_LOCATION.zoom +
    "&hl=en&output=embed"
  );
}

export function mapLinkUrl() {
  return (
    "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent(MAP_LOCATION.latitude + "," + MAP_LOCATION.longitude)
  );
}

export function directionsUrl() {
  return (
    "https://www.google.com/maps/dir/?api=1&destination=" +
    encodeURIComponent(MAP_LOCATION.latitude + "," + MAP_LOCATION.longitude)
  );
}
