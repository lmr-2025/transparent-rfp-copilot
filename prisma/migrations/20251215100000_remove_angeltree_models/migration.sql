-- DropTable (in order due to foreign keys)
DROP TABLE IF EXISTS "Purchase";
DROP TABLE IF EXISTS "Listing";
DROP TABLE IF EXISTS "Item";

-- DropEnum
DROP TYPE IF EXISTS "ItemCategory";
DROP TYPE IF EXISTS "ItemPriority";
DROP TYPE IF EXISTS "Retailer";
