// Submits the Contact Us form directly to the contact_messages table.
// Anyone can insert (see the RLS policy on that table); only an admin can
// read the messages back, from the Supabase dashboard's Table Editor or a
// future admin-panel view.
import { API_URL, API_KEY } from "./config.js";

const form = document.getElementById("contact-form");
const message = document.getElementById("contact-message");

function show(text, kind) {
  message.textContent = text;
  message.className = "form-message " + (kind || "");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const payload = {
    name: String(data.get("name")).trim(),
    email: String(data.get("email")).trim(),
    phone: String(data.get("phone") || "").trim() || null,
    message: String(data.get("message")).trim(),
  };

  show("Sending...");

  try {
    const response = await fetch(API_URL + "/rest/v1/contact_messages", {
      method: "POST",
      headers: {
        apikey: API_KEY,
        Authorization: "Bearer " + API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message || "Could not send your message. Please try again.");
    }

    form.reset();
    show("Thank you — your message has been sent. We'll get back to you soon.", "success");
  } catch (error) {
    show(error.message || "Something went wrong. Please try again in a moment.", "error");
  }
});
