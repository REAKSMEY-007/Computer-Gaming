const mongoose = require("mongoose");
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const Category = require("../models/Category");
const Product = require("../models/Product");

const slugify = (name) =>
  name.toString().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");

const parents = [
  {
    name: "PC & Laptop",
    slug: "pc-laptop",
    description: "Pre-built gaming PCs, office PCs, laptops and workstations.",
    icon: "laptop",
    sortOrder: 1,
  },
  {
    name: "Computer Parts",
    slug: "computer-parts",
    description: "CPU, GPU, RAM, storage, motherboards, PSUs, cases and cooling.",
    icon: "cpu",
    sortOrder: 2,
  },
  {
    name: "Gaming",
    slug: "gaming",
    description: "Peripherals, displays and gear for gaming and streaming.",
    icon: "gamepad",
    sortOrder: 3,
  },
];

const leaves = [
  { name: "Gaming PC", slug: "gaming-pc", parent: "PC & Laptop", icon: "cpu", sortOrder: 1 },
  { name: "Office PC", slug: "office-pc", parent: "PC & Laptop", icon: "monitor", sortOrder: 2 },
  { name: "Gaming Laptop", slug: "gaming-laptop", parent: "PC & Laptop", icon: "laptop", sortOrder: 3 },
  { name: "Workstation", slug: "workstation", parent: "PC & Laptop", icon: "monitor", sortOrder: 4 },

  { name: "CPU", slug: "cpu", parent: "Computer Parts", icon: "cpu", sortOrder: 1 },
  { name: "GPU / Graphics Card", slug: "gpu-graphics-card", parent: "Computer Parts", icon: "storage", sortOrder: 2 },
  { name: "RAM", slug: "ram", parent: "Computer Parts", icon: "storage", sortOrder: 3 },
  { name: "SSD / HDD", slug: "ssd-hdd", parent: "Computer Parts", icon: "storage", sortOrder: 4 },
  { name: "Motherboard", slug: "motherboard", parent: "Computer Parts", icon: "cpu", sortOrder: 5 },
  { name: "Power Supply", slug: "power-supply", parent: "Computer Parts", icon: "storage", sortOrder: 6 },
  { name: "PC Case", slug: "pc-case", parent: "Computer Parts", icon: "monitor", sortOrder: 7 },
  { name: "Cooling", slug: "cooling", parent: "Computer Parts", icon: "storage", sortOrder: 8 },

  { name: "Gaming Monitor", slug: "gaming-monitor", parent: "Gaming", icon: "monitor", sortOrder: 1 },
  { name: "Gaming Keyboard", slug: "gaming-keyboard", parent: "Gaming", icon: "keyboard", sortOrder: 2 },
  { name: "Gaming Mouse", slug: "gaming-mouse", parent: "Gaming", icon: "mouse", sortOrder: 3 },
  { name: "Headset", slug: "headset", parent: "Gaming", icon: "headphones", sortOrder: 4 },
  { name: "Gaming Chair", slug: "gaming-chair", parent: "Gaming", icon: "mouse", sortOrder: 5 },
  { name: "Controller", slug: "controller", parent: "Gaming", icon: "gamepad", sortOrder: 6 },
  { name: "Mouse Pad", slug: "mouse-pad", parent: "Gaming", icon: "mouse", sortOrder: 7 },
  { name: "Webcams & Streaming", slug: "webcams-streaming", parent: "Gaming", icon: "webcam", sortOrder: 8 },
];

// Old product category name -> new leaf category name
const productCategoryMap = {
  "Keyboards": "Gaming Keyboard",
  "Mice & Pointers": "Gaming Mouse",
  "Monitors": "Gaming Monitor",
  "Headsets & Audio": "Headset",
  "Storage & Drives": "SSD / HDD",
  "Webcams & Streaming": "Webcams & Streaming",
};

// Old category name -> new name (same as map keys)
const categoryRenameMap = {
  "Keyboards": "Gaming Keyboard",
  "Mice & Pointers": "Gaming Mouse",
  "Monitors": "Gaming Monitor",
  "Headsets & Audio": "Headset",
  "Storage & Drives": "SSD / HDD",
};

async function migrate() {
  try {
    console.log("== Phase 1 category migration ==");

    // 1. Upsert parent sections (parentCategory: "")
    const parentMap = new Map();
    for (const p of parents) {
      let cat = await Category.findOneAndUpdate(
        { slug: p.slug },
        { $set: { ...p, parentCategory: "", isActive: true } },
        { upsert: true, new: true, runValidators: true }
      );
      parentMap.set(p.name, cat._id);
      console.log(`parent: ${p.name} -> ${cat._id}`);
    }

    // 2. Rename existing legacy categories in place + re-parent under Gaming
    const createdLeafIds = new Map();
    for (const [oldName, newName] of Object.entries(categoryRenameMap)) {
      const leafCfg = leaves.find((l) => l.name === newName);
      const cat = await Category.findOne({ name: oldName });
      if (cat) {
        cat.name = newName;
        cat.slug = leafCfg.slug;
        cat.icon = leafCfg.icon;
        cat.parentCategory = leafCfg.parent;
        cat.sortOrder = leafCfg.sortOrder;
        await cat.save();
        createdLeafIds.set(newName, cat._id);
        console.log(`renamed: ${oldName} -> ${newName} (parent=${leafCfg.parent})`);
      }
    }

    // 3. Upsert all remaining leaf categories
    const leafIdMap = new Map(createdLeafIds);
    for (const l of leaves) {
      if (leafIdMap.has(l.name)) continue;
      let cat = await Category.findOneAndUpdate(
        { slug: l.slug },
        { $set: { ...l, parentCategory: l.parent, isActive: true } },
        { upsert: true, new: true, runValidators: true }
      );
      leafIdMap.set(l.name, cat._id);
      console.log(`leaf: ${l.name} -> ${cat._id}`);
    }

    // 4. Update products: new category name + categoryId, backfill specifications from specs
    const products = await Product.find({});
    let updated = 0;
    for (const prod of products) {
      const newName = productCategoryMap[prod.category];
      if (!newName) continue;
      const newId = leafIdMap.get(newName);
      const specs = prod.specs ? Object.fromEntries(prod.specs) : {};
      await Product.updateOne(
        { _id: prod._id },
        {
          $set: {
            category: newName,
            categoryId: newId,
            specifications: specs,
          },
        }
      );
      updated++;
    }
    console.log(`updated products: ${updated}/${products.length}`);

    const totalCats = await Category.countDocuments();
    const totalProds = await Product.countDocuments();
    console.log(`done. categories=${totalCats}, products=${totalProds}`);
    mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err.message);
    mongoose.disconnect();
    process.exit(1);
  }
}

mongoose
  .connect(process.env.MONGO_URI)
  .then(migrate)
  .catch((err) => {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  });