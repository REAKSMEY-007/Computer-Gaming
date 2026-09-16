import { Pipe, PipeTransform } from '@angular/core';

export function formatNumber(value: number | null | undefined, fractionDigits = 2): string {
  const n = Number(value ?? 0);
  if (Number.isNaN(n)) return (0).toFixed(fractionDigits);
  return n.toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

@Pipe({
  name: 'price',
  standalone: true,
})
export class PricePipe implements PipeTransform {
  transform(value: number | null | undefined, fractionDigits = 2): string {
    return formatNumber(value, fractionDigits);
  }
}