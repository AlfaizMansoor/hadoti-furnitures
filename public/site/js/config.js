// Backend connection details. The publishable key is safe to ship to browsers:
// row level security in the database decides what it may read.
export const API_URL = "https://aekeedjnwgeazhkkofwp.supabase.co";
export const API_KEY = "sb_publishable_97XDA6Q4ox6VYa82aygW-g_i0nMGdpY";

// Edge functions handle order creation and payment verification. The Razorpay
// key secret lives there and never reaches this file.
export const FUNCTIONS_URL = API_URL + "/functions/v1";

export const STORE_NAME = "Hadoti Furnitures";
export const CURRENCY = "\u20B9";
