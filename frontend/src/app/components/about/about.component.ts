import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ShippingService } from '../../services/shipping.service';
import { RevealDirective } from '../../directives/reveal.directive';

type StatIcon = 'accuracy' | 'users' | 'support' | 'brands';

interface AboutStat {
  value: number;
  decimals: number;
  prefix: string;
  suffix: string;
  label: string;
  description: string;
  icon: StatIcon;
  tone: string;
  bar: string;
}

interface StatView extends AboutStat {
  display: string;
}

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [RouterLink, RevealDirective],
  templateUrl: './about.component.html',
})
export class AboutComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('statsGrid') statsGrid?: ElementRef<HTMLElement>;

  readonly stats: AboutStat[] = [
    {
      value: 99.8,
      decimals: 1,
      prefix: '',
      suffix: '%',
      label: 'Order Accuracy',
      description: 'Every order quality-checked before it leaves the bench.',
      icon: 'accuracy',
      tone: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300',
      bar: 'from-emerald-400 to-emerald-600',
    },
    {
      value: 2400,
      decimals: 0,
      prefix: '',
      suffix: '+',
      label: 'Happy Builders',
      description: 'Custom rigs assembled, tested and running strong.',
      icon: 'users',
      tone: 'bg-sky-100 text-sky-600 dark:bg-sky-500/20 dark:text-sky-300',
      bar: 'from-sky-400 to-sky-600',
    },
    {
      value: 24,
      decimals: 0,
      prefix: '',
      suffix: '/7',
      label: 'Expert Support',
      description: 'Real builders on the other end, whenever you need them.',
      icon: 'support',
      tone: 'bg-accent-100 text-accent-600 dark:bg-accent-500/20 dark:text-accent-300',
      bar: 'from-accent-400 to-accent-600',
    },
    {
      value: 15,
      decimals: 0,
      prefix: '',
      suffix: '+',
      label: 'Tech Brands',
      description: 'Trusted manufacturers vetted for reliability and value.',
      icon: 'brands',
      tone: 'bg-primary-100 text-primary-600 dark:bg-primary-500/20 dark:text-primary-300',
      bar: 'from-primary-400 to-primary-600',
    },
  ];

  displayStats: StatView[] = [];

  private observer?: IntersectionObserver;
  private rafId = 0;

  constructor(private shippingService: ShippingService) {}

  ngOnInit(): void {
    this.shippingService.load();
    this.displayStats = this.stats.map((s) => ({ ...s, display: this.format(0, s) }));
  }

  ngAfterViewInit(): void {
    const el = this.statsGrid?.nativeElement;
    if (!el || typeof IntersectionObserver === 'undefined') {
      this.finishStats();
      return;
    }
    this.observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          this.observer?.disconnect();
          this.observer = undefined;
          this.animateStats();
        }
      },
      { threshold: 0.25 }
    );
    this.observer.observe(el);
  }

  freeShippingText(): string {
    const cfg = this.shippingService.config;
    if (!cfg.enabled || cfg.freeShippingThreshold <= 0) return 'Free shipping on every order';
    return `Free shipping on orders over $${cfg.freeShippingThreshold}`;
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }

  private animateStats(): void {
    const duration = 1400;
    const startTime = performance.now();
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const step = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = easeOutCubic(progress);
      this.displayStats = this.stats.map((s) => ({
        ...s,
        display: this.format(s.value * eased, s),
      }));
      if (progress < 1) {
        this.rafId = requestAnimationFrame(step);
      } else {
        this.finishStats();
      }
    };

    this.rafId = requestAnimationFrame(step);
  }

  private finishStats(): void {
    this.displayStats = this.stats.map((s) => ({ ...s, display: this.format(s.value, s) }));
  }

  private format(value: number, stat: AboutStat): string {
    const number =
      stat.decimals > 0
        ? value.toFixed(stat.decimals)
        : Math.round(value).toLocaleString('en-US');
    return `${stat.prefix}${number}${stat.suffix}`;
  }
}
