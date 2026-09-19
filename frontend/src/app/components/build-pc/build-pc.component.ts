import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription, Subject } from 'rxjs';
import { switchMap, takeUntil } from 'rxjs/operators';
import {
  ProductService,
  Product,
  BuildValidation,
  BuildIssue,
} from '../../services/product.service';
import { CartService } from '../../services/cart.service';
import { AuthService } from '../../services/auth.service';
import { PricePipe } from '../../pipes/price.pipe';
import { RevealDirective } from '../../directives/reveal.directive';

interface SlotDef {
  key: string;
  label: string;
  icon: string;
  category: string; // product.category name to source parts from
  required: boolean; // storage is optional, skipped by validate endpoint
  includesInValidate: boolean;
  hint?: string;
}

export interface PresetStrategy {
  cpuSockets: string[];
  ramType: 'DDR4' | 'DDR5';
  cpuPreference: string[];
  gpuPreference: string[];
  ramPreference: string[];
  storagePreference: string[];
  /** Max spend per slot (keyed by slot). Candidates above the ceiling are skipped; if none qualify, the lowest-priced in-stock item wins. */
  priceCaps?: Record<string, number>;
  preferCooler?: 'air' | 'aio';
  /**
   * Exact model-name tokens per slot. When present for a slot, the resolver
   * ignores the generic spec heuristics for that slot and selects the
   * lowest-priced in-stock product whose name matches one of the tokens.
   */
  preferredParts?: Record<string, string[]>;
}

export interface PresetBuild {
  id: string;
  name: string;
  badge: string;
  description: string;
  image: string;
  estimatedPrice: number;
  specs: { cpu: string; gpu: string; ram: string };
  strategy: PresetStrategy;
}

const PRESET_SLOT_ORDER = ['cpu', 'motherboard', 'ram', 'gpu', 'storage', 'psu', 'case', 'cooling'];

const PRESET_BUILDS: PresetBuild[] = [
  {
    id: 'budget-esports',
    name: 'Budget Esports',
    badge: 'Best Value',
    description: 'A 1080p high-refresh esports machine on an LGA1700/AM4 platform — keeps essentials, cuts the fat.',
    image: '/uploads/products/xfx-speedster-swft210-radeon-rx-6600-8gb.jpg',
    estimatedPrice: 650,
    specs: { cpu: 'Ryzen 5 5600 / i5-13600K', gpu: 'RX 6600 / RTX 3050', ram: '16GB DDR4' },
    strategy: {
      cpuSockets: ['AM4', 'LGA1700'],
      ramType: 'DDR4',
      cpuPreference: ['12100F', '13100F', '5600', '5500', '4500', '13400'],
      gpuPreference: ['RX 6600', 'RTX 3050', 'RTX 4060', 'RX 7600'],
      ramPreference: ['16GB'],
      storagePreference: ['NVMe'],
      priceCaps: { cpu: 150, gpu: 220, motherboard: 100, storage: 60, psu: 55, case: 45 },
      preferCooler: 'air',
      preferredParts: {
        cpu: ['Ryzen 5 5600'],
        motherboard: ['B550M'],
        ram: ['Vengeance LPX'],
        gpu: ['RX 6600'],
        storage: ['Kingston NV2'],
        psu: ['EVGA 600 W1'],
        case: ['Versa H18'],
        cooling: ['DeepCool AG400'],
      },
    },
  },
  {
    id: 'mid-range-gaming',
    name: 'Mid-Range Gaming',
    badge: 'Sweet Spot',
    description: '1440p gaming on the DDR5 AM5 platform — smooth frames without the workstation price tag.',
    image: '/uploads/products/nvidia-geforce-rtx-4070-super.jpg',
    estimatedPrice: 1200,
    specs: { cpu: 'Ryzen 5 7600', gpu: 'RTX 4070 Super', ram: '32GB DDR5' },
    strategy: {
      cpuSockets: ['AM5'],
      ramType: 'DDR5',
      cpuPreference: ['7600', '7700', '7800X3D'],
      gpuPreference: ['RTX 4060', 'RTX 4060 Ti', 'RTX 4070'],
      ramPreference: ['32GB'],
      storagePreference: ['NVMe'],
      priceCaps: { gpu: 600 },
      preferCooler: 'air',
    },
  },
  {
    id: 'ultimate-workstation',
    name: 'Ultimate Workstation',
    badge: '4K Ready',
    description: '8-16 core AM5 powerhouse with DDR5 capacity and flagship-class rendering for the most demanding workloads.',
    image: '/uploads/products/nvidia-geforce-rtx-4090.jpg',
    estimatedPrice: 2500,
    specs: { cpu: 'Ryzen 9 7950X / 7800X3D', gpu: 'RTX 4090', ram: '32/64GB DDR5' },
    strategy: {
      cpuSockets: ['AM5'],
      ramType: 'DDR5',
      cpuPreference: ['7950X', '7900X', '7800X3D'],
      gpuPreference: ['RTX 4090', 'RTX 4080', 'RX 7900'],
      ramPreference: ['64GB', '32GB'],
      storagePreference: ['NVMe'],
      preferCooler: 'aio',
    },
  },
];

const SLOT_DEFS: SlotDef[] = [
  { key: 'cpu', label: 'CPU', icon: 'M4 6h16M4 12h16M4 18h7', category: 'CPU', required: false, includesInValidate: true, hint: 'Socket, TDP' },
  { key: 'motherboard', label: 'Motherboard', icon: 'M4 6h16M4 12h16M4 18h7', category: 'Motherboard', required: false, includesInValidate: true, hint: 'Socket, RAM type, form factor' },
  { key: 'ram', label: 'RAM', icon: 'M4 6h16M4 12h16M4 18h7', category: 'RAM', required: false, includesInValidate: true, hint: 'Type, speed, capacity' },
  { key: 'gpu', label: 'GPU', icon: 'M4 6h16M4 12h16M4 18h7', category: 'GPU / Graphics Card', required: false, includesInValidate: true, hint: 'Power draw, length' },
  { key: 'storage', label: 'Storage', icon: 'M4 6h16M4 12h16M4 18h7', category: 'SSD / HDD', required: false, includesInValidate: false, hint: 'Optional' },
  { key: 'psu', label: 'Power Supply', icon: 'M4 6h16M4 12h16M4 18h7', category: 'Power Supply', required: false, includesInValidate: true, hint: 'Wattage' },
  { key: 'case', label: 'PC Case', icon: 'M4 6h16M4 12h16M4 18h7', category: 'PC Case', required: false, includesInValidate: true, hint: 'Form factor support, GPU clearance' },
  { key: 'cooling', label: 'Cooling', icon: 'M4 6h16M4 12h16M4 18h7', category: 'Cooling', required: false, includesInValidate: true, hint: 'Socket support' },
];

@Component({
  selector: 'app-build-pc',
  standalone: true,
  imports: [CommonModule, PricePipe, RevealDirective],
  templateUrl: './build-pc.component.html',
  styleUrl: './build-pc.component.css',
})
export class BuildPcComponent implements OnInit, OnDestroy {
  slotDefs = SLOT_DEFS;
  presetBuilds = PRESET_BUILDS;

  productsBySlot: Record<string, Product[]> = {};
  selected: Record<string, Product | null> = {};
  validation: BuildValidation | null = null;

  isLoadingParts = true;
  validating = false;
  addingToCart = false;
  addedToCart = false;

  presetNotice: string | null = null;
  presetNoticeIsSuccess = true;
  presetAppliedId: string | null = null;
  private pendingPresetName: string | null = null;

  issuesBySlot: Record<string, BuildIssue[]> = {};

  private destroy$ = new Subject<void>();
  private categoriesSub!: Subscription;
  private validationSub!: Subscription;

  constructor(
    private productService: ProductService,
    private cartService: CartService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.categoriesSub = this.productService.getAllProducts().subscribe((products) => {
      this.isLoadingParts = false;
      for (const def of SLOT_DEFS) {
        this.productsBySlot[def.key] = products
          .filter(
            (p) =>
              p.category === def.category &&
              p.isActive !== false &&
              Number(p.stock) > 0
          )
          .sort((a, b) => a.name.localeCompare(b.name));
      }
      this.validateCompatibility();
    });
  }

  isSelected(slot: string, product: Product): boolean {
    return this.selected[slot]?._id === product._id;
  }

  toggleSelect(slot: string, product: Product): void {
    if (this.addingToCart) return;
    if (this.isSelected(slot, product)) {
      this.selected[slot] = null;
    } else {
      this.selected[slot] = product;
    }
    this.pendingPresetName = null;
    this.validateCompatibility();
  }

  applyPresetBuild(preset: PresetBuild): void {
    if (this.isLoadingParts || this.addingToCart) return;

    const resolved = this.resolvePreset(preset);
    for (const slot of PRESET_SLOT_ORDER) {
      this.selected[slot] = resolved[slot] ?? this.selected[slot];
    }

    this.presetAppliedId = preset.id;
    this.pendingPresetName = preset.name;
    this.presetNotice = `Loading "${preset.name}" parts and checking compatibility…`;
    this.presetNoticeIsSuccess = true;
    this.validateCompatibility((v) => {
      const presetName = this.pendingPresetName;
      if (!presetName) return;
      this.pendingPresetName = null;

      const loaded = PRESET_SLOT_ORDER.reduce((n, slot) => n + (this.selected[slot] ? 1 : 0), 0);
      const emptySlots = PRESET_SLOT_ORDER.filter((slot) => !this.selected[slot]);
      const issueCount = v?.issues.length ?? 0;

      if (v?.compatible && emptySlots.length === 0) {
        this.presetNoticeIsSuccess = true;
        this.presetNotice = 'All parts successfully loaded and verified compatible!';
      } else if (v?.compatible) {
        this.presetNoticeIsSuccess = false;
        this.presetNotice =
          `Loaded ${loaded} of ${PRESET_SLOT_ORDER.length} parts using the closest in-stock alternatives. ` +
          (emptySlots.length
            ? `${emptySlots.map((s) => this.slotLabel(s)).join(', ')} not in stock — pick one to complete the build and it will stay verified.`
            : '');
      } else {
        this.presetNoticeIsSuccess = false;
        this.presetNotice =
          `Loaded ${loaded} of ${PRESET_SLOT_ORDER.length} parts using the closest in-stock alternatives — ` +
          `resolve ${issueCount} compatibility issue${issueCount === 1 ? '' : 's'} below.`;
      }
    });
  }

  private slotLabel(key: string): string {
    return SLOT_DEFS.find((d) => d.key === key)?.label ?? key;
  }

  /** Spec-driven resolver: matches by socket/RAM form-factor/wattage criteria instead of hardcoded names. */
  private resolvePreset(preset: PresetBuild): Record<string, Product | null> {
    const out: Record<string, Product | null> = {};
    // Explicit model tokens (e.g. the Budget Esports parts) take priority over
    // the generic spec heuristics; unlisted slots fall back to the heuristics.
    const preferred = preset.strategy.preferredParts ?? {};
    // Resolve in dependency order: socket & RAM type first, then power/length constraints.
    const cpu = this.pickPreferred('cpu', preferred['cpu']) ?? this.pickCpu(preset);
    const motherboard = this.pickPreferred('motherboard', preferred['motherboard']) ?? this.pickMotherboard(preset, cpu);
    const ram = this.pickPreferred('ram', preferred['ram']) ?? this.pickRam(preset, motherboard);
    const gpu = this.pickPreferred('gpu', preferred['gpu']) ?? this.pickGpu(preset);
    const psu = this.pickPreferred('psu', preferred['psu']) ?? this.pickPsu(preset, cpu, gpu);
    const pcCase = this.pickPreferred('case', preferred['case']) ?? this.pickCase(preset, motherboard, gpu);
    const cooling = this.pickPreferred('cooling', preferred['cooling']) ?? this.pickCooling(preset, cpu);
    const storage = this.pickPreferred('storage', preferred['storage']) ?? this.pickStorage(preset);

    out['cpu'] = cpu;
    out['motherboard'] = motherboard;
    out['ram'] = ram;
    out['gpu'] = gpu;
    out['psu'] = psu;
    out['case'] = pcCase;
    out['cooling'] = cooling;
    out['storage'] = storage;
    return out;
  }

  /**
   * Filter the slot's in-stock pool by the given model-name tokens and pick
   * the cheapest match (price ascending). Returns null when no tokens are
   * supplied or nothing matches, so callers can fall back to the heuristics.
   */
  private pickPreferred(slot: string, tokens?: string[]): Product | null {
    if (!tokens?.length) return null;
    const clean = tokens.map((t) => t.toLowerCase());
    const pool = (this.productsBySlot[slot] ?? []).filter((p) =>
      clean.some((t) => p.name.toLowerCase().includes(t))
    );
    return this.priceSorted(pool)[0] ?? null;
  }

  private bySpec(p: Product | null, key: string): string {
    if (!p) return '';
    const spec = (p.specifications ?? p.specs ?? {}) as Record<string, unknown>;
    const value = spec?.[key];
    if (value === undefined || value === null) return '';
    return Array.isArray(value) ? value.join(',').toLowerCase() : String(value).toLowerCase();
  }

  private supportsSpec(p: Product, key: string, token: string): boolean {
    if (!token) return true;
    return this.bySpec(p, key)
      .split(',')
      .map((t) => t.trim())
      .includes(token);
  }

  private priceOf(p: Product): number {
    return CartService.effectivePrice(p);
  }

  private priceSorted(list: Product[]): Product[] {
    return [...list].sort((a, b) => this.priceOf(a) - this.priceOf(b));
  }

  /**
   * Pick the most affordable match: candidates sorted ascending by price are
   * scanned under the pet-slot ceiling; if none qualify, the absolute
   * lowest-priced in-stock item in the given candidate set wins.
   */
  private cheapWithCap(pool: Product[], ceiling: number): Product | null {
    const sorted = this.priceSorted(pool);
    if (ceiling > 0) {
      const under = sorted.filter((p) => this.priceOf(p) <= ceiling);
      if (under.length) return under[0];
    }
    return sorted[0] ?? null;
  }

  private capFor(preset: PresetBuild, slot: string): number {
    return preset.strategy.priceCaps?.[slot] ?? 0;
  }

  /** Prefer name-flavored matches, but never narrow below an empty pool — return the closest, cheapest in stock. */
  private flavor(pool: Product[], tokens: string[]): Product[] {
    if (tokens.length === 0 || pool.length < 2) return pool;
    const clean = tokens.map((t) => t.toLowerCase());
    const hit = pool.filter((p) => clean.some((t) => p.name.toLowerCase().includes(t)));
    return hit.length > 0 ? hit : pool;
  }

  private pickCpu(preset: PresetBuild): Product | null {
    const sockets = preset.strategy.cpuSockets.map((s) => s.toLowerCase());
    let pool = (this.productsBySlot['cpu'] ?? []).filter(
      (p) => sockets.length === 0 || sockets.some((s) => this.bySpec(p, 'socket').includes(s))
    );
    pool = this.flavor(pool, preset.strategy.cpuPreference);
    const cap = this.capFor(preset, 'cpu');
    const familyPick = this.cheapWithCap(pool, cap);
    if (familyPick && (cap <= 0 || this.priceOf(familyPick) <= cap)) return familyPick;
    // No affordable CPU in the desired family under the ceiling —
    // closest in-stock alternative: absolute lowest-priced CPU in the category.
    return this.cheapWithCap(this.productsBySlot['cpu'] ?? [], cap);
  }

  private pickMotherboard(preset: PresetBuild, cpu: Product | null): Product | null {
    let pool = this.productsBySlot['motherboard'] ?? [];
    const socket = this.bySpec(cpu, 'socket');
    if (socket) {
      const matched = pool.filter((p) => this.bySpec(p, 'socket') === socket);
      if (matched.length) pool = matched;
    }
    const wantDdr = preset.strategy.ramType.toLowerCase();
    const ddrPool = pool.filter((p) => this.bySpec(p, 'ramType') === wantDdr);
    if (ddrPool.length) pool = ddrPool;
    const matched = this.cheapWithCap(pool, this.capFor(preset, 'motherboard'));
    if (matched) return matched;
    // No affordable in-family board — closest in-stock alternative: cheapest motherboard overall.
    return this.cheapWithCap(this.productsBySlot['motherboard'] ?? [], this.capFor(preset, 'motherboard'));
  }

  private pickRam(preset: PresetBuild, motherboard: Product | null): Product | null {
    let pool = this.productsBySlot['ram'] ?? [];
    // Compatibility first: RAM type must match the chosen motherboard when known.
    const mbRam = this.bySpec(motherboard, 'ramType');
    if (mbRam) {
      const typed = pool.filter((p) => this.bySpec(p, 'type') === mbRam);
      if (typed.length) pool = typed;
    } else {
      const wantDdr = preset.strategy.ramType.toLowerCase();
      const ddrPool = pool.filter((p) => this.bySpec(p, 'type') === wantDdr);
      if (ddrPool.length) pool = ddrPool;
    }
    pool = this.flavor(pool, preset.strategy.ramPreference);
    return this.cheapWithCap(pool, this.capFor(preset, 'ram')) ?? null;
  }

  private pickGpu(preset: PresetBuild): Product | null {
    let pool = this.productsBySlot['gpu'] ?? [];
    pool = this.flavor(pool, preset.strategy.gpuPreference);
    const matched = this.cheapWithCap(pool, this.capFor(preset, 'gpu'));
    if (matched) return matched;
    // No affordable match — closest in-stock alternative: cheapest GPU overall.
    return this.cheapWithCap(this.productsBySlot['gpu'] ?? [], this.capFor(preset, 'gpu'));
  }

  private pickPsu(preset: PresetBuild, cpu: Product | null, gpu: Product | null): Product | null {
    const cpuTdp = Number(this.bySpec(cpu, 'tdp')) || 0;
    const gpuDraw = Number(this.bySpec(gpu, 'powerDraw')) || 0;
    const required = gpuDraw + cpuTdp + 100;
    const pool = this.productsBySlot['psu'] ?? [];

    let candidates = pool.filter((p) => Number(this.bySpec(p, 'wattage')) >= required);
    // Budget builds prefer a 500W-600W Bronze unit whenever it covers the load.
    if (required <= 600) {
      const rangePool = candidates.filter((p) => Number(this.bySpec(p, 'wattage')) <= 600);
      if (rangePool.length) candidates = rangePool;
    }
    const bronzePool = candidates.filter((p) => this.bySpec(p, 'rating').includes('bronze'));
    if (bronzePool.length) candidates = bronzePool;

    const matched = this.cheapWithCap(candidates, this.capFor(preset, 'psu'));
    if (matched) return matched;
    return this.cheapWithCap(pool, this.capFor(preset, 'psu'));
  }

  private pickCase(preset: PresetBuild, motherboard: Product | null, gpu: Product | null): Product | null {
    let pool = this.productsBySlot['case'] ?? [];
    const formFactor = this.bySpec(motherboard, 'formFactor');
    if (formFactor) {
      const supported = pool.filter((p) => this.supportsSpec(p, 'formFactorSupport', formFactor));
      if (supported.length) pool = supported;
    }
    const gpuLen = Number(this.bySpec(gpu, 'length_mm'));
    if (Number.isFinite(gpuLen)) {
      const fits = pool.filter((p) => {
        const max = Number(this.bySpec(p, 'maxGpuLength_mm'));
        return !Number.isFinite(max) || gpuLen <= max;
      });
      if (fits.length) pool = fits;
    }
    const matched = this.cheapWithCap(pool, this.capFor(preset, 'case'));
    if (matched) return matched;
    // Closest in-stock alternative: cheapest case that still fits the build.
    return this.cheapWithCap(this.productsBySlot['case'] ?? [], this.capFor(preset, 'case'));
  }

  private pickCooling(preset: PresetBuild, cpu: Product | null): Product | null {
    let pool = this.productsBySlot['cooling'] ?? [];
    const socket = this.bySpec(cpu, 'socket');
    if (socket) {
      const supported = pool.filter((p) => this.supportsSpec(p, 'socketSupport', socket));
      if (supported.length) pool = supported;
    }
    const want = preset.strategy.preferCooler?.toLowerCase();
    if (want) {
      const typed = pool.filter((p) => this.bySpec(p, 'type').includes(want));
      if (typed.length) pool = typed;
    }
    return this.cheapWithCap(pool, this.capFor(preset, 'cooling'));
  }

  private pickStorage(preset: PresetBuild): Product | null {
    let pool = this.productsBySlot['storage'] ?? [];
    pool = this.flavor(pool, preset.strategy.storagePreference);
    const nvme = pool.filter(
      (p) => this.bySpec(p, 'type').includes('nvme') || this.bySpec(p, 'interface').includes('nvme')
    );
    if (nvme.length) pool = nvme;
    const matched = this.cheapWithCap(pool, this.capFor(preset, 'storage'));
    if (matched) return matched;
    return this.cheapWithCap(this.productsBySlot['storage'] ?? [], this.capFor(preset, 'storage'));
  }

  dismissPresetNotice(): void {
    this.presetNotice = null;
  }

  private validateCompatibility(onComplete?: (v: BuildValidation | null) => void): void {
    if (this.isLoadingParts) return;
    this.validating = true;
    this.validationSub?.unsubscribe();

    this.validationSub = this.productService
      .validatePcBuild(this.validationBody())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (v) => {
          this.validating = false;
          this.validation = v;
          this.computeIssuesBySlot(v);
          onComplete?.(v);
        },
        error: () => {
          this.validating = false;
          this.validation = null;
          this.issuesBySlot = {};
          onComplete?.(null);
        },
      });
  }

  private validationBody(): {
    cpuId: string | null;
    motherboardId: string | null;
    ramId: string | null;
    gpuId: string | null;
    psuId: string | null;
    caseId: string | null;
    coolingId: string | null;
  } {
    return {
      cpuId: this.selected['cpu']?._id ?? null,
      motherboardId: this.selected['motherboard']?._id ?? null,
      ramId: this.selected['ram']?._id ?? null,
      gpuId: this.selected['gpu']?._id ?? null,
      psuId: this.selected['psu']?._id ?? null,
      caseId: this.selected['case']?._id ?? null,
      coolingId: this.selected['cooling']?._id ?? null,
    };
  }

  private computeIssuesBySlot(v: BuildValidation): void {
    const map: Record<string, BuildIssue[]> = {};
    for (const issue of v.issues) {
      for (const slot of issue.components) {
        if (!map[slot]) map[slot] = [];
        map[slot].push(issue);
      }
    }
    this.issuesBySlot = map;
  }

  issuesFor(slot: string): BuildIssue[] {
    return this.issuesBySlot[slot] ?? [];
  }

  isSlotOk(slot: string): boolean {
    return !!this.selected[slot] && this.issuesFor(slot).length === 0;
  }

  cardClass(slot: string, product: Product): string {
    const base =
      'group flex flex-col rounded-2xl border bg-white/90 dark:bg-slate-900/90 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-60';
    if (this.isSelected(slot, product)) {
      const ok = this.issuesFor(slot).length === 0;
      return `${base} ${
        ok
          ? 'border-success-400 ring-2 ring-success-200 dark:ring-success-500/40 shadow-[0_8px_18px_-8px_rgba(16,185,129,0.5)] -translate-y-0.5'
          : 'border-danger-400 ring-2 ring-danger-200 dark:ring-danger-500/40 shadow-[0_8px_18px_-8px_rgba(239,68,68,0.5)] -translate-y-0.5'
      } p-2 cursor-pointer`;
    }
    return `${base} border-slate-100 dark:border-slate-800 shadow-sm hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-md hover:-translate-y-0.5 p-2 cursor-pointer`;
  }

  outputPrice(p: Product): number {
    return CartService.effectivePrice(p);
  }

  effectivePrice(): number {
    return SLOT_DEFS.reduce((sum, def) => {
      const p = this.selected[def.key];
      return sum + (p ? CartService.effectivePrice(p) : 0);
    }, 0);
  }

  selectedCount(): number {
    return SLOT_DEFS.reduce((n, def) => n + (this.selected[def.key] ? 1 : 0), 0);
  }

  get compatible(): boolean {
    return !!this.validation?.compatible;
  }

  get compatibleIssueCount(): number {
    return this.validation?.issues.length ?? 0;
  }

  addAllToCart(): void {
    if (!this.compatible || this.addingToCart) return;
    if (!this.requireAuth()) return;
    this.addingToCart = true;

    // small delay so the loading state is visible before navigation
    setTimeout(() => {
      let added = 0;
      for (const def of SLOT_DEFS) {
        const p = this.selected[def.key];
        if (!p) continue;
        this.cartService.addItem(p, 1);
        added++;
      }
      console.log(`[BuildPC] added ${added} components as separate cart lines`);
      this.addingToCart = false;
      this.router.navigate(['/cart']);
    }, 350);
  }

  private requireAuth(): boolean {
    if (this.authService.isLoggedIn()) {
      return true;
    }
    this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
    return false;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.categoriesSub?.unsubscribe();
    this.validationSub?.unsubscribe();
  }
}