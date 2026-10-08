// Header search box with live suggestions. Works on every page.
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export function matchesQuery(product, query) {
  const text = [
    product.name,
    product.sku,
    product.category,
    product.description,
    (product.specifications || []).map((spec) => spec.label + " " + spec.value).join(" "),
  ]
    .join(" ")
    .toLowerCase();

  return text.indexOf(query.toLowerCase()) !== -1;
}

export function alphabet() {
  return LETTERS;
}

export function setupSearch(products, onSelect) {
  const input = document.getElementById("search-input");
  const panel = document.getElementById("search-suggestions");
  if (!input || !panel) return;

  function close() {
    panel.classList.remove("open");
    panel.innerHTML = "";
  }

  input.addEventListener("input", () => {
    const query = input.value.trim();

    if (query.length < 2) {
      close();
      onSelect(null, "");
      return;
    }

    const hits = products.filter((product) => matchesQuery(product, query)).slice(0, 6);

    panel.innerHTML = hits.length
      ? hits.map((product) => '<button type="button" data-slug="' + product.slug + '">' + product.name + "</button>").join("")
      : '<button type="button" disabled>No products found for "' + query + '"</button>';

    panel.classList.add("open");
    onSelect(null, query);
  });

  panel.addEventListener("click", (event) => {
    const button = event.target.closest("[data-slug]");
    if (!button) return;
    window.location.href = "/site/product.html?product=" + encodeURIComponent(button.dataset.slug);
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".header-search")) close();
  });
}
