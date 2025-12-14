-- CreateEnum
CREATE TYPE "ItemCategory" AS ENUM ('ELECTRONICS', 'CLOTHING', 'TOYS', 'PRACTICAL');

-- CreateEnum
CREATE TYPE "ItemPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "Retailer" AS ENUM ('AMAZON', 'WALMART', 'TARGET', 'BESTBUY', 'SAMS', 'OTHER');

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "ItemCategory" NOT NULL,
    "ageRange" TEXT,
    "priority" "ItemPriority" NOT NULL DEFAULT 'MEDIUM',
    "targetBuyPrice" DECIMAL(10, 2) NOT NULL,
    "normalPrice" DECIMAL(10, 2),
    "lowestSeenPrice" DECIMAL(10, 2),
    "quantityGoal" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "retailer" "Retailer" NOT NULL,
    "url" TEXT NOT NULL,
    "currentPrice" DECIMAL(10, 2),
    "lowestSeenPrice" DECIMAL(10, 2),
    "lastCheckedAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "retailer" TEXT NOT NULL,
    "unitPrice" DECIMAL(10, 2) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "purchasedAt" TIMESTAMP(3) NOT NULL,
    "storageLocation" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Item_category_idx" ON "Item"("category");

-- CreateIndex
CREATE INDEX "Item_priority_idx" ON "Item"("priority");

-- CreateIndex
CREATE INDEX "Listing_itemId_idx" ON "Listing"("itemId");

-- CreateIndex
CREATE INDEX "Listing_retailer_idx" ON "Listing"("retailer");

-- CreateIndex
CREATE INDEX "Listing_lastCheckedAt_idx" ON "Listing"("lastCheckedAt");

-- CreateIndex
CREATE INDEX "Purchase_itemId_idx" ON "Purchase"("itemId");

-- CreateIndex
CREATE INDEX "Purchase_purchasedAt_idx" ON "Purchase"("purchasedAt");

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
