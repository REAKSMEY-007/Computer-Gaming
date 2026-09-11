const mongoose = require("mongoose");
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const Product = require("../models/Product");
const { validateBuild } = require("../utils/buildPcValidator");

const pick = (list, name) => list.find((p) => p.name.includes(name));

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const parts = await Product.find({}).select("-__v");

  const byCat = (cat) => parts.filter((p) => p.category === cat);

  const cpuAm5 = pick(byCat("CPU"), "Ryzen 5 7600");
  const cpuX3d = pick(byCat("CPU"), "7800X3D");
  const cpuIntel = pick(byCat("CPU"), "i5-13600K");
  const mbAm5 = pick(byCat("Motherboard"), "Strix B650E-F");
  const mbIntelDdr5 = pick(byCat("Motherboard"), "B760M Mortar");
  const mbIntelDdr4 = pick(byCat("Motherboard"), "Prime B760M-A");
  const ramDdr5 = pick(byCat("RAM"), "Vengeance RGB 32GB");
  const ramDdr4 = pick(byCat("RAM"), "Fury Beast 16GB");
  const gpu4090 = pick(byCat("GPU / Graphics Card"), "RTX 4090");
  const gpu4070 = pick(byCat("GPU / Graphics Card"), "4070 Super");
  const psu650 = pick(byCat("Power Supply"), "RM650x");
  const psu1000 = pick(byCat("Power Supply"), "HX1000");
  const caseFlow = pick(byCat("PC Case"), "NZXT H5 Flow");
  const caseNr200 = pick(byCat("PC Case"), "NR200P");
  const coolerU9s = pick(byCat("Cooling"), "NH-U9S");
  const coolerU12s = pick(byCat("Cooling"), "NH-U12S");

  const scenarios = [
    {
      label: "1. AM5 CPU + LGA1700 motherboard (socket mismatch)",
      args: { cpu: cpuAm5, motherboard: mbIntelDdr5 },
    },
    {
      label: "2. DDR5 motherboard + DDR4 RAM (RAM type mismatch)",
      args: { motherboard: mbAm5, ram: ramDdr4 },
    },
    {
      label: "3. ATX motherboard + ITX-only case (form factor mismatch)",
      args: { motherboard: mbAm5, case: caseNr200 },
    },
    {
      label: "4. RTX 4090 (450W) + 7800X3D (120W) + 650W PSU (insufficient wattage = 670W needed)",
      args: { cpu: cpuX3d, gpu: gpu4090, psu: psu650 },
    },
    {
      label: "5. NH-U9S cooler (AM4/LGA1200) + AM5 CPU (socket support)",
      args: { cpu: cpuAm5, cooling: coolerU9s },
    },
    {
      label: "6. GPU length vs case max length (4090 in NR200P 330mm)",
      args: { gpu: gpu4090, case: caseNr200 },
    },
    {
      label: "7. FULLY COMPATIBLE AMD build",
      args: {
        cpu: cpuAm5,
        motherboard: mbAm5,
        ram: ramDdr5,
        gpu: gpu4070,
        psu: psu650,
        case: caseFlow,
        cooling: coolerU12s,
      },
    },
    {
      label: "8. FULLY COMPATIBLE Intel build (DDR4 board)",
      args: {
        cpu: cpuIntel,
        motherboard: mbIntelDdr4,
        ram: ramDdr4,
        gpu: gpu4070,
        psu: psu1000,
        case: caseFlow,
        cooling: coolerU12s,
      },
    },
  ];

  let allOk = true;
  for (const s of scenarios) {
    const { compatible, issues, totalPrice } = validateBuild(s.args);
    const summary = issues.map((i) => i.message).join(" | ") || "no issues";
    console.log(`\n== ${s.label}`);
    console.log(`compatible: ${compatible} | totalPrice: $${totalPrice}`);
    issues.forEach((i) => console.log(`  [${i.components.join(", ")}] ${i.message}`));
    if (s.label.includes("FULLY COMPATIBLE") && !compatible) allOk = false;
    if (!s.label.includes("FULLY COMPATIBLE") && compatible) allOk = false;
  }

  console.log(`\n${allOk ? "ALL SCENARIOS PASS" : "SOME SCENARIOS FAILED"}`);
  mongoose.disconnect();
  process.exit(allOk ? 0 : 1);
}

run().catch((e) => {
  console.error(e);
  mongoose.disconnect();
  process.exit(1);
});