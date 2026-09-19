const mongoose = require("mongoose");
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const Category = require("../models/Category");
const Product = require("../models/Product");

const slugify = (name) =>
  name.toString().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");

// Budget Esports preset inventory with valid High-Res direct Unsplash images
const budgetParts = [
  {
    name: "AMD Ryzen 5 5600",
    category: "CPU",
    brand: "AMD",
    price: 129.99,
    stock: 15,
    rating: 4.7,
    numReviews: 412,
    tags: ["cpu", "amd", "am4", "zen3", "budget"],
    isTopSelling: true,
    description: "6-core / 12-thread Zen 3 CPU on AM4 with 65W TDP — the budget esports workhorse.",
    image: "https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?auto=format&fit=crop&w=600&q=80",
    specifications: {
      socket: "AM4",
      tdp: 65,
      cores: 6,
      threads: 12,
      baseClock: "3.5GHz",
      boostClock: "4.4GHz",
      memoryType: "DDR4",
    },
  },
  {
    name: "Gigabyte B550M DS3H",
    category: "Motherboard",
    brand: "Gigabyte",
    price: 89.99,
    stock: 10,
    rating: 4.5,
    numReviews: 238,
    tags: ["motherboard", "gigabyte", "am4", "matx", "ddr4"],
    description: "Micro-ATX AM4 board with DDR4, PCIe 4.0 and dual M.2 — a value budget platform.",
    image: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80",
    specifications: {
      socket: "AM4",
      ramType: "DDR4",
      ramSlots: 4,
      formFactor: "mATX",
      chipset: "B550",
    },
  },
  {
    name: "Corsair Vengeance LPX 16GB (2x8GB) DDR4",
    category: "RAM",
    brand: "Corsair",
    price: 39.99,
    stock: 25,
    rating: 4.7,
    numReviews: 905,
    tags: ["ram", "dram", "ddr4", "16gb", "budget"],
    isTopSelling: true,
    description: "Low-profile 16GB dual-channel DDR4-3200 kit — proven value for AM4 builds.",
    image: "https://images.unsplash.com/photo-1562976540-1502c2145186?auto=format&fit=crop&w=600&q=80",
    specifications: {
      type: "DDR4",
      speed: "3200MT/s",
      latency: "CL16",
      capacity: "16GB (2x8GB)",
      modules: 2,
    },
  },
  {
    name: "XFX Speedster SWFT210 Radeon RX 6600 8GB",
    category: "GPU / Graphics Card",
    brand: "XFX",
    price: 199.99,
    stock: 8,
    rating: 4.6,
    numReviews: 376,
    tags: ["gpu", "amd", "radeon", "rx-6600", "esports"],
    isTopSelling: true,
    description: "8GB RDNA 2 card built for 1080p high-refresh esports at a lean 132W draw.",
    image: "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?auto=format&fit=crop&w=600&q=80",
    specifications: {
      powerDraw: 132,
      length_mm: 241,
      pcieVersion: "PCIe 4.0",
      memory: "8GB GDDR6",
      recommendedPsu: 450,
    },
  },
  {
    name: "Kingston NV2 1TB M.2 NVMe SSD",
    category: "SSD / HDD",
    brand: "Kingston",
    price: 59.99,
    stock: 30,
    rating: 4.6,
    numReviews: 521,
    tags: ["ssd", "nvme", "storage", "1tb"],
    isTopSelling: true,
    description: "PCIe 4.0 NVMe drive with up to 3,500MB/s reads — fast, cheap bulk storage.",
    image: "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?auto=format&fit=crop&w=600&q=80",
    specifications: {
      capacity: "1TB",
      type: "NVMe",
      interface: "NVMe PCIe 4.0",
      read: "3,500MB/s",
    },
  },
  {
    name: "EVGA 600 W1 80+ WHITE 600W",
    category: "Power Supply",
    brand: "EVGA",
    price: 49.99,
    stock: 20,
    rating: 4.4,
    numReviews: 289,
    tags: ["psu", "power", "80plus-white", "600w"],
    description: "600W 80+ White PSU with plenty of headroom for an entry gaming build.",
    // Fixed broken URL -> Using dedicated PSU hardware image
    image: "https://images.unsplash.com/photo-1555680202-c86f0e12f086?auto=format&fit=crop&w=600&q=80",
    specifications: {
      wattage: 600,
      rating: "80+ White",
      modularity: "Non-modular",
    },
  },
  {
    name: "Thermaltake Versa H18 M-ATX Case",
    category: "PC Case",
    brand: "Thermaltake",
    price: 44.99,
    stock: 12,
    rating: 4.5,
    numReviews: 194,
    tags: ["case", "thermaltake", "matx", "airflow"],
    description: "Compact micro-ATX tower with mesh front airflow and 350mm GPU clearance.",
    // Fixed duplicate GPU image -> Using PC Case image
    image: "https://images.unsplash.com/photo-1587202372616-b43bfa06c2a3?auto=format&fit=crop&w=600&q=80",
    specifications: {
      formFactorSupport: ["mATX", "Mini-ITX"],
      maxGpuLength_mm: 350,
    },
  },
  {
    name: "DeepCool AG400 CPU Cooler",
    category: "Cooling",
    brand: "DeepCool",
    price: 19.99,
    stock: 15,
    rating: 4.7,
    numReviews: 612,
    tags: ["cooling", "air", "budget", "am4"],
    isTopSelling: true,
    description: "Single-tower 120mm air cooler that tames 65W CPUs quietly and affordably.",
    image: "https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?auto=format&fit=crop&w=600&q=80",
    specifications: {
      socketSupport: ["AM4", "LGA1700", "LGA1200"],
      type: "Air",
      fanSize: "120mm",
    },
  },
];

async function seed() {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://localhost:27017/computer-store";
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB...");

    const cats = await Category.find({});
    const nameToId = new Map(cats.map((c) => [c.name, c._id]));

    for (const part of budgetParts) {
      const slug = slugify(part.name);
      // Local, name-true image generated/localized under /uploads/products.
      const image = `/uploads/products/${slug}.jpg`;
      const doc = {
        ...part,
        slug,
        image,
        imageUrl: image,
        images: [image],
        inStock: part.stock > 0,
        stockQuantity: part.stock,
        categoryId: nameToId.get(part.category) ?? null,
        discount: 0,
        isActive: true,
        specifications: part.specifications,
        // Flatten specific compatibility keys to root level for UI filters
        socket: part.specifications?.socket,
        ramType: part.specifications?.ramType || part.specifications?.type,
        specs: Object.fromEntries(
          Object.entries(part.specifications ?? {}).map(([k, v]) => [
            k,
            Array.isArray(v) ? v.join(", ") : String(v),
          ])
        ),
      };

      await Product.updateOne(
        { slug },
        { $set: doc,$setOnInsert: { isFeatured: false } },
        { upsert: true, runValidators: true, setDefaultsOnInsert: true }
      );
      console.log(`  upserted: ${slug}`);
    }

    console.log("Successfully seeded budget parts with full image & specification support!");
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Seeding error:", err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

seed();