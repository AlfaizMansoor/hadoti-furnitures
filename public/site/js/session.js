// Customer session handling: registration, login, token refresh and the
// account link that every page shows in its header.
import { API_URL, API_KEY, FUNCTIONS_URL } from "./config.js";

const SESSION_KEY = "hf_session";
const AUTH = API_URL + "/auth/v1";
const REST = API_URL + "/rest/v1";

function readSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

function writeSession(session) {
  if (!session) {
    localStorage.removeItem(SESSION_KEY);
  } else {
    session.expires_at = Math.floor(Date.now() / 1000) + (session.expires_in || 3600) - 60;
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }
  document.dispatchEvent(new CustomEvent("session:changed"));
}

export function getSession() {
  return readSession();
}

// A customer can already read their own row(s) in user_roles under RLS
// ("Users can read their own roles"), so this is safe to call for anyone
// signed in — it just tells the UI whether to show admin-only links, and
// carries no authority on its own. Every real admin action is re-checked
// by RLS on the server regardless of what this returns.
export async function isAdmin() {
  const session = readSession();
  if (!session || !session.user) return false;

  try {
    const rows = await authFetch("/user_roles?select=role&role=eq.admin&user_id=eq." + session.user.id);
    return Array.isArray(rows) && rows.length > 0;
  } catch (error) {
    return false;
  }
}

export function isSignedIn() {
  return Boolean(readSession());
}

async function authRequest(path, body) {
  const response = await fetch(AUTH + path, {
    method: "POST",
    headers: { apikey: API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.msg || payload.error_description || payload.message || "Request failed");
  }

  return payload;
}

async function refreshSession() {
  const session = readSession();
  if (!session || !session.refresh_token) return null;

  try {
    const fresh = await authRequest("/token?grant_type=refresh_token", {
      refresh_token: session.refresh_token,
    });
    writeSession(fresh);
    return fresh;
  } catch (error) {
    writeSession(null);
    return null;
  }
}

async function validSession() {
  const session = readSession();
  if (!session) return null;
  if (session.expires_at && session.expires_at > Math.floor(Date.now() / 1000)) return session;
  return refreshSession();
}

export async function signUp(details) {
  const payload = await authRequest("/signup", {
    email: details.email,
    password: details.password,
    data: { full_name: details.fullName, phone: details.phone },
  });

  if (payload.access_token) {
    writeSession(payload);
    return { signedIn: true };
  }

  return { signedIn: false };
}

// The 6-digit code sent when a new signup needs email confirmation —
// same idea as verifyRecoveryCode, different Supabase verification type.
export async function verifySignupCode(email, code) {
  const payload = await authRequest("/verify", { type: "signup", email: email, token: code });
  writeSession(payload);
  return payload;
}

// Sets/confirms the phone number on the signed-in user, which triggers
// Supabase to text an OTP to it (requires the Phone provider — Twilio —
// to be enabled in the Supabase dashboard).
export async function startPhoneVerification(phone) {
  const session = await validSession();
  if (!session) throw new Error("Please sign in to continue.");

  const response = await fetch(AUTH + "/user", {
    method: "PUT",
    headers: {
      apikey: API_KEY,
      Authorization: "Bearer " + session.access_token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ phone: phone }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.msg || payload.error_description || payload.message || "Could not send the SMS code.");
  }
  return payload;
}

export async function verifyPhoneCode(phone, code) {
  const payload = await authRequest("/verify", { type: "phone_change", phone: phone, token: code });
  writeSession(payload);
  return payload;
}

export async function signIn(email, password) {
  const payload = await authRequest("/token?grant_type=password", { email: email, password: password });
  writeSession(payload);
  return payload;
}

export async function sendPasswordReset(email) {
  await authRequest("/recover", { email: email });
}

// The alternative to clicking the email link: the customer/admin types the
// 6-digit code from the email directly into the site. Requires the Reset
// Password email template in Supabase to include {{ .Token }} — see
// PAYMENTS.md for the one-time dashboard setting.
export async function verifyRecoveryCode(email, code) {
  const payload = await authRequest("/verify", { type: "recovery", email: email, token: code });
  writeSession(payload);
  return payload;
}

// Call only right after verifyRecoveryCode succeeds — that call provides the
// short-lived session this needs.
export async function setNewPassword(newPassword) {
  const session = await validSession();
  if (!session) throw new Error("That code has expired. Please request a new one.");

  const response = await fetch(AUTH + "/user", {
    method: "PUT",
    headers: {
      apikey: API_KEY,
      Authorization: "Bearer " + session.access_token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password: newPassword }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.msg || payload.error_description || payload.message || "Could not update password.");
  }
  return payload;
}

export async function signOut() {
  const session = readSession();

  if (session) {
    try {
      await fetch(AUTH + "/logout", {
        method: "POST",
        headers: { apikey: API_KEY, Authorization: "Bearer " + session.access_token },
      });
    } catch (error) {
      /* the local session is cleared either way */
    }
  }

  writeSession(null);
}

/* Authenticated data requests ------------------------------------------- */
export async function authFetch(path, options) {
  const session = await validSession();
  if (!session) throw new Error("Please sign in to continue.");

  const settings = options || {};
  const response = await fetch(REST + path, {
    method: settings.method || "GET",
    headers: Object.assign(
      {
        apikey: API_KEY,
        Authorization: "Bearer " + session.access_token,
        "Content-Type": "application/json",
        Prefer: settings.prefer || "return=representation",
      },
      settings.headers || {}
    ),
    body: settings.body ? JSON.stringify(settings.body) : undefined,
  });

  if (response.status === 401) {
    writeSession(null);
    throw new Error("Your session has expired. Please sign in again.");
  }

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error((data && (data.message || data.hint)) || "Request failed");
  }

  return data;
}

// Calls a Supabase edge function with the customer's access token attached.
// Used for anything the browser must not be trusted to decide on its own:
// order totals and payment verification.
export async function functionFetch(name, body) {
  const session = await validSession();
  if (!session) throw new Error("Please sign in to continue.");

  let response;
  try {
    response = await fetch(FUNCTIONS_URL + "/" + name, {
      method: "POST",
      headers: {
        apikey: API_KEY,
        Authorization: "Bearer " + session.access_token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body || {}),
    });
  } catch (error) {
    throw new Error("We could not reach the server. Please check your connection and try again.");
  }

  if (response.status === 401) {
    writeSession(null);
    throw new Error("Your session has expired. Please sign in again.");
  }

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (error) {
    throw new Error("The server sent an unexpected response. Please try again.");
  }

  if (!response.ok || !data || data.success !== true) {
    throw new Error((data && data.message) || "Request failed. Please try again.");
  }

  return data;
}

export async function uploadProductImage(file, objectPath) {
  const session = await validSession();
  if (!session) throw new Error("Please sign in to continue.");

  const safePath = objectPath.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(API_URL + "/storage/v1/object/product-images/" + safePath, {
    method: "POST",
    headers: {
      apikey: API_KEY,
      Authorization: "Bearer " + session.access_token,
      "Content-Type": file.type,
      "x-upsert": "false",
    },
    body: file,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || payload.error || "The image could not be uploaded.");
  }

  // The bucket is public for reads (see the product-images migration), so a
  // plain public URL is all that's needed — no signed token to embed in the
  // products table, and nothing that expires or leaks a security token
  // through a table anyone can already SELECT from.
  return API_URL + "/storage/v1/object/public/product-images/" + safePath;
}

export async function fetchProfile() {
  const rows = await authFetch("/profiles?select=id,customer_code,full_name,phone&limit=1");
  return rows && rows.length ? rows[0] : null;
}

export async function saveProfile(fields) {
  const session = await validSession();
  if (!session) throw new Error("Please sign in to continue.");

  return authFetch("/profiles?id=eq." + session.user.id, { method: "PATCH", body: fields });
}

/* Header link ------------------------------------------------------------ */
export function mountAccountLinks() {
  const session = readSession();
  const label = session ? "Account" : "Login";
  const href = session ? "/site/account.html" : "/site/auth.html";

  const USER_ICON =
    '<svg class="account-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">' +
    '<circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="1.6"/>' +
    '<path d="M4.5 20c1.4-3.4 4.3-5 7.5-5s6.1 1.6 7.5 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>' +
    "</svg>";

  document.querySelectorAll("[data-account-link]").forEach((link) => {
    link.setAttribute("href", href);
    link.setAttribute("aria-label", label);
    link.setAttribute("title", label);
    const icon = link.querySelector("b");
    link.textContent = "";
    if (icon) {
      icon.innerHTML = USER_ICON;
      link.appendChild(icon);
    } else {
      link.innerHTML = USER_ICON;
    }
  });
}

document.addEventListener("session:changed", mountAccountLinks);
mountAccountLinks();
