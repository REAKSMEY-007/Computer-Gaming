// Pure, framework-free PC build validator.
// validateBuild(components) has NO Express/MongoDB coupling so it can be
// unit tested directly. Components are keyed by slot name and may be
// null/undefined when that slot is unselected.

const SYSTEM_OVERHEAD_W = 100;

const SLOTS = ["cpu", "motherboard", "ram", "gpu", "psu", "case", "cooling"];

// specifications may arrive as a mongoose Map, a plain object, or missing.
// Normalize to a plain object keyed by field name.
function normalizeSpecs(product) {
  if (!product) return {};
  const raw = product.specifications ?? product.specs ?? {};
  if (typeof raw.get === "function" && typeof raw.entries === "function") {
    const out = {};
    for (const [k, v] of raw.entries()) out[k] = v;
    return out;
  }
  return raw && typeof raw === "object" ? raw : {};
}

// Use discounted price when a discount applies, else the base price.
function effectivePrice(product) {
  if (!product) return 0;
  if (typeof product.discountPrice === "number") {
    return Math.round(product.discountPrice * 100) / 100;
  }
  const discount = Number(product.discount) || 0;
  const price = Number(product.price) || 0;
  if (discount > 0) {
    return Math.round(price * (1 - discount / 100) * 100) / 100;
  }
  return Math.round(price * 100) / 100;
}

function normalizeList(value) {
  if (!value) return [];
  const list = Array.isArray(value) ? value : [value];
  return list.map((v) => String(v).trim().toLowerCase());
}

function validateBuild(components) {
  const c = {};
  for (const slot of SLOTS) c[slot] = components ? components[slot] ?? null : null;

  const spec = {};
  for (const slot of SLOTS) spec[slot] = normalizeSpecs(c[slot]);

  const issues = [];
  const selectedComponents = {};

  // 1. CPU socket must match motherboard socket.
  if (c.cpu && c.motherboard) {
    const cpuSocket = spec.cpu.socket;
    const mbSocket = spec.motherboard.socket;
    if (cpuSocket && mbSocket && String(cpuSocket) !== String(mbSocket)) {
      issues.push({
        components: ["cpu", "motherboard"],
        message: `CPU socket ${cpuSocket} does not match motherboard socket ${mbSocket}`,
      });
    }
  }

  // 2. Motherboard RAM type must match RAM kit type.
  if (c.motherboard && c.ram) {
    const mbRam = spec.motherboard.ramType;
    const ramType = spec.ram.type;
    if (mbRam && ramType && String(mbRam) !== String(ramType)) {
      issues.push({
        components: ["motherboard", "ram"],
        message: `Motherboard ${mbRam} RAM does not match RAM type ${ramType}`,
      });
    }
  }

  // 3. Motherboard form factor must be supported by the case.
  if (c.motherboard && c.case) {
    const formFactor = spec.motherboard.formFactor;
    const supported = normalizeList(spec.case.formFactorSupport);
    if (formFactor && supported.length > 0 && !supported.includes(String(formFactor).toLowerCase())) {
      issues.push({
        components: ["motherboard", "case"],
        message: `Motherboard form factor ${formFactor} is not supported by case (supports: ${spec.case.formFactorSupport.join(", ")})`,
      });
    }
  }

  // 4. GPU length must fit within the case's max GPU length (when both known).
  if (c.gpu && c.case) {
    const gpuLen = Number(spec.gpu.length_mm);
    const maxLen = Number(spec.case.maxGpuLength_mm);
    if (Number.isFinite(gpuLen) && Number.isFinite(maxLen) && gpuLen > maxLen) {
      issues.push({
        components: ["gpu", "case"],
        message: `GPU length ${gpuLen}mm exceeds case maximum GPU length of ${maxLen}mm`,
      });
    }
  }

  // 5. GPU + CPU power draw (plus overhead) must be within PSU wattage.
  if (c.gpu && c.cpu && c.psu) {
    const gpuDraw = Number(spec.gpu.powerDraw) || 0;
    const cpuTdp = Number(spec.cpu.tdp) || 0;
    const wattage = Number(spec.psu.wattage);
    const required = gpuDraw + cpuTdp + SYSTEM_OVERHEAD_W;
    if (Number.isFinite(wattage) && required > wattage) {
      issues.push({
        components: ["gpu", "cpu", "psu"],
        message: `PSU wattage ${wattage}W is insufficient for GPU drawing ${gpuDraw}W + CPU ${cpuTdp}W + ${SYSTEM_OVERHEAD_W}W system overhead (needs ${required}W)`,
      });
    }
  }

  // 6. CPU socket must be supported by the cooler.
  if (c.cpu && c.cooling) {
    const cpuSocket = String(spec.cpu.socket);
    const supported = normalizeList(spec.cooling.socketSupport);
    if (cpuSocket && supported.length > 0 && !supported.includes(cpuSocket.toLowerCase())) {
      issues.push({
        components: ["cpu", "cooling"],
        message: `Cooler does not support CPU socket ${cpuSocket} (supports: ${spec.cooling.socketSupport.join(", ")})`,
      });
    }
  }

  for (const slot of SLOTS) {
    if (c[slot]) selectedComponents[slot] = c[slot];
  }

  const totalPrice = SLOTS.reduce((sum, slot) => sum + effectivePrice(c[slot]), 0);

  return {
    compatible: issues.length === 0,
    issues,
    totalPrice: Math.round(totalPrice * 100) / 100,
    selectedComponents,
  };
}

module.exports = { validateBuild, normalizeSpecs, effectivePrice, SYSTEM_OVERHEAD_W };