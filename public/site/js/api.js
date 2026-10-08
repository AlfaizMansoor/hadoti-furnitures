// Thin wrapper around the REST endpoints of the database.
// Every function returns plain JavaScript objects, nothing framework specific.
import { API_URL, API_KEY } from "./config.js";

const REST = API_URL + "/rest/v1";

async function get(path) {
  const response = await fetch(REST + path, {
    headers: {
      apikey: API_KEY,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Request failed: " + response.status);
  }

  return response.json();
}

const PRODUCT_FIELDS =
  "id,name,slug,sku,description,long_description,price,discount_price,stock,status," +
  "is_featured,is_new_arrival,is_bestseller,category,specifications,images,sort_order,created_at";

export function fetchProducts() {
  return get("/products?select=" + PRODUCT_FIELDS + "&is_active=eq.true&order=sort_order.asc");
}

export async function fetchProductBySlug(slug) {
  const rows = await get(
    "/products?select=" + PRODUCT_FIELDS + "&is_active=eq.true&slug=eq." + encodeURIComponent(slug) + "&limit=1"
  );
  return rows[0] || null;
}

export async function fetchProductsByIds(ids) {
  if (!ids.length) return [];

  const list = ids.map((id) => '"' + id + '"').join(",");
  return get("/products?select=" + PRODUCT_FIELDS + "&id=in.(" + list + ")");
}
