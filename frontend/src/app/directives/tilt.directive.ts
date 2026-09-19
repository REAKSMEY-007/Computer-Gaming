import { Directive, ElementRef, HostListener } from '@angular/core';

const MAX_TILT = 7;

/**
 * Cursor-tracked 3D tilt with a moving glare highlight and a depth shadow.
 * Writes --rx/--ry (rotate), --gx/--gy (glare origin) and --shadow-x/--shadow-y
 * onto the host; the global `.tilt-3d` styles in styles.css render them.
 *
 * Mouse + touch-safe: ignores non-mouse pointers and any drag in progress on an
 * ancestor scroller (`[dragging]`), and respects prefers-reduced-motion in CSS.
 *
 * Usage: <div class="…card…" [appTilt]>
 */
@Directive({
  selector: '[appTilt]',
  standalone: true,
})
export class TiltDirective {
  private readonly el: HTMLElement;

  constructor(el: ElementRef<HTMLElement>) {
    this.el = el.nativeElement;
    this.el.classList.add('tilt-3d');
  }

  @HostListener('pointermove', ['$event'])
  onMove(e: PointerEvent): void {
    if (e.pointerType !== 'mouse') return;
    if (this.el.closest('[dragging]')) return; // drag/scroll in progress

    const rect = this.el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const rx = (py - 0.5) * -2 * MAX_TILT;
    const ry = (px - 0.5) * 2 * MAX_TILT;

    this.el.style.setProperty('--rx', `${rx.toFixed(2)}deg`);
    this.el.style.setProperty('--ry', `${ry.toFixed(2)}deg`);
    this.el.style.setProperty('--gx', `${(px * 100).toFixed(1)}%`);
    this.el.style.setProperty('--gy', `${(py * 100).toFixed(1)}%`);
    this.el.style.setProperty('--shadow-x', `${((0.5 - px) * 14).toFixed(1)}px`);
    this.el.style.setProperty('--shadow-y', `${(10 + (0.5 - py) * 10).toFixed(1)}px`);
  }

  @HostListener('pointerleave')
  onLeave(): void {
    this.el.style.setProperty('--rx', '0deg');
    this.el.style.setProperty('--ry', '0deg');
    this.el.style.removeProperty('--gx');
    this.el.style.removeProperty('--gy');
    this.el.style.removeProperty('--shadow-x');
    this.el.style.removeProperty('--shadow-y');
  }
}