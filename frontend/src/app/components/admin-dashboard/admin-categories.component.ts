import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  LucideKeyboard,
  LucideMouse,
  LucideMonitor,
  LucideHeadphones,
  LucideHardDrive,
  LucideWebcam,
  LucideBoxes,
  LucidePackage,
  LucidePencil,
  LucideTrash2,
  LucideChevronRight,
  LucideSearch,
  LucideArrowUp,
  LucideArrowDown,
  LucideFolder,
  LucideFolderOpen,
  LucidePlus,
} from '@lucide/angular';
import { ProductService, Product, Category } from '../../services/product.service';
import { AbsoluteUrlPipe } from '../../pipes/absolute-url.pipe';

type CategoryAccent = {
  badge: string;
  pill: string;
};

interface CategoryForm {
  name: string;
  slug: string;
  description: string;
  image: string;
  icon: string;
  sortOrder: number;
  isActive: boolean;
  parentCategory: string;
}

const emptyForm = (): CategoryForm => ({
  name: '',
  slug: '',
  description: '',
  image: '',
  icon: '',
  sortOrder: 0,
  isActive: true,
  parentCategory: '',
});

@Component({
  selector: 'app-admin-categories',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LucideKeyboard,
    LucideMouse,
    LucideMonitor,
    LucideHeadphones,
    LucideHardDrive,
    LucideWebcam,
    LucideBoxes,
    LucidePackage,
    LucidePencil,
    LucideTrash2,
    LucideChevronRight,
    LucideSearch,
    LucideArrowUp,
    LucideArrowDown,
    LucideFolder,
    LucideFolderOpen,
    LucidePlus,
    AbsoluteUrlPipe,
  ],
  templateUrl: './admin-categories.component.html',
})
export class AdminCategoriesComponent implements OnInit {
  categories: Category[] = [];
  productCounts: Record<string, number> = {};
  loading = true;
  errorMessage = '';
  successMessage = '';

  showForm = false;
  editingId: string | null = null;
  form: CategoryForm = emptyForm();

  searchTerm = '';
  expandedSections: Set<string> = new Set();
  imageFailures: Record<string, boolean> = {};

  constructor(private productService: ProductService) {}

  ngOnInit(): void {
    this.loadCategories();
  }

  loadCategories(): void {
    this.loading = true;
    this.productService.getCategories().subscribe({
      next: (data) => {
        this.categories = data;
        this.loading = false;
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Failed to load categories';
        this.loading = false;
      },
    });
    this.productService.getAllProducts().subscribe({
      next: (products: Product[]) => {
        const counts: Record<string, number> = {};
        for (const p of products) {
          counts[p.category] = (counts[p.category] ?? 0) + 1;
        }
        this.productCounts = counts;
      },
      error: () => {},
    });
  }

  // ---- counts ----

  categoryProductCount(category: Category): number {
    return this.productCounts[category.name] ?? 0;
  }

  sectionProductCount(section: Category): number {
    return this.childrenOf(section.name).reduce((sum, child) => sum + this.categoryProductCount(child), 0);
  }

  get totalProducts(): number {
    return Object.values(this.productCounts).reduce((sum, n) => sum + n, 0);
  }

  // ---- tree structure ----

  get parentSections(): Category[] {
    return this.categories
      .filter((c) => !(c.parentCategory ?? '').trim())
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));
  }

  childrenOf(name: string): Category[] {
    return this.categories
      .filter((c) => (c.parentCategory ?? '') === name)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));
  }

  hasChildren(name: string): boolean {
    return this.childrenOf(name).length > 0;
  }

  parentName(category: Category): string {
    return category.parentCategory || '';
  }

  // ---- expansion ----

  get searching(): boolean {
    return this.searchTerm.trim().length > 0;
  }

  isExpanded(name: string): boolean {
    if (this.searching) return true;
    return this.expandedSections.has(name);
  }

  toggleSection(name: string): void {
    if (this.expandedSections.has(name)) {
      this.expandedSections.delete(name);
    } else {
      this.expandedSections.add(name);
    }
  }

  // ---- search / filter ----

  private normalized(c: Category): string {
    return (c.name + ' ' + c.slug + ' ' + (c.parentCategory ?? '')).toLowerCase();
  }

  get filteredSections(): Category[] {
    const q = this.searchTerm.trim().toLowerCase();
    const sections = this.parentSections;
    if (!q) return sections;
    return sections.filter((s) => this.sectionMatches(s, q));
  }

  private sectionMatches(section: Category, q: string): boolean {
    return this.normalized(section).includes(q) || this.childrenOf(section.name).some((c) => this.normalized(c).includes(q));
  }

  filteredChildrenOf(name: string): Category[] {
    const q = this.searchTerm.trim().toLowerCase();
    const all = this.childrenOf(name);
    if (!q) return all;
    const section = this.parentSections.find((s) => s.name === name);
    if (section && this.normalized(section).includes(q)) return all;
    return all.filter((c) => this.normalized(c).includes(q));
  }

  get noSearchResults(): boolean {
    return this.searching && this.filteredSections.length === 0;
  }

  clearSearch(): void {
    this.searchTerm = '';
  }

  // ---- icons / accents ----

  hasCategoryImage(category: Category): boolean {
    return !!category.image && !this.imageFailures[category._id];
  }

  onImageError(category: Category): void {
    this.imageFailures[category._id] = true;
  }

  categoryIconKey(category: Category): string {
    const raw = (category.icon || category.slug || category.name || '').toLowerCase();
    if (raw.includes('keyboard')) return 'keyboard';
    if (raw.includes('mouse')) return 'mouse';
    if (raw.includes('monitor') || raw.includes('display') || raw.includes('screen')) return 'monitor';
    if (raw.includes('headphone') || raw.includes('headset') || raw.includes('audio') || raw.includes('sound')) return 'headphones';
    if (raw.includes('storage') || raw.includes('drive') || raw.includes('hard') || raw.includes('ssd')) return 'storage';
    if (raw.includes('webcam') || raw.includes('camera') || raw.includes('stream')) return 'webcam';
    return 'default';
  }

  categoryAccent(category: Category): CategoryAccent {
    const accents: Record<string, CategoryAccent> = {
      keyboard: { badge: 'bg-primary-50 text-primary-600 dark:bg-primary-500/15 dark:text-primary-400', pill: 'bg-primary-50 text-primary-700 ring-primary-100 dark:bg-primary-500/15 dark:text-primary-300 dark:ring-primary-500/30' },
      mouse: { badge: 'bg-primary-50 text-primary-600 dark:bg-primary-500/15 dark:text-primary-400', pill: 'bg-primary-50 text-primary-700 ring-primary-100 dark:bg-primary-500/15 dark:text-primary-300 dark:ring-primary-500/30' },
      monitor: { badge: 'bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-400', pill: 'bg-warning-50 text-warning-700 ring-warning-100 dark:bg-warning-500/15 dark:text-warning-300 dark:ring-warning-500/30' },
      headphones: { badge: 'bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-400', pill: 'bg-success-50 text-success-700 ring-success-100 dark:bg-success-500/15 dark:text-success-300 dark:ring-success-500/30' },
      storage: { badge: 'bg-primary-50 text-primary-600 dark:bg-primary-500/15 dark:text-primary-400', pill: 'bg-primary-50 text-primary-700 ring-primary-100 dark:bg-primary-500/15 dark:text-primary-300 dark:ring-primary-500/30' },
      webcam: { badge: 'bg-danger-50 text-danger-600 dark:bg-danger-500/15 dark:text-danger-400', pill: 'bg-danger-50 text-danger-700 ring-danger-100 dark:bg-danger-500/15 dark:text-danger-300 dark:ring-danger-500/30' },
      default: { badge: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-200', pill: 'bg-neutral-100 text-neutral-700 ring-neutral-200 dark:bg-neutral-700/60 dark:text-neutral-300 dark:ring-neutral-600' },
    };
    return accents[this.categoryIconKey(category)] ?? accents['default'];
  }

  // ---- ordering ----

  reorderCategory(category: Category, dir: -1 | 1): void {
    const group = (category.parentCategory ?? '').trim();
    const groupList = this.categories
      .filter((c) => (c.parentCategory ?? '').trim() === group)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));
    const idx = groupList.findIndex((s) => s._id === category._id);
    const target = idx + dir;
    if (target < 0 || target >= groupList.length) return;

    const reordered = groupList.slice();
    [reordered[idx], reordered[target]] = [reordered[target], reordered[idx]];

    this.errorMessage = '';
    this.successMessage = '';
    const updates = reordered.map((r, i) => ({ id: r._id, sortOrder: i + 1 }));

    this.categories = this.categories.map((c) => {
      const i = reordered.findIndex((r) => r._id === c._id);
      return i >= 0 ? { ...c, sortOrder: i + 1 } : c;
    });

    const pending = updates.length;
    let done = 0;
    for (const u of updates) {
      this.productService.updateCategory(u.id, { sortOrder: u.sortOrder }).subscribe({
        next: () => {
          done += 1;
          if (done === pending) {
            this.successMessage = 'Display order saved.';
          }
        },
        error: (err) => {
          this.errorMessage = err.error?.message || 'Failed to save display order';
          this.loadCategories();
        },
      });
    }
  }

  // ---- form ----

  openAdd(): void {
    this.editingId = null;
    this.form = emptyForm();
    this.errorMessage = '';
    this.successMessage = '';
    this.showForm = true;
  }

  openAddWithParent(parentName: string): void {
    this.openAdd();
    this.form.parentCategory = parentName;
  }

  openEdit(category: Category): void {
    this.editingId = category._id;
    this.form = {
      name: category.name,
      slug: category.slug,
      description: category.description ?? '',
      image: category.image ?? '',
      icon: category.icon ?? '',
      sortOrder: category.sortOrder ?? 0,
      isActive: category.isActive ?? true,
      parentCategory: category.parentCategory ?? '',
    };
    this.errorMessage = '';
    this.successMessage = '';
    this.showForm = true;
  }

  get editingSectionName(): string {
    if (!this.editingId) return '';
    const editing = this.categories.find((c) => c._id === this.editingId);
    return editing && this.hasChildren(editing.name) ? editing.name : '';
  }

  closeForm(): void {
    this.showForm = false;
    this.editingId = null;
  }

  slugify(value: string): void {
    this.form.slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
  }

  saveCategory(): void {
    this.errorMessage = '';
    this.successMessage = '';
    const payload = {
      name: this.form.name.trim(),
      slug: this.form.slug.trim() || this.form.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''),
      description: this.form.description.trim(),
      image: this.form.image.trim(),
      icon: this.form.icon.trim(),
      sortOrder: this.form.sortOrder,
      isActive: this.form.isActive,
      parentCategory: this.form.parentCategory,
    };

    const request$ = this.editingId
      ? this.productService.updateCategory(this.editingId, payload)
      : this.productService.createCategory(payload);

    request$.subscribe({
      next: () => {
        this.successMessage = this.editingId ? 'Category updated successfully!' : 'Category added successfully!';
        this.showForm = false;
        this.editingId = null;
        this.loadCategories();
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Failed to save category';
      },
    });
  }

  deleteCategory(category: Category): void {
    const count = this.categoryProductCount(category);
    const children = this.hasChildren(category.name);
    let warn: string;
    if (children) {
      warn = `"${category.name}" is a section with ${this.childrenOf(category.name).length} sub-categor${this.childrenOf(category.name).length === 1 ? 'y' : 'ies'}. Deleting it will remove the section entry (its sub-categories will keep their parent name but no longer be linked). Delete anyway?`;
    } else if (count > 0) {
      warn = `"${category.name}" has ${count} product(s) linked to it. They will keep their category name but the category entry will be removed. Delete anyway?`;
    } else {
      warn = `Are you sure you want to delete "${category.name}"?`;
    }
    if (!confirm(warn)) return;
    this.productService.deleteCategory(category._id).subscribe({
      next: () => {
        this.successMessage = 'Category deleted successfully!';
        this.loadCategories();
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Failed to delete category';
      },
    });
  }
}