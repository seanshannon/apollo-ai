
'use client';

/**
 * ARIA Live Region for screen reader announcements - WCAG 4.1.3
 * Announces dynamic content changes to screen reader users
 */
export function AriaLiveAnnouncer() {
  return (
    <>
      {/* Polite announcements (non-urgent) */}
      <div
        id="aria-live-announcer"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />
      
      {/* Assertive announcements (urgent) */}
      <div
        id="aria-live-announcer-assertive"
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      />
    </>
  );
}
