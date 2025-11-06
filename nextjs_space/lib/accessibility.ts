
/**
 * Accessibility utilities for WCAG 2.2 Level AA compliance
 */

/**
 * Announce message to screen readers using ARIA live region
 */
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite') {
  if (typeof window === 'undefined') return;
  
  const liveRegion = document.getElementById('aria-live-announcer');
  if (liveRegion) {
    liveRegion.setAttribute('aria-live', priority);
    liveRegion.textContent = message;
    
    // Clear after a delay so subsequent identical messages are still announced
    setTimeout(() => {
      if (liveRegion.textContent === message) {
        liveRegion.textContent = '';
      }
    }, 1000);
  }
}

/**
 * Trap focus within a modal or dialog
 */
export function trapFocus(element: HTMLElement) {
  const focusableElements = element.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  
  const firstFocusable = focusableElements[0];
  const lastFocusable = focusableElements[focusableElements.length - 1];
  
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    
    if (e.shiftKey) {
      if (document.activeElement === firstFocusable) {
        e.preventDefault();
        lastFocusable?.focus();
      }
    } else {
      if (document.activeElement === lastFocusable) {
        e.preventDefault();
        firstFocusable?.focus();
      }
    }
  };
  
  element.addEventListener('keydown', handleKeyDown);
  
  return () => {
    element.removeEventListener('keydown', handleKeyDown);
  };
}

/**
 * Generate unique IDs for accessibility labels
 */
let idCounter = 0;
export function generateA11yId(prefix: string = 'a11y'): string {
  return `${prefix}-${++idCounter}`;
}

/**
 * Check if element is focusable
 */
export function isFocusable(element: HTMLElement): boolean {
  if (element.hasAttribute('disabled')) return false;
  if (element.getAttribute('tabindex') === '-1') return false;
  
  const tagName = element.tagName.toLowerCase();
  if (['button', 'a', 'input', 'select', 'textarea'].includes(tagName)) {
    return true;
  }
  
  return element.hasAttribute('tabindex') && element.getAttribute('tabindex') !== '-1';
}

/**
 * Get all focusable elements within a container
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selector = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
  return Array.from(container.querySelectorAll<HTMLElement>(selector));
}

/**
 * Restore focus to previously focused element
 */
export class FocusManager {
  private previouslyFocused: HTMLElement | null = null;
  
  saveFocus() {
    this.previouslyFocused = document.activeElement as HTMLElement;
  }
  
  restoreFocus() {
    if (this.previouslyFocused && typeof this.previouslyFocused.focus === 'function') {
      this.previouslyFocused.focus();
    }
  }
}

/**
 * ARIA live region priorities
 */
export const AriaLive = {
  POLITE: 'polite' as const,
  ASSERTIVE: 'assertive' as const,
  OFF: 'off' as const,
};

/**
 * Common ARIA roles
 */
export const AriaRoles = {
  MAIN: 'main' as const,
  NAVIGATION: 'navigation' as const,
  BANNER: 'banner' as const,
  CONTENTINFO: 'contentinfo' as const,
  COMPLEMENTARY: 'complementary' as const,
  SEARCH: 'search' as const,
  FORM: 'form' as const,
  REGION: 'region' as const,
  DIALOG: 'dialog' as const,
  ALERT: 'alert' as const,
  STATUS: 'status' as const,
};
