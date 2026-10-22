import { useEffect } from 'react';

/**
 * Lightweight hook that attaches an IntersectionObserver to elements matching selector.
 * Elements with .reveal-on-scroll will gain .is-revealed once in view.
 * Respects 'prefers-reduced-motion: reduce'.
 */
export function useScrollAnimation(triggerDependency?: unknown): void {
  useEffect(() => {
    // If user prefers reduced motion, reveal everything immediately
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    const elements = document.querySelectorAll<HTMLElement>('.reveal-on-scroll');

    if (prefersReducedMotion || typeof IntersectionObserver === 'undefined') {
      elements.forEach((el) => {
        el.classList.add('is-revealed');
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      {
        rootMargin: '0px 0px -40px 0px',
        threshold: 0.1,
      }
    );

    elements.forEach((el) => {
      // If already revealed or above the fold, handle gracefully
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        el.classList.add('is-revealed');
      } else {
        observer.observe(el);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [triggerDependency]);
}
