// Login, registration and password reset for the storefront.
import { isSignedIn, sendPasswordReset, setNewPassword, signIn, signUp, startPhoneVerification, verifyPhoneCode, verifyRecoveryCode, verifySignupCode } from "./session.js";
import { updateHeaderCounts } from "./ui.js";

const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const resetOtpForm = document.getElementById("reset-otp-form");
const verifyEmailForm = document.getElementById("verify-email-form");
const verifyPhoneForm = document.getElementById("verify-phone-form");
const message = document.getElementById("auth-message");
const tabs = document.querySelectorAll("[data-tab]");
// Set only while the OTP reset form is open, so its submit knows which
// email the code belongs to.
let resetEmail = "";
// Set only right after a signup that needs confirming.
let signupEmail = "";
let signupPhone = "";

function nextDestination() {
  const target = new URLSearchParams(window.location.search).get("next");
  return target && target.indexOf("/site/") === 0 ? target : "/site/account.html";
}

function show(text, kind) {
  message.textContent = text;
  message.className = "form-message " + (kind || "");
}

function selectTab(name) {
  tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === name));
  loginForm.classList.toggle("hidden", name !== "login");
  registerForm.classList.toggle("hidden", name !== "register");
  resetOtpForm.classList.add("hidden");
  verifyEmailForm.classList.add("hidden");
  verifyPhoneForm.classList.add("hidden");
  show("");
}

tabs.forEach((tab) => tab.addEventListener("click", () => selectTab(tab.dataset.tab)));

// Lets links such as /site/auth.html?tab=register open the Sign Up tab directly.
if (new URLSearchParams(window.location.search).get("tab") === "register") selectTab("register");

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(loginForm);
  show("Signing you in...");

  try {
    await signIn(String(data.get("email")).trim(), String(data.get("password")));
    window.location.href = nextDestination();
  } catch (error) {
    show(error.message || "We could not sign you in. Please check your details.", "error");
  }
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(registerForm);
  show("Creating your account...");

  const phone = String(data.get("phone")).trim();

  try {
    const result = await signUp({
      email: String(data.get("email")).trim(),
      password: String(data.get("password")),
      fullName: String(data.get("fullName")).trim(),
      phone: phone,
    });

    if (result.signedIn) {
      await beginPhoneVerification(phone);
      return;
    }

    signupEmail = String(data.get("email")).trim();
    signupPhone = phone;
    registerForm.classList.add("hidden");
    verifyEmailForm.classList.remove("hidden");
    show("Enter the 6-digit code we emailed to " + signupEmail + ".", "success");
  } catch (error) {
    show(error.message || "We could not create your account. Please try again.", "error");
  }
});

verifyEmailForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(event.target);
  show("Verifying...");

  try {
    await verifySignupCode(signupEmail, String(data.get("code")).trim());
    await beginPhoneVerification(signupPhone);
  } catch (error) {
    show(error.message || "That code did not work. Please check it and try again.", "error");
  }
});

// Texts a code to the phone number just given. If SMS sending isn't
// working yet (Twilio/DLT not fully set up), this doesn't block account
// creation — the customer gets in and can verify their number later from
// the account page instead.
async function beginPhoneVerification(phone) {
  try {
    await startPhoneVerification(phone);
    registerForm.classList.add("hidden");
    verifyEmailForm.classList.add("hidden");
    verifyPhoneForm.classList.remove("hidden");
    show("Enter the 6-digit code texted to " + phone + ".", "success");
  } catch (error) {
    window.location.href = nextDestination();
  }
}

verifyPhoneForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(event.target);
  show("Verifying...");

  try {
    await verifyPhoneCode(signupPhone, String(data.get("code")).trim());
    show("Mobile number verified. Redirecting...", "success");
    window.location.href = nextDestination();
  } catch (error) {
    show(error.message || "That code did not work. Please check it and try again.", "error");
  }
});

document.getElementById("skip-phone-verify").addEventListener("click", () => {
  window.location.href = nextDestination();
});

document.getElementById("forgot-btn").addEventListener("click", async () => {
  const email = String(new FormData(loginForm).get("email") || "").trim();

  if (!email) {
    show("Enter your email address first, then tap the reset link.", "error");
    return;
  }

  try {
    await sendPasswordReset(email);
    resetEmail = email;
    loginForm.classList.add("hidden");
    resetOtpForm.classList.remove("hidden");
    show("Check " + email + " for a 6-digit code.", "success");
  } catch (error) {
    show(error.message || "We could not send the reset email right now.", "error");
  }
});

resetOtpForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(event.target);
  show("Verifying code...");

  try {
    await verifyRecoveryCode(resetEmail, String(data.get("code")).trim());
    await setNewPassword(String(data.get("newPassword")));
    show("Password updated. Redirecting...", "success");
    window.location.href = nextDestination();
  } catch (error) {
    show(error.message || "That code did not work. Please check it and try again.", "error");
  }
});

document.getElementById("reset-otp-cancel").addEventListener("click", () => {
  resetOtpForm.classList.add("hidden");
  loginForm.classList.remove("hidden");
  show("");
});

if (isSignedIn()) window.location.replace(nextDestination());

updateHeaderCounts();
