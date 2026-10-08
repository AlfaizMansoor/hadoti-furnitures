# Reference-matched animation layer

## Goal
Add the uploaded video’s editorial, cinematic motion style without changing the website’s resting appearance, content, product data, layout, colors, or behavior.

## Changes
- Refine scroll entrances into clean masked rises and directional reveals for headings, copy, images, and existing content groups.
- Add gentle image zoom and reveal motion inspired by the reference, while keeping every image in its current position and size after animation.
- Stagger existing product cards and repeated rows so they enter in a polished sequence rather than all at once.
- Preserve current card flip, fullscreen image viewer, page transitions, button feedback, mobile navigation, shopping, account, checkout, order, and admin behavior.
- Disable all added movement for visitors who prefer reduced motion.

## Technical details
- Extend the existing shared motion script and stylesheet only; do not alter product records or page copy.
- Use IntersectionObserver and CSS classes so animations run efficiently and support dynamically loaded products.
- Animate only opacity, transform, and clipping properties to avoid layout shifts and visual changes after each animation completes.
- Verify the homepage at desktop and mobile sizes, plus product details and key controls, for unchanged functionality and no overlap or overflow.
