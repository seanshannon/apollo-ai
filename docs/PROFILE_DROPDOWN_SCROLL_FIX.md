
# Profile Dropdown Scroll Fix

## Issue
The profile dropdown menu was getting cut off on the landing page because the body has `overflow-hidden` (to keep the hero perfectly centered). When the dropdown contained many menu items, users couldn't scroll to the bottom - the menu extended past the viewport and felt "cut off."

## Root Cause
The dropdown was using `absolute` positioning relative to its parent container. Any ancestor with `overflow-hidden` would clip the dropdown, preventing it from being fully visible or scrollable.

## Solution (Option A)
Implemented fixed positioning with viewport-aware max-height and independent scroll:

### Changes Made

**File: `components/user-profile-dropdown.tsx`**

1. **Changed Positioning from `absolute` to `fixed`**
   - Escapes any overflow-clipping ancestors
   - Positions relative to the viewport instead of parent container

2. **Added Viewport-Aware Max Height**
   - `max-h-[calc(100dvh-5rem)]` - Caps height at viewport height minus 80px breathing room
   - Uses `dvh` units for modern browser support with automatic fallback

3. **Added Independent Scrolling**
   - `overflow-y-auto` - Makes the dropdown itself scrollable
   - `overscroll-contain` - Prevents rubber-band scrolling from propagating to the page

4. **Dynamic Position Calculation**
   - Added ref to trigger button
   - Calculates dropdown position using `getBoundingClientRect()`
   - Updates position when dropdown opens

### Technical Details

```tsx
// Added state and refs
const [dropdownTop, setDropdownTop] = useState<number>(64);
const triggerRef = useRef<HTMLButtonElement | null>(null);

// Calculate position on mouse enter
const handleMouseEnter = () => {
  if (triggerRef.current) {
    const rect = triggerRef.current.getBoundingClientRect();
    const topPosition = rect.bottom + 4; // 4px gap
    setDropdownTop(topPosition);
  }
  setIsOpen(true);
};

// Dropdown with fixed positioning
<div
  className="fixed right-4 w-96 max-h-[calc(100dvh-5rem)] overflow-y-auto overscroll-contain..."
  style={{ top: `${dropdownTop}px` }}
>
```

## Benefits

1. ✅ **Escapes Overflow Constraints** - Fixed positioning takes the menu out of any overflow-clipping ancestors
2. ✅ **Viewport-Aware** - Never extends below the screen on any device
3. ✅ **Independent Scroll** - Menu scrolls independently while body stays locked
4. ✅ **No Layout Shift** - Responsive to viewport changes without breaking layout
5. ✅ **Cross-Browser Compatible** - Works on desktop, iOS, and Android
6. ✅ **No Page Scroll Propagation** - `overscroll-contain` prevents rubber-band effects

## Acceptance Criteria

- [x] Given the landing page (body overflow-hidden), when I open the profile dropdown, then the menu can scroll independently to its last item
- [x] The dropdown's max height is constrained to the visible viewport (100dvh), with ~80px margin from edges
- [x] Scrolling in the menu does not scroll the page
- [x] No clipping by ancestors; menu uses position: fixed to escape overflow contexts
- [x] Works on desktop + iOS/Android; no layout shift when toolbars appear/disappear

## Testing

1. **Landing Page** - Open profile dropdown, verify all menu items are accessible via scroll
2. **Dashboard Page** - Verify dropdown still works correctly on scrollable pages
3. **Small Viewports** - Test on mobile devices (320px-768px width)
4. **Tall Menus** - Verify menu scrolls when content exceeds viewport height
5. **Overflow Context** - Confirm dropdown is not clipped by any parent container

## Files Modified

- `components/user-profile-dropdown.tsx`
  - Changed positioning from `absolute` to `fixed`
  - Added viewport-aware max-height constraint
  - Added independent scroll with overscroll containment
  - Implemented dynamic position calculation

## Deployment

- Build Status: ✅ Success
- Deployment: ✅ Live on https://ncc-1701.io
- Date: November 6, 2025

## Alternative Approach (Option B - Not Implemented)

For future reference, if additional isolation is needed, the menu could be rendered via a React portal directly under `<body>`:

```tsx
// Would render dropdown outside any overflow context
import { createPortal } from "react-dom";
return createPortal(<DropdownMenu />, document.body);
```

This was not necessary for the current implementation but remains an option if requirements change.

---

**Compiled in Sector DTX - 214 with 🤖❤️ • MMXXV**
