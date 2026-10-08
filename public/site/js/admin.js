// Administrator panel: sign in, verify the admin role, then create, edit and
// remove catalogue entries including the full product description.
import { authFetch, isSignedIn, sendPasswordReset, setNewPassword, signIn, signOut, uploadProductImage, verifyRecoveryCode } from "./session.js";
import { formatPrice } from "./ui.js";

const status = document.getElementById("admin-status");
const gate = document.getElementById("admin-gate");
const panel = document.getElementById("admin-panel");
const list = document.getElementById("product-list");
const form = document.getElementById("product-form");
// Set only while the OTP reset form is open, so its submit knows which
// email the code belongs to.
let resetEmail = "";
const editorTitle = document.getElementById("editor-title");
const editorMessage = document.getElementById("editor-message");
const imageInput = document.getElementById("product-image-upload");
const imageGrid = document.getElementById("admin-image-grid");
const uploadMessage = document.getElementById("upload-message");
const features = document.getElementById("admin-features");

const FIELDS =
  "id,name,slug,sku,description,long_description,price,discount_price,stock,status," +
  "is_featured,is_new_arrival,is_bestseller,is_active,category,specifications,images,sort_order";

let products = [];
let selectedId = null;

function setStatus(text, tone) {
  status.textContent = text || "";
  status.className = "form-message" + (tone ? " " + tone : "");
}

function setMessage(text, tone) {
  editorMessage.textContent = text || "";
  editorMessage.className = "form-message" + (tone ? " " + tone : "");
}

function linesToImages(value) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function linesToSpecs(value) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const index = line.indexOf(":");
      if (index === -1) return { label: line, value: "" };
      return { label: line.slice(0, index).trim(), value: line.slice(index + 1).trim() };
    });
}

function specsToLines(specs) {
  return (Array.isArray(specs) ? specs : [])
    .map((spec) => spec.label + ": " + spec.value)
    .join("\n");
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function imagePaths() {
  return linesToImages(form.images.value);
}

function renderImages() {
  const paths = imagePaths();
  imageGrid.innerHTML = paths.length
    ? paths.map((src, index) =>
      '<figure class="admin-image">' +
      '<img src="' + escapeHtml(src) + '" alt="Product image ' + (index + 1) + '">' +
      '<button type="button" data-remove-image="' + index + '" aria-label="Remove image" title="Remove image">&times;</button>' +
      (index === 0 ? "<figcaption>Main image</figcaption>" : "") +
      "</figure>"
    ).join("")
    : '<p class="empty">No product images added.</p>';
}

function featureRow(spec) {
  const row = document.createElement("div");
  row.className = "admin-feature-row";
  row.innerHTML =
    '<label>Feature<input data-feature-label placeholder="Material" value="' + escapeHtml(spec && spec.label) + '"></label>' +
    '<label>Details<input data-feature-value placeholder="Solid Sheesham wood" value="' + escapeHtml(spec && spec.value) + '"></label>' +
    '<div class="feature-actions">' +
    '<button type="button" class="icon-control" data-feature-up aria-label="Move feature up" title="Move up">&#8593;</button>' +
    '<button type="button" class="icon-control" data-feature-down aria-label="Move feature down" title="Move down">&#8595;</button>' +
    '<button type="button" class="icon-control danger" data-feature-remove aria-label="Remove feature" title="Remove">&times;</button>' +
    "</div>";
  return row;
}

function renderFeatures(specs) {
  features.innerHTML = "";
  (Array.isArray(specs) ? specs : []).forEach((spec) => features.appendChild(featureRow(spec)));
  if (!features.children.length) features.innerHTML = '<p class="empty">No features added.</p>';
}

function readFeatures() {
  return Array.from(features.querySelectorAll(".admin-feature-row"))
    .map((row) => ({
      label: row.querySelector("[data-feature-label]").value.trim(),
      value: row.querySelector("[data-feature-value]").value.trim(),
    }))
    .filter((spec) => spec.label || spec.value);
}

function renderList() {
  if (!products.length) {
    list.innerHTML = '<p class="empty">No products yet.</p>';
    return;
  }

  list.innerHTML = products
    .map(
      (product) =>
        '<button type="button" class="admin-row' + (product.id === selectedId ? " active" : "") +
        '" data-select="' + product.id + '">' +
        "<span>" + product.name + "</span>" +
        '<small>' + product.sku + " &middot; " + formatPrice(product.price) +
        (product.is_active ? "" : " &middot; hidden") + "</small>" +
        "</button>"
    )
    .join("");
}

function fillForm(product) {
  form.hidden = false;
  editorTitle.textContent = product.id ? "Editing " + product.name : "New product";
  setMessage("");

  form.name.value = product.name || "";
  form.sku.value = product.sku || "";
  form.slug.value = product.slug || "";
  form.sort_order.value = product.sort_order == null ? 0 : product.sort_order;
  form.category.value = product.category || "";
  form.price.value = product.price == null ? "" : product.price;
  form.discount_price.value = product.discount_price == null ? "" : product.discount_price;
  form.stock.value = product.stock == null ? 0 : product.stock;
  form.description.value = product.description || "";
  form.long_description.value = product.long_description || "";
  form.images.value = (Array.isArray(product.images) ? product.images : []).join("\n");
  form.specifications.value = specsToLines(product.specifications);
  renderImages();
  renderFeatures(product.specifications);
  form.is_featured.checked = Boolean(product.is_featured);
  form.is_new_arrival.checked = Boolean(product.is_new_arrival);
  form.is_bestseller.checked = Boolean(product.is_bestseller);
  form.is_active.checked = product.id ? Boolean(product.is_active) : true;

  document.getElementById("delete-product").hidden = !product.id;
}

function readForm() {
  const discount = form.discount_price.value.trim();
  const stock = Number(form.stock.value);

  return {
    name: form.name.value.trim(),
    sku: form.sku.value.trim(),
    slug: form.slug.value.trim(),
    sort_order: Number(form.sort_order.value || 0),
    category: form.category.value || null,
    price: Number(form.price.value),
    discount_price: discount === "" ? null : Number(discount),
    stock: stock,
    status: stock > 0 ? "available" : "sold_out",
    description: form.description.value.trim(),
    long_description: form.long_description.value.trim() || null,
    images: linesToImages(form.images.value),
    specifications: readFeatures(),
    is_featured: form.is_featured.checked,
    is_new_arrival: form.is_new_arrival.checked,
    is_bestseller: form.is_bestseller.checked,
    is_active: form.is_active.checked,
  };
}

async function loadProducts() {
  products = await authFetch("/products?select=" + FIELDS + "&order=sort_order.asc");
  renderList();
}

async function isAdministrator() {
  const rows = await authFetch("/user_roles?select=role&role=eq.admin&limit=1");
  return Array.isArray(rows) && rows.length > 0;
}

function showGate(message, tone) {
  gate.hidden = false;
  panel.hidden = true;
  setStatus(message, tone);
}

async function openPanel() {
  gate.hidden = true;
  panel.hidden = false;
  setStatus("Signed in as an administrator.", "success");
  await loadProducts();
}

async function start() {
  if (!isSignedIn()) {
    showGate("Please sign in with an administrator account.");
    return;
  }

  try {
    if (await isAdministrator()) {
      await openPanel();
    } else {
      showGate("This account does not have administrator access.", "error");
    }
  } catch (error) {
    showGate(error.message, "error");
  }
}

document.getElementById("admin-login").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(event.target);
  setStatus("Signing in...");

  try {
    await signIn(String(data.get("email")).trim(), String(data.get("password")));
    await start();
  } catch (error) {
    setStatus(error.message, "error");
  }
});

document.getElementById("forgot-btn").addEventListener("click", async () => {
  const loginForm = document.getElementById("admin-login");
  const email = String(new FormData(loginForm).get("email") || "").trim();

  if (!email) {
    setStatus("Enter your email address first, then tap the reset link.", "error");
    return;
  }

  try {
    await sendPasswordReset(email);
    resetEmail = email;
    loginForm.hidden = true;
    document.getElementById("reset-otp-form").hidden = false;
    setStatus("Check " + email + " for a 6-digit code.", "success");
  } catch (error) {
    setStatus(error.message || "We could not send the reset email right now.", "error");
  }
});

document.getElementById("reset-otp-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(event.target);
  setStatus("Verifying code...");

  try {
    await verifyRecoveryCode(resetEmail, String(data.get("code")).trim());
    await setNewPassword(String(data.get("newPassword")));
    setStatus("Password updated. Signing you in...", "success");
    document.getElementById("reset-otp-form").hidden = true;
    await start();
  } catch (error) {
    setStatus(error.message || "That code did not work. Please check it and try again.", "error");
  }
});

document.getElementById("reset-otp-cancel").addEventListener("click", () => {
  document.getElementById("reset-otp-form").hidden = true;
  document.getElementById("admin-login").hidden = false;
  setStatus("");
});

document.getElementById("admin-signout").addEventListener("click", async () => {
  await signOut();
  window.location.href = "/site/index.html";
});

document.getElementById("new-product").addEventListener("click", () => {
  selectedId = null;
  renderList();
  fillForm({});
});

form.images.addEventListener("input", renderImages);

imageGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-image]");
  if (!button) return;
  const paths = imagePaths();
  paths.splice(Number(button.dataset.removeImage), 1);
  form.images.value = paths.join("\n");
  renderImages();
});

imageInput.addEventListener("change", async () => {
  const files = Array.from(imageInput.files || []);
  if (!files.length) return;
  uploadMessage.className = "form-message";
  uploadMessage.textContent = "Uploading " + files.length + (files.length === 1 ? " image..." : " images...");
  imageInput.disabled = true;

  try {
    const uploaded = [];
    for (const file of files) {
      if (!/^image\/(jpeg|png|webp|avif)$/.test(file.type)) throw new Error("Choose JPG, PNG, WebP or AVIF images only.");
      if (file.size > 5 * 1024 * 1024) throw new Error(file.name + " is larger than 5 MB.");
      const extension = file.name.split(".").pop().toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const productFolder = selectedId || "new";
      const path = productFolder + "/" + Date.now() + "-" + crypto.randomUUID() + "." + extension;
      uploaded.push(await uploadProductImage(file, path));
    }
    form.images.value = imagePaths().concat(uploaded).join("\n");
    renderImages();
    uploadMessage.className = "form-message success";
    uploadMessage.textContent = uploaded.length + (uploaded.length === 1 ? " image uploaded." : " images uploaded.");
  } catch (error) {
    uploadMessage.className = "form-message error";
    uploadMessage.textContent = error.message;
  } finally {
    imageInput.value = "";
    imageInput.disabled = false;
  }
});

document.getElementById("add-feature").addEventListener("click", () => {
  const empty = features.querySelector(".empty");
  if (empty) empty.remove();
  const row = featureRow({});
  features.appendChild(row);
  row.querySelector("[data-feature-label]").focus();
});

features.addEventListener("click", (event) => {
  const row = event.target.closest(".admin-feature-row");
  if (!row) return;
  if (event.target.closest("[data-feature-remove]")) row.remove();
  if (event.target.closest("[data-feature-up]") && row.previousElementSibling) row.before(row.previousElementSibling);
  if (event.target.closest("[data-feature-down]") && row.nextElementSibling) row.after(row.nextElementSibling);
  if (!features.children.length) renderFeatures([]);
});

list.addEventListener("click", (event) => {
  const button = event.target.closest("[data-select]");
  if (!button) return;

  selectedId = button.dataset.select;
  renderList();
  fillForm(products.find((item) => item.id === selectedId) || {});
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = readForm();
  setMessage("Saving...");

  try {
    if (selectedId) {
      await authFetch("/products?id=eq." + selectedId, { method: "PATCH", body: payload });
    } else {
      const created = await authFetch("/products", { method: "POST", body: payload });
      selectedId = created && created[0] ? created[0].id : null;
    }

    await loadProducts();
    setMessage("Saved. The storefront now shows these details.", "success");
  } catch (error) {
    setMessage(error.message, "error");
  }
});

document.getElementById("delete-product").addEventListener("click", async () => {
  if (!selectedId) return;
  if (!window.confirm("Delete this product permanently?")) return;

  try {
    await authFetch("/products?id=eq." + selectedId, { method: "DELETE" });
    selectedId = null;
    await loadProducts();
    form.hidden = true;
    editorTitle.textContent = "Select a product";
  } catch (error) {
    setMessage(error.message, "error");
  }
});

start();
