import {
  Directive,
  ElementRef,
  Input,
  OnDestroy,
  OnInit,
} from '@angular/core';

export type RevealDirection = 'up' | 'left' | 'right' | 'zoom' | 'fade';

const VALID_DIRECTIONS: RevealDirection[] = ['up', 'left', 'right', 'zoom', 'fade'];

/**
 * Scroll-triggered reveal. Adds the `.reveal`/`.reveal-<dir>` initial state in
 * ngOnInit (before first paint) and flips to `.reveal-visible` once the element
 * intersects the viewport. Uses IntersectionObserver — no scroll listeners.
 *
 * Usage:
 *   <div appReveal>                       fade-up entrance
 *   <div appReveal="left" [revealDelay]="$index * 40">
 */
@Directive({
  selector: '[appReveal]',
  standalone: true,
})
export class RevealDirective implements OnInit, OnDestroy {
  @Input() appReveal: RevealDirection = 'up';
  @Input() revealDelay = 0;

  private observer?: IntersectionObserver;
  private readonly el: HTMLElement;

  constructor(el: ElementRef<HTMLElement>) {
    this.el = el.nativeElement;
  }

  ngOnInit(): void {
    const direction = VALID_DIRECTIONS.includes(this.appReveal)
      ? this.appReveal
      : 'up';

    this.el.classList.add('reveal', `reveal-${direction}`);
    if (this.revealDelay > 0) {
      this.el.style.transitionDelay = `${this.revealDelay}ms`;
    }

    if (typeof IntersectionObserver === 'undefined') {
      this.el.classList.add('reveal-visible');
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            this.reveal();
            return;
          }
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -36px 0px' }
    );
    this.observer.observe(this.el);
  }

  private reveal(): void {
    this.el.classList.add('reveal-visible');
    this.observer?.disconnect();
    // Drop the inline delay once the entrance has finished so it can't skew
    // later hover/transition timing on this element.
    if (this.revealDelay > 0) {
      window.setTimeout(() => {
        this.el.style.transitionDelay = '';
      }, this.revealDelay + 750);
    }
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}