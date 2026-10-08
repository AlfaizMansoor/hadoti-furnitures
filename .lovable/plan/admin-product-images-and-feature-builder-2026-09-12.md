# Admin product images and feature builder

## Goal
Let administrators upload product images directly from their device and build product feature lists or tables without typing JSON or editing code.

## Changes
- Add a device image picker to the existing product editor, with upload progress, image previews, removal controls, and support for multiple images.
- Store uploaded product images in a dedicated public product-image area, restricted so only administrators can upload, replace, or delete files.
- Keep the existing image-path field available for already saved images and compatibility with the storefront.
- Add an **Add feature** control that creates editable label/value rows. Administrators can add, remove, and reorder rows; these rows continue using the existing product specifications data so all current product detail views remain compatible.
- Validate file type and size, show clear errors, and preserve unsaved form values while uploads complete.
- Update the roadmap and verify create/edit behavior, image display, feature display, mobile layout, and access restrictions.

## Technical details
- Use the existing authenticated admin session for storage uploads.
- Save uploaded public URLs into the current `products.images` array.
- Save feature rows into the current `products.specifications` array as `{ label, value }` objects; no product-table schema change is required.
- Add storage access policies that reuse the existing server-validated admin role check.
