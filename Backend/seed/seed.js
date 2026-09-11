const mongoose = require("mongoose");
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const Category = require("../models/Category");
const Product = require("../models/Product");
const { ensureProductImages } = require("./imageGenerator");
const { parts } = require("./parts");

const img = (name) =>
  `/uploads/products/${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")}.jpg`;

const categories = [
  { name: "PC & Laptop", slug: "pc-laptop", description: "Pre-built gaming PCs, office PCs, laptops and workstations.", icon: "laptop", image: "/uploads/categories/pc-laptop.jpg", sortOrder: 1, isActive: true, parentCategory: "" },
  { name: "Computer Parts", slug: "computer-parts", description: "CPU, GPU, RAM, storage, motherboards, PSUs, cases and cooling.", icon: "cpu", image: "/uploads/categories/computer-parts.jpg", sortOrder: 2, isActive: true, parentCategory: "" },
  { name: "Gaming", slug: "gaming", description: "Peripherals, displays and gear for gaming and streaming.", icon: "gamepad", image: "/uploads/categories/gaming.jpg", sortOrder: 3, isActive: true, parentCategory: "" },

  { name: "Gaming PC", slug: "gaming-pc", description: "High-performance pre-built gaming desktops.", icon: "cpu", image: "/uploads/categories/gaming-pc.jpg", sortOrder: 1, isActive: true, parentCategory: "PC & Laptop" },
  { name: "Office PC", slug: "office-pc", description: "Reliable desktops for work and productivity.", icon: "monitor", image: "/uploads/categories/office-pc.jpg", sortOrder: 2, isActive: true, parentCategory: "PC & Laptop" },
  { name: "Gaming Laptop", slug: "gaming-laptop", description: "Portable power for gaming on the go.", icon: "laptop", image: "/uploads/categories/gaming-laptop.jpg", sortOrder: 3, isActive: true, parentCategory: "PC & Laptop" },
  { name: "Workstation", slug: "workstation", description: "Creator workstations for rendering and heavy workloads.", icon: "monitor", image: "/uploads/categories/workstation.jpg", sortOrder: 4, isActive: true, parentCategory: "PC & Laptop" },

  { name: "CPU", slug: "cpu", description: "Processors for every tier of build.", icon: "cpu", image: "/uploads/categories/cpu.jpg", sortOrder: 1, isActive: true, parentCategory: "Computer Parts" },
  { name: "GPU / Graphics Card", slug: "gpu-graphics-card", description: "Graphics cards for gaming and creation.", icon: "storage", image: "/uploads/categories/gpu-graphics-card.jpg", sortOrder: 2, isActive: true, parentCategory: "Computer Parts" },
  { name: "RAM", slug: "ram", description: "Memory kits for esports and heavy multitasking.", icon: "storage", image: "/uploads/categories/ram.jpg", sortOrder: 3, isActive: true, parentCategory: "Computer Parts" },
  { name: "SSD / HDD", slug: "ssd-hdd", description: "Fast SSDs and reliable storage drives.", icon: "storage", image: "/uploads/categories/ssd-hdd.jpg", sortOrder: 4, isActive: true, parentCategory: "Computer Parts" },
  { name: "Motherboard", slug: "motherboard", description: "Boards to tie every build together.", icon: "cpu", image: "/uploads/categories/motherboard.jpg", sortOrder: 5, isActive: true, parentCategory: "Computer Parts" },
  { name: "Power Supply", slug: "power-supply", description: "Efficient, stable power delivery.", icon: "storage", image: "/uploads/categories/power-supply.jpg", sortOrder: 6, isActive: true, parentCategory: "Computer Parts" },
  { name: "PC Case", slug: "pc-case", description: "Cases with airflow and style.", icon: "monitor", image: "/uploads/categories/pc-case.jpg", sortOrder: 7, isActive: true, parentCategory: "Computer Parts" },
  { name: "Cooling", slug: "cooling", description: "Keep it cool with fans and liquid cooling.", icon: "storage", image: "/uploads/categories/cooling.jpg", sortOrder: 8, isActive: true, parentCategory: "Computer Parts" },

  { name: "Gaming Monitor", slug: "gaming-monitor", description: "High-refresh gaming and 4K productivity displays.", icon: "monitor", image: "/uploads/products/1788783572778-314543999.png", sortOrder: 1, isActive: true, parentCategory: "Gaming" },
  { name: "Gaming Keyboard", slug: "gaming-keyboard", description: "Mechanical, wireless, and compact keyboards.", icon: "keyboard", image: "/uploads/categories/gaming-keyboard.jpg", sortOrder: 2, isActive: true, parentCategory: "Gaming" },
  { name: "Gaming Mouse", slug: "gaming-mouse", description: "Esports-grade precision and ergonomic comfort.", icon: "mouse", image: "/uploads/products/1788845579589-738208964.png", sortOrder: 3, isActive: true, parentCategory: "Gaming" },
  { name: "Headset", slug: "headset", description: "Immersive sound for gaming, calls, and music.", icon: "headphones", image: "/uploads/products/1788774097951-695089226.png", sortOrder: 4, isActive: true, parentCategory: "Gaming" },
  { name: "Gaming Chair", slug: "gaming-chair", description: "Chairs built for long sessions.", icon: "mouse", image: "/uploads/categories/gaming-chair.jpg", sortOrder: 5, isActive: true, parentCategory: "Gaming" },
  { name: "Controller", slug: "controller", description: "Gamepads for every platform.", icon: "gamepad", image: "/uploads/categories/controller.jpg", sortOrder: 6, isActive: true, parentCategory: "Gaming" },
  { name: "Mouse Pad", slug: "mouse-pad", description: "Speed and control surfaces.", icon: "mouse", image: "/uploads/categories/mouse-pad.jpg", sortOrder: 7, isActive: true, parentCategory: "Gaming" },
  { name: "Webcams & Streaming", slug: "webcams-streaming", description: "Clear video for meetings, streams, and creators.", icon: "webcam", image: "/uploads/categories/webcams-streaming.jpg", sortOrder: 8, isActive: true, parentCategory: "Gaming" },
];

const products = [
  // ——— Keyboards ———
  {
    name: "Logitech MX Mechanical Wireless Keyboard",
    category: "Gaming Keyboard",
    brand: "Logitech",
    price: 169.99,
    discount: 15,
    stock: 24,
    rating: 4.8,
    numReviews: 512,
    tags: ["keyboard", "logitech", "wireless", "mechanical"],
    isFeatured: true,
    isTopSelling: true,
    description:
      "Tactile low-profile mechanical keys with smart backlighting and Multi-Device pairing.",
    image: img("Logitech MX Mechanical Wireless Keyboard"),
    specs: {
      type: "Low-profile mechanical",
      switch: "Tactile",
      connectivity: "Bluetooth / USB",
      backlight: "Smart RGB",
    },
  },
  {
    name: "Razer BlackWidow V4 75%",
    category: "Gaming Keyboard",
    brand: "Razer",
    price: 189.99,
    discount: 20,
    stock: 18,
    rating: 4.7,
    numReviews: 346,
    tags: ["keyboard", "razer", "gaming", "hot-swap"],
    isFeatured: true,
    isTopSelling: true,
    description:
      "Hot-swappable gaming keyboard with Razer Orange switches and programmable dial.",
    image: img("Razer BlackWidow V4 75%"),
    specs: {
      type: "75% hot-swap",
      switch: "Razer Orange",
      layout: "ANSI",
      backlight: "Per-key RGB",
    },
  },
  {
    name: "Keychron K8 Pro QMK",
    category: "Gaming Keyboard",
    brand: "Keychron",
    price: 109.99,
    discount: 0,
    stock: 40,
    rating: 4.6,
    numReviews: 289,
    tags: ["keyboard", "keychron", "mk", "qmk"],
    isFeatured: false,
    isTopSelling: false,
    description:
      "Gasket-mounted 87-key mechanical keyboard with QMK/VIA full customization.",
    image: img("Keychron K8 Pro QMK"),
    specs: {
      type: "TKL gasket mount",
      switch: "Gateron Red",
      connectivity: "Bluetooth / USB-C",
      backlight: "South-facing RGB",
    },
  },
  {
    name: "Logitech G413 SE Mechanical Gaming Keyboard",
    category: "Gaming Keyboard",
    brand: "Logitech",
    price: 79.99,
    discount: 10,
    stock: 55,
    rating: 4.5,
    numReviews: 764,
    tags: ["keyboard", "logitech", "gaming", "mechanical"],
    isFeatured: false,
    isTopSelling: true,
    description:
      "Tactile mechanical switches, aluminum top case, and F-keys macro support.",
    image: img("Logitech G413 SE Mechanical Gaming Keyboard"),
    specs: {
      type: "Full-size",
      switch: "Tactile",
      layout: "US",
      backlight: "White LED",
    },
  },
  // ——— Mice & Pointers ———
  {
    name: "Razer DeathAdder V3 Pro",
    category: "Gaming Mouse",
    brand: "Razer",
    price: 159.99,
    discount: 25,
    stock: 30,
    rating: 4.8,
    numReviews: 928,
    tags: ["mouse", "razer", "esports", "wireless"],
    isFeatured: true,
    isTopSelling: true,
    description:
      "63g esports wireless mouse with Focus Pro 30K sensor and 90-hour battery.",
    image: img("Razer DeathAdder V3 Pro"),
    specs: {
      sensor: "Focus Pro 30K",
      weight: "63g",
      connectivity: "Razer HyperSpeed",
      battery: "90 hours",
    },
  },
  {
    name: "Logitech MX Master 3S",
    category: "Gaming Mouse",
    brand: "Logitech",
    price: 99.99,
    discount: 10,
    stock: 62,
    rating: 4.7,
    numReviews: 1204,
    tags: ["mouse", "logitech", "productivity", "wireless"],
    isFeatured: true,
    isTopSelling: true,
    description:
      "Quiet 8K DPI performance mouse with MagSpeed scroll wheel and flow cross-computer control.",
    image: img("Logitech MX Master 3S"),
    specs: {
      sensor: "8K DPI",
      buttons: "7",
      connectivity: "Bluetooth / USB",
      battery: "70 days",
    },
  },
  {
    name: "Logitech G502 X Plus Wireless",
    category: "Gaming Mouse",
    brand: "Logitech",
    price: 159.99,
    discount: 0,
    stock: 22,
    rating: 4.6,
    numReviews: 431,
    tags: ["mouse", "logitech", "gaming", "hybrid"],
    isFeatured: false,
    isTopSelling: false,
    description:
      "LIGHTFORCE hybrid switch gaming mouse with LIGHTSPEED wireless and RGB.",
    image: img("Logitech G502 X Plus Wireless"),
    specs: {
      sensor: "HERO 25K",
      buttons: "13",
      connectivity: "LIGHTSPEED",
      backlight: "LIGHTSYNC RGB",
    },
  },
  {
    name: "SteelSeries Rival 3",
    category: "Gaming Mouse",
    brand: "SteelSeries",
    price: 49.99,
    discount: 10,
    stock: 80,
    rating: 4.5,
    numReviews: 658,
    tags: ["mouse", "steelseries", "gaming", "rgb"],
    isFeatured: false,
    isTopSelling: false,
    description:
      "Lightweight 59g gaming mouse with TrueMove Core sensor and 60M-click switches.",
    image: "/uploads/products/1788845579589-738208964.png",
    specs: {
      sensor: "TrueMove Core",
      weight: "59g",
      switches: "60M clicks",
      backlight: "Prism RGB",
    },
  },
  // ——— Monitors ———
  {
    name: 'Samsung Odyssey G9 49" QD-OLED',
    category: "Gaming Monitor",
    brand: "Samsung",
    price: 1299.99,
    discount: 20,
    stock: 9,
    rating: 4.8,
    numReviews: 214,
    tags: ["monitor", "samsung", "ultrawide", "oled"],
    isFeatured: true,
    isTopSelling: true,
    description:
      "5120x1440 QD-OLED ultrawide with 240Hz and near-zero response time.",
    image: "/uploads/products/1788783572778-314543999.png",
    specs: {
      panel: "QD-OLED",
      resolution: "5120x1440",
      refresh: "240Hz",
      curvature: "1000R",
    },
  },
  {
    name: 'LG UltraGear 27" QHD 165Hz',
    category: "Gaming Monitor",
    brand: "LG",
    price: 499.99,
    discount: 15,
    stock: 34,
    rating: 4.7,
    numReviews: 389,
    tags: ["monitor", "lg", "gaming", "qhd"],
    isFeatured: true,
    isTopSelling: true,
    description:
      "27-inch QHD Nano IPS gaming monitor with 165Hz and 1ms response time.",
    image: img('LG UltraGear 27" QHD 165Hz'),
    specs: {
      panel: "Nano IPS",
      resolution: "2560x1440",
      refresh: "165Hz",
      response: "1ms GtG",
    },
  },
  {
    name: 'Dell UltraSharp 27" 4K USB-C',
    category: "Gaming Monitor",
    brand: "Dell",
    price: 649.99,
    discount: 0,
    stock: 17,
    rating: 4.6,
    numReviews: 172,
    tags: ["monitor", "dell", "4k", "productivity"],
    isFeatured: false,
    isTopSelling: false,
    description:
      "27-inch 4K IPS monitor with 98% DCI-P3 and 90W USB-C power delivery.",
    image: img('Dell UltraSharp 27" 4K USB-C'),
    specs: {
      panel: "IPS",
      resolution: "3840x2160",
      color: "98% DCI-P3",
      ports: "USB-C 90W",
    },
  },
  {
    name: 'Acer Nitro 24" 180Hz',
    category: "Gaming Monitor",
    brand: "Acer",
    price: 199.99,
    discount: 10,
    stock: 46,
    rating: 4.5,
    numReviews: 523,
    tags: ["monitor", "acer", "gaming", "esports"],
    isFeatured: false,
    isTopSelling: false,
    description:
      "24-inch FHD zero-frame gaming monitor with 180Hz and AMD FreeSync.",
    image: img('Acer Nitro 24" 180Hz'),
    specs: {
      panel: "VA",
      resolution: "1920x1080",
      refresh: "180Hz",
      sync: "AMD FreeSync",
    },
  },
  // ——— Headsets & Audio ———
  {
    name: "HyperX Cloud III",
    category: "Headset",
    brand: "HyperX",
    price: 99.99,
    discount: 20,
    stock: 58,
    rating: 4.6,
    numReviews: 847,
    tags: ["headset", "hyperx", "gaming", "audio"],
    isFeatured: true,
    isTopSelling: true,
    description:
      "Angled 53mm drivers, signature HyperX comfort, and memory foam ear cushions.",
    image: "/uploads/products/1788774097951-695089226.png",
    specs: {
      driver: "53mm angled",
      frequency: "10Hz-21kHz",
      mic: "Detachable",
      platform: "PC / Console / Mobile",
    },
  },
  {
    name: "SteelSeries Arctis Nova Pro",
    category: "Headset",
    brand: "SteelSeries",
    price: 349.99,
    discount: 10,
    stock: 14,
    rating: 4.7,
    numReviews: 298,
    tags: ["headset", "steelseries", "premium", "wireless"],
    isFeatured: true,
    isTopSelling: false,
    description:
      "Premier gaming headset with dual battery system and ANC microphones.",
    image: img("SteelSeries Arctis Nova Pro"),
    specs: {
      driver: "40mm high-density",
      battery: "Dual-swap",
      anc: "Active noise cancelling",
      mic: "Retractable AI",
    },
  },
  {
    name: "Logitech G733 Lightspeed",
    category: "Headset",
    brand: "Logitech",
    price: 129.99,
    discount: 0,
    stock: 37,
    rating: 4.5,
    numReviews: 671,
    tags: ["headset", "logitech", "wireless", "rgb"],
    isFeatured: false,
    isTopSelling: false,
    description:
      "Ultra-light wireless headset with Blue VO!CE mic technology and RGB.",
    image: img("Logitech G733 Lightspeed"),
    specs: {
      driver: "PRO-G 40mm",
      battery: "29 hours",
      mic: "Blue VO!CE",
      backlight: "LIGHTSYNC RGB",
    },
  },
  {
    name: "Sony WH-1000XM5",
    category: "Headset",
    brand: "Sony",
    price: 399.99,
    discount: 25,
    stock: 21,
    rating: 4.8,
    numReviews: 1036,
    tags: ["headphones", "sony", "anc", "premium"],
    isFeatured: true,
    isTopSelling: true,
    description:
      "Industry-leading noise cancellation with 30-hour battery and crystal clear calls.",
    image: img("Sony WH-1000XM5"),
    specs: {
      driver: "30mm carbon",
      anc: "Dual Noise Sensor",
      battery: "30 hours",
      codec: "LDAC",
    },
  },
  // ——— Storage & Drives ———
  {
    name: "WD Black SN850X 2TB NVMe SSD",
    category: "SSD / HDD",
    brand: "WD",
    price: 159.99,
    discount: 15,
    stock: 42,
    rating: 4.8,
    numReviews: 445,
    tags: ["ssd", "nvme", "storage", "gaming"],
    isFeatured: true,
    isTopSelling: true,
    description:
      "PCIe Gen4 NVMe drive with up to 7,300MB/s read speeds for gamers and creators.",
    image: img("WD Black SN850X 2TB NVMe SSD"),
    specs: {
      capacity: "2TB",
      interface: "PCIe 4.0 NVMe",
      read: "7,300MB/s",
      endurance: "1,200TBW",
    },
  },
  {
    name: "Samsung T7 Shield 2TB Portable",
    category: "SSD / HDD",
    brand: "Samsung",
    price: 179.99,
    discount: 0,
    stock: 33,
    rating: 4.7,
    numReviews: 512,
    tags: ["storage", "samsung", "portable", "usb-c"],
    isFeatured: false,
    isTopSelling: false,
    description:
      "Rugged, water/dust-resistant portable SSD with up to 1,050MB/s transfer speeds.",
    image: img("Samsung T7 Shield 2TB Portable"),
    specs: {
      capacity: "2TB",
      interface: "USB 3.2 Gen2",
      read: "1,050MB/s",
      rating: "IP65",
    },
  },
  {
    name: "SanDisk Extreme Pro 1TB",
    category: "SSD / HDD",
    brand: "SanDisk",
    price: 124.99,
    discount: 10,
    stock: 51,
    rating: 4.6,
    numReviews: 693,
    tags: ["storage", "sandisk", "portable", "ssd"],
    isFeatured: false,
    isTopSelling: true,
    description:
      "NVMe portable SSD with 2,000MB/s speeds and aluminum heat-sinked shell.",
    image: img("SanDisk Extreme Pro 1TB"),
    specs: {
      capacity: "1TB",
      interface: "USB 3.2 Gen2x2",
      read: "2,000MB/s",
      durability: "3m drop",
    },
  },
  {
    name: "Sabrent Rocket 4 Plus 2TB",
    category: "SSD / HDD",
    brand: "Sabrent",
    price: 189.99,
    discount: 0,
    stock: 19,
    rating: 4.7,
    numReviews: 236,
    tags: ["ssd", "nvme", "storage", "ps5"],
    isFeatured: false,
    isTopSelling: false,
    description:
      "PCIe 4.0 flagship NVMe SSD with 7,100MB/s reads — PS5-ready heatsink edition.",
    image: img("Sabrent Rocket 4 Plus 2TB"),
    specs: {
      capacity: "2TB",
      interface: "PCIe 4.0 NVMe",
      read: "7,100MB/s",
      console: "PS5 ready",
    },
  },
  // ——— Webcams & Streaming ———
  {
    name: "Logitech Brio 4K Ultra HD",
    category: "Webcams & Streaming",
    brand: "Logitech",
    price: 199.99,
    discount: 20,
    stock: 28,
    rating: 4.6,
    numReviews: 387,
    tags: ["webcam", "logitech", "4k", "streaming"],
    isFeatured: true,
    isTopSelling: true,
    description:
      "4K Ultra HD webcam with rightlight 3 HDR and Windows Hello face recognition.",
    image: img("Logitech Brio 4K Ultra HD"),
    specs: {
      resolution: "4K Ultra HD",
      field: "90°",
      hdr: "RightLight 3",
      mac_win: "Zoom, Teams, OBS",
    },
  },
  {
    name: "Elgato Facecam MK.2",
    category: "Webcams & Streaming",
    brand: "Elgato",
    price: 149.99,
    discount: 0,
    stock: 26,
    rating: 4.7,
    numReviews: 278,
    tags: ["webcam", "elgato", "streaming", "1080p"],
    isFeatured: false,
    isTopSelling: false,
    description:
      "Full HD 1080p60 creator webcam with fixed focus and advanced sensor.",
    image: img("Elgato Facecam MK.2"),
    specs: {
      resolution: "1080p60",
      sensor: "1/2\" CMOS",
      lens: "20mm prime",
      compat: "OBS Studio",
    },
  },
  {
    name: "Razer Kiyo Pro Ultra",
    category: "Webcams & Streaming",
    brand: "Razer",
    price: 299.99,
    discount: 15,
    stock: 12,
    rating: 4.5,
    numReviews: 164,
    tags: ["webcam", "razer", "4k", "streaming"],
    isFeatured: false,
    isTopSelling: false,
    description:
      "4K HDR webcam with a larger 1/1.8\" sensor for superb low-light streaming.",
    image: img("Razer Kiyo Pro Ultra"),
    specs: {
      resolution: "4K HDR",
      sensor: "1/1.8\" CMOS",
      low_light: "Superb",
      compat: "OBS / Streamlabs",
    },
  },
  {
    name: "Logitech StreamCam",
    category: "Webcams & Streaming",
    brand: "Logitech",
    price: 169.99,
    discount: 5,
    stock: 20,
    rating: 4.4,
    numReviews: 345,
    tags: ["webcam", "logitech", "streaming", "1080p"],
    isFeatured: false,
    isTopSelling: true,
    description:
      "1080p60 webcam built for streaming and video calls with AI framing.",
    image: img("Logitech StreamCam"),
    specs: {
      resolution: "1080p60",
      framing: "AI auto",
      orientation: "Portrait-ready",
      compat: "OBS / XSplit",
    },
  },
];

const slugify = (name) =>
  name.toString().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");

async function seed() {
  try {
    await Category.deleteMany({});
    await Product.deleteMany({});

    const savedCategories = await Category.insertMany(categories);
    console.log(`Inserted ${savedCategories.length} categories`);

    const nameToId = new Map(savedCategories.map((c) => [c.name, c._id]));

    const savedProducts = await Product.insertMany(
      [...products, ...parts].map((p) => ({
        ...p,
        slug: slugify(p.name),
        categoryId: nameToId.get(p.category),
        images: [p.image],
        specifications:
          (p.specifications && Object.keys(p.specifications).length
            ? p.specifications
            : (p.specs ?? {})) ,
        specs: Object.fromEntries(
          Object.entries(p.specifications ?? p.specs ?? {}).map(([k, v]) => [
            k,
            Array.isArray(v) ? v.join(", ") : String(v),
          ])
        ),
      }))
    );
    console.log(`Inserted ${savedProducts.length} products`);

    console.log("Generating product images...");
    await ensureProductImages(savedProducts.map((p) => p.image));

    mongoose.disconnect();
    console.log("Seeding complete");
    process.exit(0);
  } catch (err) {
    console.error("Seeding failed:", err.message);
    mongoose.disconnect();
    process.exit(1);
  }
}

mongoose
  .connect(process.env.MONGO_URI)
  .then(seed)
  .catch((err) => {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  });