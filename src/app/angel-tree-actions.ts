"use server";

import { revalidatePath } from "next/cache";
import { ItemCategory, ItemPriority, Retailer } from "@prisma/client";
import prisma from "@/lib/prisma";

const decimalString = (value: number | string | null | undefined): string | null => {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const numeric = typeof value === "number" ? value : parseFloat(value);
  if (Number.isNaN(numeric)) {
    return null;
  }
  return numeric.toFixed(2);
};

const requiredPrice = (value: number | string | null | undefined, label: string) => {
  const decimal = decimalString(value);
  if (!decimal) {
    throw new Error(`${label} is required`);
  }
  return decimal;
};

const normalizedQuantity = (value: number | string): number => {
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return 1;
  }
  return Math.round(parsed);
};

const revalidateForItem = (itemId?: string) => {
  revalidatePath("/");
  revalidatePath("/items");
  revalidatePath("/inventory");
  if (itemId) {
    revalidatePath(`/items/${itemId}`);
  }
};

export type ItemFormInput = {
  name: string;
  category: ItemCategory;
  ageRange?: string;
  priority: ItemPriority;
  targetBuyPrice: number | string;
  normalPrice?: number | string | null;
  quantityGoal: number | string;
  notes?: string | null;
};

export const createItemAction = async (input: ItemFormInput) => {
  const trimmedName = input.name.trim();
  if (!trimmedName) {
    throw new Error("Name is required");
  }
  const target = requiredPrice(input.targetBuyPrice, "Target price");
  const item = await prisma.item.create({
    data: {
      name: trimmedName,
      category: input.category,
      ageRange: input.ageRange || null,
      priority: input.priority,
      targetBuyPrice: target,
      normalPrice: decimalString(input.normalPrice),
      quantityGoal: normalizedQuantity(input.quantityGoal),
      notes: input.notes || null,
    },
  });
  revalidateForItem(item.id);
  return { success: true, id: item.id };
};

export const updateItemAction = async (itemId: string, input: ItemFormInput) => {
  const trimmedName = input.name.trim();
  if (!trimmedName) {
    throw new Error("Name is required");
  }
  const target = requiredPrice(input.targetBuyPrice, "Target price");
  await prisma.item.update({
    where: { id: itemId },
    data: {
      name: trimmedName,
      category: input.category,
      ageRange: input.ageRange || null,
      priority: input.priority,
      targetBuyPrice: target,
      normalPrice: decimalString(input.normalPrice),
      quantityGoal: normalizedQuantity(input.quantityGoal),
      notes: input.notes || null,
    },
  });
  revalidateForItem(itemId);
  return { success: true };
};

export const deleteItemAction = async (itemId: string) => {
  await prisma.item.delete({ where: { id: itemId } });
  revalidateForItem();
  return { success: true };
};

type ListingFormInput = {
  itemId: string;
  retailer: Retailer;
  url: string;
  currentPrice?: number | string | null;
  active?: boolean;
};

export const createListingAction = async (input: ListingFormInput) => {
  const listing = await prisma.listing.create({
    data: {
      itemId: input.itemId,
      retailer: input.retailer,
      url: input.url,
      currentPrice: decimalString(input.currentPrice),
      lowestSeenPrice: decimalString(input.currentPrice),
      active: input.active ?? true,
      lastCheckedAt: input.currentPrice ? new Date() : null,
    },
  });
  if (listing.currentPrice) {
    const item = await prisma.item.findUnique({ where: { id: input.itemId } });
    if (item && (!item.lowestSeenPrice || Number(item.lowestSeenPrice) > Number(listing.currentPrice))) {
      await prisma.item.update({
        where: { id: input.itemId },
        data: { lowestSeenPrice: listing.currentPrice },
      });
    }
  }
  revalidateForItem(input.itemId);
  return { success: true, id: listing.id };
};

export const deleteListingAction = async (listingId: string) => {
  const listing = await prisma.listing.delete({
    where: { id: listingId },
    select: { itemId: true },
  });
  revalidateForItem(listing.itemId);
  return { success: true };
};

export const toggleListingActiveAction = async (listingId: string, active: boolean) => {
  const listing = await prisma.listing.update({
    where: { id: listingId },
    data: { active },
    select: { itemId: true },
  });
  revalidateForItem(listing.itemId);
  return { success: true };
};

export const updateListingPriceAction = async (listingId: string, price: number | string) => {
  const decimalPrice = decimalString(price);
  if (!decimalPrice) {
    throw new Error("Price is required");
  }

  await prisma.$transaction(async (tx) => {
    const listing = await tx.listing.findUnique({
      where: { id: listingId },
      include: { item: true },
    });
    if (!listing) {
      throw new Error("Listing not found");
    }

    const numericPrice = Number(decimalPrice);
    const listingLowest = listing.lowestSeenPrice ? Number(listing.lowestSeenPrice) : null;
    const shouldUpdateListingLowest = listingLowest === null || numericPrice < listingLowest;
    const now = new Date();

    await tx.listing.update({
      where: { id: listingId },
      data: {
        currentPrice: decimalPrice,
        lastCheckedAt: now,
        lowestSeenPrice: shouldUpdateListingLowest ? decimalPrice : listing.lowestSeenPrice,
      },
    });

    const itemLowest = listing.item.lowestSeenPrice ? Number(listing.item.lowestSeenPrice) : null;
    if (itemLowest === null || numericPrice < itemLowest) {
      await tx.item.update({
        where: { id: listing.itemId },
        data: { lowestSeenPrice: decimalPrice },
      });
    }
  });

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { itemId: true },
  });
  revalidateForItem(listing?.itemId);
  return { success: true };
};

export type PurchaseFormInput = {
  itemId: string;
  retailer: string;
  unitPrice: number | string;
  quantity: number | string;
  purchasedAt: string;
  storageLocation?: string | null;
  notes?: string | null;
};

export const createPurchaseAction = async (input: PurchaseFormInput) => {
  if (!input.purchasedAt) {
    throw new Error("Purchase date is required");
  }
  const unitPrice = requiredPrice(input.unitPrice, "Unit price");
  const quantity = normalizedQuantity(input.quantity);
  const purchase = await prisma.purchase.create({
    data: {
      itemId: input.itemId,
      retailer: input.retailer,
      unitPrice,
      quantity,
      purchasedAt: new Date(input.purchasedAt),
      storageLocation: input.storageLocation || null,
      notes: input.notes || null,
    },
  });
  revalidateForItem(input.itemId);
  return { success: true, id: purchase.id };
};

export const deletePurchaseAction = async (purchaseId: string) => {
  const purchase = await prisma.purchase.delete({
    where: { id: purchaseId },
    select: { itemId: true },
  });
  revalidateForItem(purchase.itemId);
  return { success: true };
};
