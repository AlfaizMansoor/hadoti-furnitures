// Wraps every password input on the page with a Show/Hide toggle button.
// Runs automatically on import - no markup changes needed on any page:
// this walks the DOM and adds the toggle to whatever password fields it
// finds, so every current and future password field gets one for free.
function addToggle(input) {
  if (input.dataset.toggleWired) return;
  input.dataset.toggleWired = "true";

  const wrapper = document.createElement("span");
  wrapper.className = "password-field";
  input.parentNode.insertBefore(wrapper, input);
  wrapper.appendChild(input);

  const button = document.createElement("button");
  button.type = "button";
  button.className = "password-toggle";
  button.textContent = "Show";
  button.setAttribute("aria-label", "Show password");
  wrapper.appendChild(button);

  button.addEventListener("click", () => {
    const hidden = input.type === "password";
    input.type = hidden ? "text" : "password";
    button.textContent = hidden ? "Hide" : "Show";
    button.setAttribute("aria-label", hidden ? "Hide password" : "Show password");
  });
}

function wireAll() {
  document.querySelectorAll('input[type="password"]').forEach(addToggle);
}

wireAll();

// Login/admin forms are static, but this covers any password field added to
// the page later (e.g. a form swapped in by another script).
new MutationObserver(wireAll).observe(document.body, { childList: true, subtree: true });
