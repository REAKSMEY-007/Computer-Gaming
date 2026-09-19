import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Product {
  _id: string;
  name: string;
  slug?: string;
  description: string;
  price: number;
  discount?: number;
  discountPrice?: number;
  category: string;
  categoryId?: string;
  categorySlug?: string;
  brand: string;
  stock: number;
  image: string;
  images?: string[];
  rating?: number;
  numReviews?: number;
  tags?: string[];
  specs?: Record<string, string>;
  specifications?: Record<string, unknown>;
  isFeatured?: boolean;
  isTopSelling?: boolean;
  isActive?: boolean;
  warranty?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Category {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  icon?: string;
  isActive?: boolean;
  sortOrder?: number;
  parentCategory?: string;
}

export interface BuildIssue {
  components: string[];
  message: string;
}

export interface BuildValidation {
  compatible: boolean;
  issues: BuildIssue[];
  totalPrice: number;
  selectedComponents: Record<string, Product>;
}

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private apiUrl = 'http://localhost:3000/api/products';
  private categoryUrl = 'http://localhost:3000/api/categories';

  constructor(private http: HttpClient) {}

  getAllProducts(): Observable<Product[]> {
    return this.http.get<any>(this.apiUrl).pipe(map((res) => res?.products ?? res));
  }

  getProductsPaginated(params: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    brand?: string;
    sort?: string;
    deals?: boolean;
    minPrice?: number;
    maxPrice?: number;
    inStock?: boolean;
    includeInactive?: boolean;
  } = {}): Observable<{ products: Product[]; total: number; page: number; limit: number }> {
    const query: Record<string, string> = {};
    if (params.page != null) query['page'] = String(params.page);
    if (params.limit != null) query['limit'] = String(params.limit);
    if (params.search) query['q'] = params.search;
    if (params.category) query['category'] = params.category;
    if (params.brand) query['brand'] = params.brand;
    if (params.sort) query['sort'] = params.sort;
    if (params.deals) query['deals'] = 'true';
    if (params.minPrice != null) query['minPrice'] = String(params.minPrice);
    if (params.maxPrice != null) query['maxPrice'] = String(params.maxPrice);
    if (params.inStock) query['inStock'] = 'true';
    if (params.includeInactive != null) query['includeInactive'] = String(params.includeInactive);
    const httpParams = new HttpParams({ fromObject: query });
    return this.http.get<any>(this.apiUrl, { params: httpParams });
  }

  getFeaturedProducts(): Observable<Product[]> {
    return this.http.get<any>(`${this.apiUrl}/featured`).pipe(map((res) => res?.products ?? res));
  }

  getTopSellingProducts(): Observable<Product[]> {
    return this.http.get<any>(`${this.apiUrl}/top-selling`).pipe(map((res) => res?.products ?? res));
  }

  getDealProducts(): Observable<Product[]> {
    return this.http.get<any>(`${this.apiUrl}/deals`).pipe(map((res) => res?.products ?? res));
  }

  getCategories(): Observable<Category[]> {
    return this.http.get<any>(this.categoryUrl).pipe(map((res) => res?.categories ?? res));
  }

  getCategoriesWithMeta(): Observable<{ categories: Category[] }> {
    return this.http.get<any>(this.categoryUrl);
  }

  createCategory(category: Omit<Category, '_id'>): Observable<Category> {
    return this.http.post<Category>(this.categoryUrl, category);
  }

  updateCategory(id: string, category: Partial<Category>): Observable<Category> {
    return this.http.put<Category>(`${this.categoryUrl}/${id}`, category);
  }

  deleteCategory(id: string): Observable<any> {
    return this.http.delete(`${this.categoryUrl}/${id}`);
  }

  getProductById(id: string): Observable<Product> {
    return this.http.get<Product>(`${this.apiUrl}/${id}`);
  }

  getProductBySlug(slug: string): Observable<Product> {
    return this.http.get<Product>(`${this.apiUrl}/slug/${slug}`);
  }

  createProduct(product: FormData | Omit<Product, '_id'>): Observable<Product> {
    return this.http.post<Product>(this.apiUrl, product);
  }

  updateProduct(id: string, product: FormData | Partial<Product>): Observable<Product> {
    return this.http.put<Product>(`${this.apiUrl}/${id}`, product);
  }

  deleteProduct(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  validatePcBuild(selection: {
    cpuId?: string | null;
    motherboardId?: string | null;
    ramId?: string | null;
    gpuId?: string | null;
    psuId?: string | null;
    caseId?: string | null;
    coolingId?: string | null;
  }): Observable<BuildValidation> {
    const body: Record<string, string | null> = {
      cpuId: selection.cpuId ?? null,
      motherboardId: selection.motherboardId ?? null,
      ramId: selection.ramId ?? null,
      gpuId: selection.gpuId ?? null,
      psuId: selection.psuId ?? null,
      caseId: selection.caseId ?? null,
      coolingId: selection.coolingId ?? null,
    };
    return this.http.post<BuildValidation>('http://localhost:3000/api/build-pc/validate', body);
  }
}
