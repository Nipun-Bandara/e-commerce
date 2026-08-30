import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient, Role } from "../src/generated/prisma/client";

/**
 * Database seed.
 *
 * Idempotent by construction: every row is matched on a natural unique key
 * (category slug, product slug, user email) and upserted, so running
 * `pnpm db:seed` twice leaves the database in exactly the same state as
 * running it once. Product images have no natural key, so they are cleared
 * and rewritten per product.
 *
 * Prices are LKR and are written as strings. A money value must never pass
 * through a JS number — see the Decimal rule in CLAUDE.md.
 */

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env and fill it in.",
  );
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

type CategorySeed = {
  name: string;
  slug: string;
  description: string;
};

type ProductSeed = {
  name: string;
  slug: string;
  sku: string;
  categorySlug: string;
  description: string;
  /** LKR, as a string so it never becomes a float. */
  price: string;
  stock: number;
  /** How many placeholder images to attach (1-3). */
  imageCount: number;
};

const categories: CategorySeed[] = [
  {
    name: "Electronics",
    slug: "electronics",
    description: "Audio, charging, peripherals and everyday consumer tech.",
  },
  {
    name: "Home & Kitchen",
    slug: "home-kitchen",
    description: "Cookware, small appliances and things that make a house work.",
  },
  {
    name: "Fashion",
    slug: "fashion",
    description: "Everyday clothing, footwear and accessories.",
  },
  {
    name: "Beauty & Personal Care",
    slug: "beauty-personal-care",
    description: "Skincare, haircare and grooming, including local botanicals.",
  },
  {
    name: "Books & Stationery",
    slug: "books-stationery",
    description: "Notebooks, art supplies, desk kit and reference titles.",
  },
];

const products: ProductSeed[] = [
  // ---- Electronics --------------------------------------------------------
  {
    name: "Wireless Earbuds Pro",
    slug: "wireless-earbuds-pro",
    sku: "ELE-0001",
    categorySlug: "electronics",
    description:
      "In-ear Bluetooth 5.3 earbuds with active noise cancellation and a 28 hour charging case.",
    price: "12500.00",
    stock: 45,
    imageCount: 3,
  },
  {
    name: "Bluetooth Speaker 20W",
    slug: "bluetooth-speaker-20w",
    sku: "ELE-0002",
    categorySlug: "electronics",
    description:
      "Portable IPX7 speaker with 20W output, passive radiators and 12 hours of playback.",
    price: "8900.00",
    stock: 30,
    imageCount: 2,
  },
  {
    name: "USB-C Fast Charger 65W",
    slug: "usb-c-fast-charger-65w",
    sku: "ELE-0003",
    categorySlug: "electronics",
    description:
      "GaN wall charger with two USB-C ports and one USB-A, enough for a laptop and a phone together.",
    price: "4750.00",
    stock: 120,
    imageCount: 1,
  },
  {
    name: "1080p Streaming Webcam",
    slug: "1080p-streaming-webcam",
    sku: "ELE-0004",
    categorySlug: "electronics",
    description:
      "Full HD webcam with autofocus, dual noise-cancelling microphones and a privacy shutter.",
    price: "9250.00",
    stock: 0,
    imageCount: 2,
  },
  {
    name: "Mechanical Keyboard TKL",
    slug: "mechanical-keyboard-tkl",
    sku: "ELE-0005",
    categorySlug: "electronics",
    description:
      "Tenkeyless hot-swappable board with PBT keycaps, tactile switches and per-key backlighting.",
    price: "18900.00",
    stock: 18,
    imageCount: 3,
  },
  {
    name: "Power Bank 20000mAh",
    slug: "power-bank-20000mah",
    sku: "ELE-0006",
    categorySlug: "electronics",
    description:
      "High capacity power bank with 22.5W fast charging, USB-C in/out and a four-level charge display.",
    price: "7450.00",
    stock: 64,
    imageCount: 2,
  },

  // ---- Home & Kitchen -----------------------------------------------------
  {
    name: "Stainless Steel Rice Cooker 1.8L",
    slug: "stainless-steel-rice-cooker-1-8l",
    sku: "HOM-0001",
    categorySlug: "home-kitchen",
    description:
      "1.8 litre cooker with a stainless inner pot, keep-warm mode and a steaming tray.",
    price: "15750.00",
    stock: 22,
    imageCount: 3,
  },
  {
    name: "Non-stick Frying Pan 28cm",
    slug: "non-stick-frying-pan-28cm",
    sku: "HOM-0002",
    categorySlug: "home-kitchen",
    description:
      "Forged aluminium pan with a triple-layer non-stick coating and a stay-cool handle.",
    price: "4250.00",
    stock: 55,
    imageCount: 2,
  },
  {
    name: "Ceramic Dinner Set (16 Piece)",
    slug: "ceramic-dinner-set-16-piece",
    sku: "HOM-0003",
    categorySlug: "home-kitchen",
    description:
      "Service for four: dinner plates, side plates, bowls and mugs in a matte glaze. Dishwasher safe.",
    price: "11900.00",
    stock: 12,
    imageCount: 3,
  },
  {
    name: "Electric Kettle 1.7L",
    slug: "electric-kettle-1-7l",
    sku: "HOM-0004",
    categorySlug: "home-kitchen",
    description:
      "Fast-boil 2200W kettle with a concealed element, water gauge and automatic shut-off.",
    price: "6350.00",
    stock: 40,
    imageCount: 1,
  },
  {
    name: "Vacuum Insulated Flask 1L",
    slug: "vacuum-insulated-flask-1l",
    sku: "HOM-0005",
    categorySlug: "home-kitchen",
    description:
      "Double-walled steel flask that holds heat for 12 hours and cold for 24.",
    price: "3850.00",
    stock: 78,
    imageCount: 2,
  },
  {
    name: "Bamboo Chopping Board Set",
    slug: "bamboo-chopping-board-set",
    sku: "HOM-0006",
    categorySlug: "home-kitchen",
    description:
      "Three moso bamboo boards in graduated sizes, with juice grooves and hanging holes.",
    price: "2950.00",
    stock: 0,
    imageCount: 2,
  },

  // ---- Fashion ------------------------------------------------------------
  {
    name: "Men's Cotton Oxford Shirt",
    slug: "mens-cotton-oxford-shirt",
    sku: "FAS-0001",
    categorySlug: "fashion",
    description:
      "Long-sleeve oxford in breathable 100% cotton, cut for a regular fit. Machine washable.",
    price: "5450.00",
    stock: 35,
    imageCount: 3,
  },
  {
    name: "Women's Linen Kurta",
    slug: "womens-linen-kurta",
    sku: "FAS-0002",
    categorySlug: "fashion",
    description:
      "Mid-length kurta in washed linen with side slits and wooden buttons.",
    price: "6750.00",
    stock: 28,
    imageCount: 3,
  },
  {
    name: "Unisex Canvas Sneakers",
    slug: "unisex-canvas-sneakers",
    sku: "FAS-0003",
    categorySlug: "fashion",
    description:
      "Low-top canvas sneakers on a vulcanised rubber sole with a cushioned insole.",
    price: "8950.00",
    stock: 41,
    imageCount: 2,
  },
  {
    name: "Full Grain Leather Belt",
    slug: "full-grain-leather-belt",
    sku: "FAS-0004",
    categorySlug: "fashion",
    description:
      "35mm full grain leather belt with a brushed nickel buckle. Ages well.",
    price: "4150.00",
    stock: 60,
    imageCount: 1,
  },
  {
    name: "Hand-dyed Batik Sarong",
    slug: "hand-dyed-batik-sarong",
    sku: "FAS-0005",
    categorySlug: "fashion",
    description:
      "Traditional batik sarong, hand-dyed in cotton. Each piece varies slightly.",
    price: "3250.00",
    stock: 25,
    imageCount: 2,
  },
  {
    name: "Classic Denim Jacket",
    slug: "classic-denim-jacket",
    sku: "FAS-0006",
    categorySlug: "fashion",
    description:
      "Mid-wash 12oz denim trucker jacket with chest flap pockets and adjustable waist tabs.",
    price: "12500.00",
    stock: 9,
    imageCount: 3,
  },

  // ---- Beauty & Personal Care ---------------------------------------------
  {
    name: "Virgin Coconut Oil Hair Serum",
    slug: "virgin-coconut-oil-hair-serum",
    sku: "BEA-0001",
    categorySlug: "beauty-personal-care",
    description:
      "Lightweight leave-in serum of cold-pressed virgin coconut oil for frizz and split ends. 100ml.",
    price: "1850.00",
    stock: 150,
    imageCount: 2,
  },
  {
    name: "Sandalwood Face Cleanser",
    slug: "sandalwood-face-cleanser",
    sku: "BEA-0002",
    categorySlug: "beauty-personal-care",
    description:
      "Gentle sulphate-free gel cleanser with sandalwood and turmeric. Suits daily use. 150ml.",
    price: "2450.00",
    stock: 88,
    imageCount: 2,
  },
  {
    name: "Aloe Vera Soothing Gel 200ml",
    slug: "aloe-vera-soothing-gel-200ml",
    sku: "BEA-0003",
    categorySlug: "beauty-personal-care",
    description:
      "99% pure aloe vera gel for after-sun, shaving and general irritation.",
    price: "1650.00",
    stock: 110,
    imageCount: 1,
  },
  {
    name: "Ceylon Cinnamon Body Scrub",
    slug: "ceylon-cinnamon-body-scrub",
    sku: "BEA-0004",
    categorySlug: "beauty-personal-care",
    description:
      "Exfoliating sugar scrub with Ceylon cinnamon and coconut oil. 250g.",
    price: "3150.00",
    stock: 0,
    imageCount: 3,
  },
  {
    name: "Beard Grooming Kit",
    slug: "beard-grooming-kit",
    sku: "BEA-0005",
    categorySlug: "beauty-personal-care",
    description:
      "Beard oil, balm, a boar bristle brush and a pear wood comb in a gift box.",
    price: "5950.00",
    stock: 33,
    imageCount: 3,
  },
  {
    name: "SPF 50 Sunscreen Lotion",
    slug: "spf-50-sunscreen-lotion",
    sku: "BEA-0006",
    categorySlug: "beauty-personal-care",
    description:
      "Broad spectrum SPF 50 PA+++ lotion, non-greasy and water resistant for 80 minutes. 120ml.",
    price: "3850.00",
    stock: 72,
    imageCount: 2,
  },

  // ---- Books & Stationery -------------------------------------------------
  {
    name: "A5 Hardbound Notebook (200 Pages)",
    slug: "a5-hardbound-notebook-200-pages",
    sku: "BOO-0001",
    categorySlug: "books-stationery",
    description:
      "Dot-grid A5 notebook on 100gsm paper, with a ribbon marker and elastic closure.",
    price: "1250.00",
    stock: 200,
    imageCount: 2,
  },
  {
    name: "Gel Pen Set (10 Colours)",
    slug: "gel-pen-set-10-colours",
    sku: "BOO-0002",
    categorySlug: "books-stationery",
    description:
      "Quick-drying 0.5mm gel pens in ten colours, comfortable for long writing sessions.",
    price: "890.00",
    stock: 175,
    imageCount: 1,
  },
  {
    name: "Watercolour Paint Set (24 Pans)",
    slug: "watercolour-paint-set-24-pans",
    sku: "BOO-0003",
    categorySlug: "books-stationery",
    description:
      "24 half-pan watercolours in a metal tin with a mixing lid and a travel brush.",
    price: "4550.00",
    stock: 26,
    imageCount: 3,
  },
  {
    name: "Bamboo Desk Organiser",
    slug: "bamboo-desk-organiser",
    sku: "BOO-0004",
    categorySlug: "books-stationery",
    description:
      "Bamboo caddy with compartments for pens, sticky notes, a phone and business cards.",
    price: "3450.00",
    stock: 38,
    imageCount: 2,
  },
  {
    name: "Sinhala–English Dictionary",
    slug: "sinhala-english-dictionary",
    sku: "BOO-0005",
    categorySlug: "books-stationery",
    description:
      "Bidirectional reference with over 40,000 entries, transliteration and usage notes.",
    price: "2750.00",
    stock: 47,
    imageCount: 1,
  },
  {
    name: "A4 Sketchbook (Acid Free)",
    slug: "a4-sketchbook-acid-free",
    sku: "BOO-0006",
    categorySlug: "books-stationery",
    description:
      "80 sheets of 160gsm acid-free cartridge paper, stitched flat-opening binding.",
    price: "1950.00",
    stock: 0,
    imageCount: 2,
  },
];

/**
 * Placeholder credential. Authentication is not implemented yet, so no seeded
 * account can be logged into — replace this with a real hash when auth lands.
 */
const PLACEHOLDER_PASSWORD_HASH = "seed-placeholder-not-a-real-hash";

const users = [
  {
    email: "admin@ecom.lk",
    name: "Store Admin",
    role: Role.ADMIN,
  },
  {
    email: "amara@example.com",
    name: "Amara Perera",
    role: Role.USER,
  },
  {
    email: "dinuka@example.com",
    name: "Dinuka Fernando",
    role: Role.USER,
  },
];

/** Deterministic placeholder image URL, so re-seeding yields the same pictures. */
function imageUrl(slug: string, position: number): string {
  return `https://picsum.photos/seed/${slug}-${position + 1}/800/800`;
}

async function seedCategories(): Promise<Map<string, string>> {
  const idsBySlug = new Map<string, string>();

  for (const category of categories) {
    const record = await prisma.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name, description: category.description },
      create: category,
    });

    idsBySlug.set(category.slug, record.id);
  }

  console.log(`  categories: ${idsBySlug.size}`);
  return idsBySlug;
}

async function seedProducts(categoryIds: Map<string, string>): Promise<void> {
  let imageCount = 0;

  for (const product of products) {
    const categoryId = categoryIds.get(product.categorySlug);

    if (!categoryId) {
      throw new Error(
        `Product "${product.slug}" references unknown category "${product.categorySlug}".`,
      );
    }

    const fields = {
      name: product.name,
      description: product.description,
      price: product.price,
      stock: product.stock,
      sku: product.sku,
      categoryId,
    };

    const record = await prisma.product.upsert({
      where: { slug: product.slug },
      update: fields,
      create: { ...fields, slug: product.slug },
    });

    // ProductImage has no natural unique key, so replace the set rather than
    // upserting it. That keeps a re-run from stacking up duplicate images.
    await prisma.productImage.deleteMany({ where: { productId: record.id } });
    await prisma.productImage.createMany({
      data: Array.from({ length: product.imageCount }, (_, position) => ({
        productId: record.id,
        url: imageUrl(product.slug, position),
        alt: `${product.name} — view ${position + 1}`,
        position,
      })),
    });

    imageCount += product.imageCount;
  }

  console.log(`  products:   ${products.length} (${imageCount} images)`);
}

async function seedUsers(): Promise<void> {
  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: { name: user.name, role: user.role },
      create: { ...user, passwordHash: PLACEHOLDER_PASSWORD_HASH },
    });
  }

  console.log(`  users:      ${users.length}`);
}

async function main(): Promise<void> {
  console.log("Seeding database…");

  const categoryIds = await seedCategories();
  await seedProducts(categoryIds);
  await seedUsers();

  console.log("Seed complete.");
}

main()
  .catch((error: unknown) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
