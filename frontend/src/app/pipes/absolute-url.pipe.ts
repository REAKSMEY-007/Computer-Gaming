import { Pipe, PipeTransform } from '@angular/core';
import { environment } from '../../environments/environment';

/** Resolves a possibly-relative media path to an absolute URL for the API host. */
export function resolveMediaUrl(value: string | null | undefined): string {
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  if (/^(data|blob):/i.test(value)) return value;
  if (value.startsWith('/') || value.startsWith('uploads/')) {
    const path = value.startsWith('/') ? value : `/${value}`;
    return `${environment.apiHost}${path}`;
  }
  return value;
}

@Pipe({
  name: 'absoluteUrl',
  standalone: true,
})
export class AbsoluteUrlPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return resolveMediaUrl(value);
  }
}