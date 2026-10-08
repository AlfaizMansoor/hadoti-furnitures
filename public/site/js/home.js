// Home page: loads the catalogue once, then filters and sorts it in the browser.
import { fetchProducts } from "./api.js";
import { bindCardActions, isSoldOut, renderGrid, sellingPrice, updateHeaderCounts } from "./ui.js";
import { alphabet, matchesQuery, setupSearch } from "./search.js";
import "./flip-details.js";

let catalogue = [];
let activeLetter = "";
let searchQuery = "";
let sortMode = "featured";
let activeCategory = new URLSearchParams(window.location.search).get("category") || "";

const grids = {
  featured: document.querySelector('[data-grid="featured"]'),
  new: document.querySelector('[data-grid="new"]'),
  best: document.querySelector('[data-grid="best"]'),
  all: document.querySelector('[data-grid="all"]'),
};

function sortProducts(products) {
  const sorted = products.slice();

  switch (sortMode) {
    case "az":
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case "za":
      return sorted.sort((a, b) => b.name.localeCompare(a.name));
    case "price-asc":
      return sorted.sort((a, b) => sellingPrice(a) - sellingPrice(b));
    case "price-desc":
      return sorted.sort((a, b) => sellingPrice(b) - sellingPrice(a));
    case "newest":
      return sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    case "popular":
      return sorted.sort((a, b) => Number(b.is_bestseller) - Number(a.is_bestseller));
    default:
      return sorted.sort((a, b) => Number(b.is_featured) - Number(a.is_featured) || a.sort_order - b.sort_order);
  }
}

function visibleProducts() {
  let products = catalogue;

  if (activeCategory) {
    products = products.filter((product) => product.category === activeCategory);
  }

  if (activeLetter) {
    products = products.filter((product) => product.name.charAt(0).toUpperCase() === activeLetter);
  }

  if (searchQuery.length >= 2) {
    products = products.filter((product) => matchesQuery(product, searchQuery));
  }

  return sortProducts(products);
}

function emptyMessage() {
  if (searchQuery.length >= 2) return 'No products found for "' + searchQuery + '".';
  if (activeLetter) return "No products found for " + activeLetter + ".";
  if (activeCategory) return "No products in " + activeCategory + " yet.";
  return "No products available right now.";
}

function renderAll() {
  const shown = visibleProducts();
  renderGrid(grids.all, shown, emptyMessage());

  const summary = document.getElementById("result-summary");
  if (summary) {
    summary.textContent = shown.length + (shown.length === 1 ? " piece" : " pieces");
  }
}

function renderShelves() {
  const inStockFirst = (a, b) => Number(isSoldOut(a)) - Number(isSoldOut(b));

  renderGrid(grids.featured, catalogue.filter((product) => product.is_featured).sort(inStockFirst).slice(0, 4), "Nothing featured yet.");
  renderGrid(grids.new, catalogue.filter((product) => product.is_new_arrival).slice(0, 4), "No new arrivals yet.");
  renderGrid(grids.best, catalogue.filter((product) => product.is_bestseller).slice(0, 4), "No best sellers yet.");
}

const CATEGORIES = ["Living", "Bedroom", "Dining", "Office", "Chairs", "Tables", "Storage"];

function buildCategoryFilter() {
  const container = document.getElementById("category-filter");
  if (!container) return;

  container.innerHTML =
    '<button type="button" data-category="" class="' + (activeCategory ? "" : "is-active") + '">All</button>' +
    CATEGORIES.map(
      (name) => '<button type="button" data-category="' + name + '" class="' + (activeCategory === name ? "is-active" : "") + '">' + name + "</button>"
    ).join("");

  container.addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (!button) return;

    activeCategory = button.dataset.category;
    container.querySelectorAll("button").forEach((item) => item.classList.remove("is-active"));
    button.classList.add("is-active");

    const url = new URL(window.location.href);
    if (activeCategory) url.searchParams.set("category", activeCategory);
    else url.searchParams.delete("category");
    window.history.replaceState({}, "", url);

    renderAll();
  });
}

function buildAlphabet() {
  const container = document.getElementById("alphabet");
  if (!container) return;

  container.innerHTML =
    '<button type="button" data-letter="" class="active">All</button>' +
    alphabet().map((letter) => '<button type="button" data-letter="' + letter + '">' + letter + "</button>").join("");

  container.addEventListener("click", (event) => {
    const button = event.target.closest("[data-letter]");
    if (!button) return;

    activeLetter = button.dataset.letter;
    container.querySelectorAll("button").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    renderAll();
  });
}

async function start() {
  buildCategoryFilter();
  buildAlphabet();
  updateHeaderCounts();
  bindCardActions(document.body);

  const sortSelect = document.getElementById("sort-select");
  sortSelect.addEventListener("change", () => {
    sortMode = sortSelect.value;
    renderAll();
  });

  try {
    catalogue = await fetchProducts();
  } catch (error) {
    console.error(error);
    renderGrid(grids.all, [], "We could not load the catalogue. Please refresh the page.");
    return;
  }

  renderShelves();
  renderAll();

  setupSearch(catalogue, (_product, query) => {
    searchQuery = query;
    document.getElementById("all-products").scrollIntoView({ behavior: "smooth", block: "start" });
    renderAll();
  });
}

start();
