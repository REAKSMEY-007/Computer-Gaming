import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { ProductService, Product, Category } from '../../services/product.service';
import { PricePipe } from '../../pipes/price.pipe';
import { AbsoluteUrlPipe } from '../../pipes/absolute-url.pipe';

interface ProductForm {
  name: string;
  description: string;
  price: number | null;
  brand: string;
  category: string;
  stock: number | null;
  discount: number | null;
  image: string;
  imageFile: File | null;
  imagePreview: string;
  tags: string;
  isFeatured: boolean;
  isTopSelling: boolean;
  isActive: boolean;
}

const emptyForm = (): ProductForm => ({
  name: '',
  description: '',
  price: null,
  brand: '',
  category: '',
  stock: null,
  discount: null,
  image: '',
  imageFile: null,
  imagePreview: '',
  tags: '',
  isFeatured: false,
  isTopSelling: false,
  isActive: true,
});

@Component({
  selector: 'app-admin-products',
  standalone: true,
  imports: [CommonModule, FormsModule, PricePipe, AbsoluteUrlPipe],
  templateUrl: './admin-products.component.html',
})
export class AdminProductsComponent implements OnInit {
  products: Product[] = [];
  categories: Category[] = [];
  total = 0;
  page = 1;
  limit = 10;
  searchQuery = '';
  categoryFilter = '';
  sortFilter = 'newest';
  loading = true;
  errorMessage = '';
  successMessage = '';

  showForm = false;
  editingId: string | null = null;
  form: ProductForm = emptyForm();
  pageSizeOptions = [10, 20, 50];
  private search$ = new Subject<string>();

  constructor(private productService: ProductService, private route: ActivatedRoute) {}

  ngOnInit(): void {
    const q = this.route.snapshot.queryParamMap.get('q');
    if (q) this.searchQuery = q;
    this.loadCategories();
    this.loadProducts();
    this.search$.pipe(debounceTime(300), distinctUntilChanged()).subscribe(() => {
      this.page = 1;
      this.loadProducts();
    });
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.total / this.limit));
  }

  get filteredCategoryNames(): string[] {
    const leafNames = new Set(
      this.categories.filter((c) => !!c.parentCategory).map((c) => c.name)
    );
    for (const p of this.products) {
      if (leafNames.has(p.category)) continue;
      const match = this.categories.find((c) => c.name === p.category && !c.parentCategory);
      if (!match) leafNames.add(p.category);
    }
    return [...leafNames].sort();
  }

  loadProducts(): void {
    this.loading = true;
    this.errorMessage = '';
    this.productService
      .getProductsPaginated({
        page: this.page,
        limit: this.limit,
        search: this.searchQuery || undefined,
        category: this.categoryFilter || undefined,
        sort: this.sortFilter || undefined,
        includeInactive: true,
      })
      .subscribe({
        next: (data) => {
          this.products = data.products;
          this.total = data.total;
          this.loading = false;
        },
        error: (err) => {
          this.errorMessage = err.error?.message || 'Failed to load products';
          this.loading = false;
        },
      });
  }

  loadCategories(): void {
    this.productService.getCategories().subscribe({
      next: (data) => (this.categories = data),
      error: () => {},
    });
  }

  onSearchChange(value: string): void {
    this.searchQuery = value;
    this.search$.next(value);
  }

  onFilterChange(): void {
    this.page = 1;
    this.loadProducts();
  }

  setPage(p: number): void {
    if (p < 1 || p > this.totalPages || p === this.page) return;
    this.page = p;
    this.loadProducts();
  }

  openAdd(): void {
    this.editingId = null;
    this.form = emptyForm();
    this.errorMessage = '';
    this.showForm = true;
  }

  openEdit(product: Product): void {
    this.editingId = product._id;
    this.form = {
      name: product.name,
      description: product.description,
      price: product.price ?? null,
      brand: product.brand,
      category: product.category,
      stock: product.stock ?? null,
      discount: product.discount ?? null,
      image: product.image,
      imageFile: null,
      imagePreview: product.image,
      tags: (product.tags ?? []).join(', '),
      isFeatured: !!product.isFeatured,
      isTopSelling: !!product.isTopSelling,
      isActive: product.isActive ?? true,
    };
    this.errorMessage = '';
    this.showForm = true;
  }

  closeForm(): void {
    this.showForm = false;
    this.editingId = null;
    this.form = emptyForm();
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      this.form.imageFile = null;
      return;
    }
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      this.errorMessage = 'Only JPG, PNG or WEBP images are allowed.';
      input.value = '';
      this.form.imageFile = null;
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.errorMessage = 'Image must be 5MB or smaller.';
      input.value = '';
      this.form.imageFile = null;
      return;
    }
    this.form.imageFile = file;
    this.errorMessage = '';
    const reader = new FileReader();
    reader.onload = () => {
      this.form.imagePreview = String(reader.result);
    };
    reader.readAsDataURL(file);
  }

  saveProduct(): void {
    this.errorMessage = '';
    this.successMessage = '';
    const name = this.form.name.trim();
    const description = this.form.description.trim();
    const brand = this.form.brand.trim();
    const category = this.form.category.trim();
    if (!name) {
      this.errorMessage = 'Please enter a product name.';
      return;
    }
    if (!description) {
      this.errorMessage = 'Please enter a product description.';
      return;
    }
    if (!brand) {
      this.errorMessage = 'Please enter a brand.';
      return;
    }
    if (!category) {
      this.errorMessage = 'Please enter a category.';
      return;
    }
    if (this.form.price === null || this.form.price === undefined) {
      this.errorMessage = 'Please enter a price.';
      return;
    }
    if (this.form.price < 0) {
      this.errorMessage = 'Price cannot be negative.';
      return;
    }
    if (this.form.stock === null || this.form.stock === undefined) {
      this.errorMessage = 'Please enter a stock quantity.';
      return;
    }
    if (this.form.stock < 0) {
      this.errorMessage = 'Stock cannot be negative.';
      return;
    }
    if (!this.form.imageFile && !this.editingId) {
      this.errorMessage = 'Please choose a product image to upload.';
      return;
    }

    let payload: FormData | Omit<Product, '_id'>;

    if (this.form.imageFile) {
      const data = new FormData();
      data.append('image', this.form.imageFile);
      data.append('name', name);
      data.append('description', description);
      data.append('price', String(this.form.price ?? 0));
      data.append('brand', brand);
      data.append('category', category);
      data.append('stock', String(this.form.stock ?? 0));
      data.append('discount', String(this.form.discount ?? 0));
      data.append('tags', this.form.tags);
      data.append('isFeatured', String(this.form.isFeatured));
      data.append('isTopSelling', String(this.form.isTopSelling));
      data.append('isActive', String(this.form.isActive));
      payload = data;
    } else {
      payload = {
        name,
        description,
        price: this.form.price ?? 0,
        brand,
        category,
        stock: this.form.stock ?? 0,
        discount: this.form.discount ?? 0,
        image: this.form.image.trim(),
        tags: this.form.tags.split(',').map((t) => t.trim()).filter(Boolean),
        isFeatured: this.form.isFeatured,
        isTopSelling: this.form.isTopSelling,
        isActive: this.form.isActive,
      };
    }

    const request$ = this.editingId
      ? this.productService.updateProduct(this.editingId, payload)
      : this.productService.createProduct(payload);

    request$.subscribe({
      next: () => {
        this.successMessage = this.editingId ? 'Product updated successfully!' : 'Product added successfully!';
        this.showForm = false;
        this.editingId = null;
        this.form = emptyForm();
        this.loadProducts();
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Failed to save product';
      },
    });
  }

  buildSpecs(product: Product): { label: string; value: string }[] {
    if (!product.specs) return [];
    return Object.entries(product.specs).slice(0, 4).map(([k, v]) => ({ label: k, value: v }));
  }

  effectivePrice(product: Product): number {
    return product.discountPrice ?? product.price;
  }

  hasDiscount(product: Product): boolean {
    return (product.discount ?? 0) > 0;
  }

  deleteProduct(product: Product): void {
    if (!confirm(`Are you sure you want to delete "${product.name}"? This cannot be undone.`)) return;
    this.productService.deleteProduct(product._id).subscribe({
      next: () => {
        this.successMessage = 'Product deleted successfully!';
        const needsBack = this.products.length === 1 && this.page > 1;
        if (needsBack) this.page -= 1;
        this.loadProducts();
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Failed to delete product';
      },
    });
  }

  itemNumber(index: number): number {
    return (this.page - 1) * this.limit + index + 1;
  }

  pageEnd(): number {
    return Math.min(this.page * this.limit, this.total);
  }
}