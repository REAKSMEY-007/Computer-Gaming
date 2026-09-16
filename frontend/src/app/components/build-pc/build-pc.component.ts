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

interface SlotDef {
  key: string;
  label: string;
  icon: string;
  category: string; // product.category name to source parts from
  required: boolean; // storage is optional, skipped by validate endpoint
  includesInValidate: boolean;
  hint?: string;
}

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
  imports: [CommonModule, PricePipe],
  templateUrl: './build-pc.component.html',
  styleUrl: './build-pc.component.css',
})
export class BuildPcComponent implements OnInit, OnDestroy {
  slotDefs = SLOT_DEFS;

  productsBySlot: Record<string, Product[]> = {};
  selected: Record<string, Product | null> = {};
  validation: BuildValidation | null = null;

  isLoadingParts = true;
  validating = false;
  addingToCart = false;
  addedToCart = false;

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
      this.validateWithServer();
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
    this.validateWithServer();
  }

  private validateWithServer(): void {
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
        },
        error: () => {
          this.validating = false;
          this.validation = null;
          this.issuesBySlot = {};
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