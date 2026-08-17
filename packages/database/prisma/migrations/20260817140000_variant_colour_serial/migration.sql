-- Colour serial, stored per variant.
--
-- It was previously re-derived by parsing the SKU, which meant a renamed colour
-- or a reordered variant matrix could renumber a variant whose SKU is already
-- printed on a label. Storing it makes the number what it should be: issued
-- once, then frozen.
--
-- Idempotent, and NULL for existing rows — legacy variants keep the SKU they
-- already have, and nothing recomputes it.
ALTER TABLE "ProductVariant" ADD COLUMN IF NOT EXISTS "colorSerial" INTEGER;
