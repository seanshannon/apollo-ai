
'use client';

/**
 * Skip links for keyboard navigation - WCAG 2.4.1
 * Allows keyboard users to skip repetitive content
 */
export function SkipLinks() {
  return (
    <div className="sr-only focus-within:not-sr-only">
      <a
        href="#main-content"
        className="fixed top-0 left-0 z-[9999] bg-terminal-green text-black px-4 py-2 font-bold 
                   focus:outline-none focus:ring-4 focus:ring-terminal-green/50 
                   transform -translate-y-full focus:translate-y-0 transition-transform
                   font-orbitron tracking-wider"
      >
        Skip to main content
      </a>
      <a
        href="#database-selector"
        className="fixed top-0 left-40 z-[9999] bg-terminal-green text-black px-4 py-2 font-bold 
                   focus:outline-none focus:ring-4 focus:ring-terminal-green/50 
                   transform -translate-y-full focus:translate-y-0 transition-transform
                   font-orbitron tracking-wider"
      >
        Skip to database selector
      </a>
      <a
        href="#query-input"
        className="fixed top-0 left-80 z-[9999] bg-terminal-green text-black px-4 py-2 font-bold 
                   focus:outline-none focus:ring-4 focus:ring-terminal-green/50 
                   transform -translate-y-full focus:translate-y-0 transition-transform
                   font-orbitron tracking-wider"
      >
        Skip to query input
      </a>
    </div>
  );
}
