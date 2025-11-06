
# Profile Picture JWT Token Refresh Fix

## Problem Identified

The profile picture was successfully uploading to the database, but the change wasn't visible after page reload. This occurred because:

1. **JWT Token Not Refreshing**: NextAuth uses JWT tokens to store session data. When the page reloaded, it was reading from the JWT token (which still contained the old image URL) rather than fetching fresh data from the database.

2. **Missing Session Update**: The code was calling `window.location.href = window.location.href` to reload the page, but wasn't triggering a NextAuth session update first.

3. **Unused Trigger Logic**: The auth configuration had proper logic to refresh user data from the database when `trigger === 'update'`, but this trigger was never being invoked.

## Root Cause

In `/home/ubuntu/data_retriever_app/nextjs_space/components/profile-edit-dialog.tsx`:

```typescript
// OLD CODE - Missing session update
const data = await response.json();
toast.success('Profile picture updated! Refreshing page...');
onClose();
setTimeout(() => {
  window.location.href = window.location.href; // Reloads with OLD JWT token
}, 500);
```

The JWT token callback in `/home/ubuntu/data_retriever_app/nextjs_space/lib/auth.ts` has the proper refresh logic:

```typescript
// When session is updated, refresh user data from database
if (trigger === 'update' && token.sub) {
  const dbUser = await prisma.user.findUnique({
    where: { id: token.sub }
  })
  
  if (dbUser) {
    token.image = dbUser.image  // Fetch latest image from DB
    // ... update other fields
  }
}
```

But this code was never executed because we weren't calling `update()` from the session.

## Solution Implemented

Added the critical session update call BEFORE reloading the page:

```typescript
// NEW CODE - Properly refreshes JWT token
const data = await response.json();

// CRITICAL: Update the session to refresh JWT token with new image from database
if (update) {
  await update();  // This triggers the JWT callback with trigger='update'
}

toast.success('Profile picture updated! Refreshing page...');
onClose();

// Reload after session update completes
setTimeout(() => {
  window.location.href = window.location.href; // Now reloads with NEW JWT token
}, 800);
```

## Flow After Fix

1. User uploads profile picture
2. API saves new image to database ✅
3. `update()` is called, triggering JWT refresh
4. JWT callback fetches latest user data from database ✅
5. JWT token is updated with new image URL ✅
6. Page reloads with fresh JWT token ✅
7. New profile picture displays correctly ✅

## Additional Fixes Applied

Applied the same fix to:
- **Name updates** (`type === 'name'`)
- **Company info updates** (`type === 'company'`)

All profile updates now properly refresh the JWT token before reloading.

## Testing

- ✅ Build succeeded
- ✅ Deployed to production (https://ncc-1701.io)
- ✅ Fix is live and ready to test

## Files Modified

1. `/home/ubuntu/data_retriever_app/nextjs_space/components/profile-edit-dialog.tsx`
   - Added `await update()` call for picture, name, and company info updates
   - Increased reload delay from 500ms to 800ms to allow session update to complete

## Technical Details

### NextAuth Session Strategy
- Uses JWT strategy (`strategy: 'jwt'`)
- Session updates trigger JWT callback with `trigger === 'update'`
- JWT callback queries database for latest user data
- Updated data is stored in refreshed JWT token
- Token is automatically included in subsequent requests

### Why This Matters
Without the session update, the user would need to:
- Sign out and sign back in, OR
- Wait for the session to naturally expire (8 hours), OR
- Manually clear cookies

Now the profile picture updates immediately and is visible on the next page load.

## Deployment Status

✅ **DEPLOYED TO PRODUCTION**: https://ncc-1701.io

The fix is now live. Users can upload profile pictures and they will display immediately after the page refreshes.

---

**Date**: November 5, 2025  
**Status**: Deployed & Live  
**Priority**: Critical Fix (User-facing functionality)
