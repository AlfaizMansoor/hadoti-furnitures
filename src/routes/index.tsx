import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
// import { supabase } from '../utils/supabase'

// The storefront is a plain HTML/CSS/JS site served from /public/site.
// This entry route simply forwards visitors to it.
const STOREFRONT_URL = "/site/index.html";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Hadoti Furnitures | Premium Solid Wood Furniture" },
      {
        name: "description",
        content:
          "Handcrafted solid wood sofas, beds, dining tables and storage from Hadoti Furnitures, delivered across India.",
      },
      { property: "og:title", content: "Hadoti Furnitures | Premium Solid Wood Furniture" },
      {
        property: "og:description",
        content: "Handcrafted solid wood furniture for elegant, warm and modern homes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StorefrontRedirect,
});

function StorefrontRedirect() {
  useEffect(() => {
    window.location.replace(STOREFRONT_URL);
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground">
        Opening the store... <a className="underline" href={STOREFRONT_URL}>continue</a>
      </p>
    </div>
  );
}
