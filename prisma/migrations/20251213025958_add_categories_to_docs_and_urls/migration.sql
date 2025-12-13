/*
  Warnings:

  - You are about to drop the column `category` on the `ReferenceUrl` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "ReferenceUrl_category_idx";

-- AlterTable
ALTER TABLE "KnowledgeDocument" ADD COLUMN     "categories" TEXT[];

-- AlterTable
ALTER TABLE "ReferenceUrl" DROP COLUMN "category",
ADD COLUMN     "categories" TEXT[];
