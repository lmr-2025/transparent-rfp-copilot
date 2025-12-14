/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient, ItemCategory, ItemPriority, Retailer } = require("@prisma/client");

const prisma = new PrismaClient();

const itemSeeds = [
  {
    name: "Kids Tablet 8\"",
    category: ItemCategory.ELECTRONICS,
    ageRange: "6-12",
    priority: ItemPriority.HIGH,
    targetBuyPrice: "70",
    normalPrice: "95",
    quantityGoal: 6,
    notes: "Durable case required. Focus on parental controls.",
    listings: [
      {
        retailer: Retailer.AMAZON,
        url: "https://example.com/tablet-amazon",
        currentPrice: "89.99",
        lowestSeenPrice: "72.50",
      },
      {
        retailer: Retailer.WALMART,
        url: "https://example.com/tablet-walmart",
        currentPrice: "92.00",
        lowestSeenPrice: "75.00",
      },
    ],
    purchases: [
      {
        retailer: "Amazon",
        unitPrice: "69.99",
        quantity: 1,
        purchasedAt: new Date().toISOString(),
        storageLocation: "Closet Bin A",
      },
    ],
  },
  {
    name: "Kids Digital Camera",
    category: ItemCategory.ELECTRONICS,
    ageRange: "6-10",
    priority: ItemPriority.MEDIUM,
    targetBuyPrice: "35",
    normalPrice: "49.99",
    quantityGoal: 4,
    notes: "Need fun colors and sturdy straps.",
    listings: [
      {
        retailer: Retailer.TARGET,
        url: "https://example.com/camera-target",
        currentPrice: "39.99",
        lowestSeenPrice: "33.50",
      },
    ],
    purchases: [],
  },
  {
    name: "Bluetooth Headphones",
    category: ItemCategory.ELECTRONICS,
    ageRange: "10-16",
    priority: ItemPriority.HIGH,
    targetBuyPrice: "25",
    normalPrice: "39.99",
    quantityGoal: 8,
    notes: "Over-ear preferred to block out noise.",
    listings: [
      {
        retailer: Retailer.BESTBUY,
        url: "https://example.com/headphones-bestbuy",
        currentPrice: "29.99",
        lowestSeenPrice: "24.00",
      },
      {
        retailer: Retailer.TARGET,
        url: "https://example.com/headphones-target",
        currentPrice: "27.49",
        lowestSeenPrice: "23.00",
      },
    ],
    purchases: [
      {
        retailer: "Target",
        unitPrice: "24.50",
        quantity: 2,
        purchasedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString(),
        storageLocation: "Closet Bin B",
      },
    ],
  },
  {
    name: "Gaming Controller",
    category: ItemCategory.TOYS,
    ageRange: "10-16",
    priority: ItemPriority.MEDIUM,
    targetBuyPrice: "30",
    normalPrice: "45",
    quantityGoal: 5,
    notes: "Wireless preferred. Compatible with Switch and Xbox.",
    listings: [
      {
        retailer: Retailer.BESTBUY,
        url: "https://example.com/controller-bestbuy",
        currentPrice: "42.00",
        lowestSeenPrice: "31.00",
      },
    ],
    purchases: [],
  },
  {
    name: "Power Bank",
    category: ItemCategory.PRACTICAL,
    ageRange: "13-18",
    priority: ItemPriority.HIGH,
    targetBuyPrice: "15",
    normalPrice: "25",
    quantityGoal: 10,
    notes: "Need slim profile and USB-C.",
    listings: [
      {
        retailer: Retailer.AMAZON,
        url: "https://example.com/powerbank-amazon",
        currentPrice: "18.99",
        lowestSeenPrice: "14.25",
      },
      {
        retailer: Retailer.SAMS,
        url: "https://example.com/powerbank-sams",
        currentPrice: "19.49",
        lowestSeenPrice: "15.00",
      },
    ],
    purchases: [
      {
        retailer: "Sam's Club",
        unitPrice: "14.99",
        quantity: 3,
        purchasedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
        storageLocation: "Garage Shelf",
      },
    ],
  },
  {
    name: "Graphing Calculator",
    category: ItemCategory.PRACTICAL,
    ageRange: "15-18",
    priority: ItemPriority.MEDIUM,
    targetBuyPrice: "75",
    normalPrice: "99.99",
    quantityGoal: 3,
    notes: "TI-84 or similar acceptable.",
    listings: [
      {
        retailer: Retailer.AMAZON,
        url: "https://example.com/calculator-amazon",
        currentPrice: "94.99",
        lowestSeenPrice: "70.00",
      },
      {
        retailer: Retailer.TARGET,
        url: "https://example.com/calculator-target",
        currentPrice: "92.50",
        lowestSeenPrice: "72.00",
      },
    ],
    purchases: [],
  },
];

async function main() {
  await prisma.purchase.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.item.deleteMany();

  for (const item of itemSeeds) {
    await prisma.item.create({
      data: {
        name: item.name,
        category: item.category,
        ageRange: item.ageRange,
        priority: item.priority,
        targetBuyPrice: item.targetBuyPrice,
        normalPrice: item.normalPrice,
        quantityGoal: item.quantityGoal,
        notes: item.notes,
        listings: {
          create: item.listings.map((listing) => ({
            retailer: listing.retailer,
            url: listing.url,
            currentPrice: listing.currentPrice,
            lowestSeenPrice: listing.lowestSeenPrice,
            lastCheckedAt: new Date(),
          })),
        },
        purchases: {
          create: item.purchases.map((purchase) => ({
            retailer: purchase.retailer,
            unitPrice: purchase.unitPrice,
            quantity: purchase.quantity,
            purchasedAt: purchase.purchasedAt,
            storageLocation: purchase.storageLocation,
          })),
        },
      },
    });
  }
}

main()
  .catch((error) => {
    console.error("Seed failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
