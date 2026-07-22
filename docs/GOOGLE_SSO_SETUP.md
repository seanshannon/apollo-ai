# Google SSO Setup Guide

## Overview
Google Single Sign-On (SSO) has been successfully integrated into Picard.ai, allowing users to authenticate using their Google accounts. This guide will walk you through obtaining the necessary credentials from Google Cloud Console.

## Current Status
✅ Google SSO code integration complete
✅ UI updated with Google sign-in button
✅ NextAuth configured with GoogleProvider
✅ Account linking enabled for existing users
⚠️ **Action Required**: Replace placeholder credentials with real Google OAuth credentials

## Why Google SSO?
- **Enhanced Security**: OAuth 2.0 protocol with Google's security infrastructure
- **Better User Experience**: One-click sign-in without password management
- **Account Linking**: Users can link their Google account to existing email/password accounts
- **Email Verification**: Automatic verification through Google's authentication

## Prerequisites
- A Google account
- Access to Google Cloud Console
- Admin access to your Picard.ai deployment

## Step-by-Step Setup Instructions

### Step 1: Access Google Cloud Console
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Sign in with your Google account
3. If you don't have a project, create one:
   - Click on the project dropdown at the top
   - Click "New Project"
   - Enter project name (e.g., "Picard AI Auth")
   - Click "Create"

### Step 2: Enable Google+ API (if required)
1. In the Google Cloud Console, navigate to "APIs & Services" > "Library"
2. Search for "Google+ API" or "Google Identity"
3. Click on it and click "Enable"

### Step 3: Configure OAuth Consent Screen
1. Navigate to "APIs & Services" > "OAuth consent screen"
2. Choose "External" user type (or "Internal" if using Google Workspace)
3. Click "Create"
4. Fill in the required information:
   - **App name**: Picard.ai
   - **User support email**: Your support email
   - **App logo**: Upload your Picard.ai logo (optional)
   - **Application home page**: https://ncc-1701.io
   - **Authorized domains**: ncc-1701.io
   - **Developer contact information**: Your email
5. Click "Save and Continue"
6. On the "Scopes" page, add the following scopes:
   - `userinfo.email`
   - `userinfo.profile`
   - `openid`
7. Click "Save and Continue"
8. Review and click "Back to Dashboard"

### Step 4: Create OAuth 2.0 Credentials
1. Navigate to "APIs & Services" > "Credentials"
2. Click "+ CREATE CREDENTIALS" at the top
3. Select "OAuth client ID"
4. Choose application type: "Web application"
5. Enter a name: "Picard.ai Web Client"
6. Add **Authorized JavaScript origins**:
   ```
   https://ncc-1701.io
   ```
7. Add **Authorized redirect URIs**:
   ```
   https://ncc-1701.io/api/auth/callback/google
   ```
   
   For local testing, also add:
   ```
   http://localhost:3000/api/auth/callback/google
   ```

8. Click "Create"
9. A dialog will appear with your credentials:
   - **Client ID**: Starts with something like `1234567890-abc123xyz.apps.googleusercontent.com`
   - **Client Secret**: A random string like `GOCSPX-abc123xyz`
10. **IMPORTANT**: Copy both values immediately - you'll need them in the next step

### Step 5: Update Environment Variables

Replace the placeholder values in your `.env` file:

**Current (Placeholder) values:**
```env
GOOGLE_CLIENT_ID=placeholder-google-client-id
GOOGLE_CLIENT_SECRET=placeholder-google-client-secret
```

**Update to (Your real values):**
```env
GOOGLE_CLIENT_ID=your-actual-client-id-from-google
GOOGLE_CLIENT_SECRET=your-actual-client-secret-from-google
```

### Step 6: Redeploy the Application

After updating the environment variables:

1. The application needs to be redeployed to pick up the new credentials
2. Use the Deploy button in the UI or contact your administrator
3. Once deployed, the Google SSO button will be fully functional

### Step 7: Test Google SSO

1. Navigate to https://ncc-1701.io
2. Click the "GOOGLE SSO" button on the login page
3. You should be redirected to Google's login page
4. Sign in with your Google account
5. Grant permissions when prompted
6. You should be redirected back to the dashboard

## Security Features

### Account Linking
- Users who previously signed up with email/password can link their Google account
- Linking is automatic when the same verified email is used
- This prevents duplicate accounts

### Email Verification
- Only verified Google emails are accepted
- Users with unverified emails will be denied access

### Audit Logging
- All Google SSO sign-ins are logged in the audit trail
- Includes timestamp, email, and success/failure status

## Troubleshooting

### Error: "Redirect URI Mismatch"
- **Cause**: The redirect URI in Google Console doesn't match your app's URL
- **Solution**: Ensure you added `https://ncc-1701.io/api/auth/callback/google` in Google Console

### Error: "Access Blocked: This app's request is invalid"
- **Cause**: OAuth consent screen not properly configured
- **Solution**: Complete all required fields in the OAuth consent screen setup

### Error: "Invalid Client ID or Secret"
- **Cause**: Placeholder values still in use or credentials copied incorrectly
- **Solution**: Double-check that you've updated the `.env` file with real credentials

### Google Login Button Not Working
- **Cause**: Credentials not properly loaded after update
- **Solution**: Redeploy the application to pick up new environment variables

## Important Notes

1. **Keep Credentials Secret**: Never commit real credentials to version control
2. **Regenerate If Compromised**: If credentials are exposed, regenerate them in Google Console
3. **Production vs Development**: Use separate OAuth clients for production and development environments
4. **User Data**: Only email and profile information are requested - no access to Google Drive, Calendar, etc.

## Technical Implementation Details

### What Was Implemented

1. **NextAuth Google Provider**: Added to `/lib/auth.ts`
   - Configured with proper authorization params
   - Includes refresh token support
   - Email verification enforced

2. **UI Updates**: Modified `/components/auth-page.tsx`
   - Added Google SSO button with proper styling
   - Matches existing Picard.ai terminal aesthetic
   - Only visible on login page (not signup)

3. **Account Linking**: Enabled `allowDangerousEmailAccountLinking`
   - Allows users to link Google account to existing email/password account
   - Only links accounts with same verified email

4. **Session Management**: JWT-based sessions
   - User role and profile stored in token
   - 8-hour session lifetime

5. **Audit Trail**: Automatic logging
   - Login attempts tracked
   - Provider information recorded

## Support

If you encounter issues during setup:
1. Verify all redirect URIs match exactly
2. Ensure OAuth consent screen is complete
3. Check that credentials are properly copied
4. Confirm application has been redeployed after updating credentials

For additional assistance, refer to:
- [NextAuth.js Google Provider Documentation](https://next-auth.js.org/providers/google)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)

---

**Status**: Google SSO integration complete, awaiting real credentials for activation.
