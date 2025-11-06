# Profile Update Save Functionality - Fixed

## Issue
Profile changes (profile picture, username, company name, job title) were not being saved when users made edits through the dropdown menu.

## Root Causes Identified

### 1. Missing Database Fields
The `User` table was missing `companyName` and `jobTitle` fields.

### 2. Incomplete API Implementation
The `/api/user/profile` endpoint was not saving `companyName` and `jobTitle` to the database - they were only logged in the audit log.

### 3. Session Not Refreshing
The NextAuth session callbacks were not properly:
- Including all user fields (image, companyName, jobTitle) in the session
- Refreshing data from the database when `update()` was called

## Fixes Implemented

### 1. Database Schema Update
**File:** `prisma/schema.prisma`

Added two new optional fields to the User model:
```prisma
model User {
  // ... existing fields ...
  companyName     String?
  jobTitle        String?
  // ... rest of fields ...
}
```

Applied schema changes with:
```bash
yarn prisma db push
```

### 2. Profile API Endpoint Enhancement
**File:** `app/api/user/profile/route.ts`

Updated to save all profile fields:
```typescript
const updatedUser = await prisma.user.update({
  where: { id: session.user.id },
  data: {
    ...(firstName !== undefined && { firstName }),
    ...(lastName !== undefined && { lastName }),
    ...(companyName !== undefined && { companyName }),
    ...(jobTitle !== undefined && { jobTitle }),
    // ... name generation logic ...
  },
});
```

Updated response to include all fields:
```typescript
return NextResponse.json({ 
  success: true, 
  user: {
    id: updatedUser.id,
    firstName: updatedUser.firstName,
    lastName: updatedUser.lastName,
    name: updatedUser.name,
    email: updatedUser.email,
    companyName: updatedUser.companyName,
    jobTitle: updatedUser.jobTitle,
    image: updatedUser.image,
  }
});
```

### 3. NextAuth Session Management
**File:** `lib/auth.ts`

Enhanced JWT callback to:
- Include all user fields in token during initial login
- Detect when session is being updated (via `trigger === 'update'`)
- Fetch fresh data from database when session is updated

```typescript
async jwt({ token, user, account, profile, trigger }: any) {
  // Initial login - include all fields
  if (user) {
    token.role = user.role
    token.firstName = user.firstName
    token.lastName = user.lastName
    token.image = user.image
    token.companyName = user.companyName
    token.jobTitle = user.jobTitle
  }
  
  // Session update - refresh from database
  if (trigger === 'update' && token.sub) {
    const dbUser = await prisma.user.findUnique({
      where: { id: token.sub }
    })
    
    if (dbUser) {
      token.role = dbUser.role
      token.firstName = dbUser.firstName
      token.lastName = dbUser.lastName
      token.image = dbUser.image
      token.companyName = dbUser.companyName
      token.jobTitle = dbUser.jobTitle
      token.name = dbUser.name
    }
  }
  
  return token
}
```

Updated session callback to include all fields:
```typescript
async session({ session, token }: any) {
  if (session.user) {
    session.user.id = token.sub!
    session.user.role = token.role as string || 'USER'
    session.user.firstName = token.firstName as string
    session.user.lastName = token.lastName as string
    session.user.image = token.image as string
    session.user.companyName = token.companyName as string
    session.user.jobTitle = token.jobTitle as string
    session.user.name = token.name as string
  }
  return session
}
```

### 4. Profile Edit Dialog Improvements
**File:** `components/profile-edit-dialog.tsx`

- Added `defaultValue` props to company fields to show current values
- Added `await update()` call for company info updates to trigger session refresh
- Ensured all edit types properly refresh the session

```typescript
// Company fields now show current values
<Input
  id="companyName"
  placeholder="Enter company name"
  defaultValue={(session?.user as any)?.companyName || ''}
  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
  // ... styling ...
/>

// Company update now refreshes session
if (!response.ok) {
  throw new Error('Failed to update company info');
}

await update(); // Triggers session refresh
toast.success('Company information updated successfully!');
```

## How It Works Now

### Complete Update Flow

1. **User Opens Edit Dialog**
   - Current values are pre-populated from `session.user`
   - Dialog shows firstName, lastName, companyName, jobTitle, or uploads image

2. **User Makes Changes**
   - Form data is captured via `onChange` handlers
   - Preview shown for image uploads

3. **User Clicks "Save Changes"**
   - API request sent to appropriate endpoint
   - Database updated with new values
   - Success response returned

4. **Session Refresh**
   - Component calls `await update()` from `useSession()`
   - NextAuth triggers JWT callback with `trigger: 'update'`
   - Fresh user data fetched from database
   - Token updated with latest values
   - Session callback runs with updated token
   - React re-renders with new session data

5. **UI Updates**
   - User sees updated values immediately in dropdown
   - Toast notification confirms success
   - No page refresh required

## Testing Verification

The fix has been tested and verified to:

✅ Save profile picture changes to database  
✅ Save first name and last name changes  
✅ Save company name and job title changes  
✅ Update session immediately after save  
✅ Reflect changes in dropdown menu  
✅ Persist changes across page refreshes  
✅ Show current values when editing  
✅ Maintain audit logs for all changes  

## Files Modified

1. `prisma/schema.prisma` - Added companyName and jobTitle fields
2. `app/api/user/profile/route.ts` - Enhanced to save all profile fields
3. `lib/auth.ts` - Improved session refresh mechanism
4. `components/profile-edit-dialog.tsx` - Added session update and default values

## Deployment

Changes have been built and deployed to production:
- Database schema migrated successfully
- All API endpoints updated
- Session management enhanced
- Live at: https://ncc-1701.io

## Notes

- Profile changes are now instantly reflected in the UI
- No page refresh needed after edits
- All changes are audited for security compliance
- Session properly refreshes with latest database values
- Image uploads work correctly with base64 storage
