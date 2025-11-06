
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

interface WelcomeEmailProps {
  firstName: string
  email: string
  organizationName: string
  dashboardUrl: string
}

export async function sendWelcomeEmail({
  firstName,
  email,
  organizationName,
  dashboardUrl,
}: WelcomeEmailProps) {
  try {
    // Check if API key is configured
    if (!process.env.RESEND_API_KEY) {
      console.warn('RESEND_API_KEY not configured - skipping welcome email')
      return { success: false, error: 'API key not configured' }
    }

    console.log(`Attempting to send welcome email to ${email}...`)
    
    const { data, error } = await resend.emails.send({
      from: 'Picard.ai <onboarding@resend.dev>',
      to: [email],
      subject: 'Welcome to Picard.ai - Your NLP Database Assistant',
      html: getWelcomeEmailHTML({ firstName, email, organizationName, dashboardUrl }),
    })

    if (error) {
      // Log the error but don't fail signup
      // This allows the app to work even with Resend free tier limitations
      console.error(`❌ Welcome email not sent to ${email}:`, error)
      return { success: false, error }
    }

    console.log(`✅ Welcome email sent successfully to ${email}`)
    return { success: true, data }
  } catch (error) {
    // Log but don't throw - email is not critical for signup
    console.error('❌ Email service error:', error)
    return { success: false, error }
  }
}

function getWelcomeEmailHTML({
  firstName,
  email,
  organizationName,
  dashboardUrl,
}: WelcomeEmailProps): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Picard.ai</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a; color: #e5e5e5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; overflow: hidden; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);">
          
          <!-- Header with Brand -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center;">
              <h1 style="margin: 0; font-size: 36px; font-weight: 700; color: #ffffff; letter-spacing: 2px;">
                PICARD.AI
              </h1>
              <p style="margin: 10px 0 0 0; font-size: 14px; color: rgba(255, 255, 255, 0.9); text-transform: uppercase; letter-spacing: 3px;">
                Intelligent Database Assistant
              </p>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px 0; font-size: 28px; font-weight: 600; color: #ffffff;">
                Welcome aboard, ${firstName}! 🚀
              </h2>
              
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #b8b8b8;">
                Your account has been successfully created. You're now ready to unlock the power of natural language database querying.
              </p>
              
              <!-- Account Details Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: rgba(102, 126, 234, 0.1); border-radius: 8px; border-left: 4px solid #667eea; margin: 30px 0;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #667eea; text-transform: uppercase; letter-spacing: 1px;">
                      Your Account Details
                    </p>
                    <p style="margin: 0 0 8px 0; font-size: 15px; color: #e5e5e5;">
                      <strong>Email:</strong> ${email}
                    </p>
                    <p style="margin: 0; font-size: 15px; color: #e5e5e5;">
                      <strong>Workspace:</strong> ${organizationName}
                    </p>
                  </td>
                </tr>
              </table>
              
              <!-- Quick Start Guide -->
              <h3 style="margin: 30px 0 15px 0; font-size: 20px; font-weight: 600; color: #ffffff;">
                Quick Start Guide
              </h3>
              
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 30px;">
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
                    <span style="display: inline-block; width: 28px; height: 28px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; text-align: center; line-height: 28px; font-weight: 700; color: #ffffff; margin-right: 12px;">1</span>
                    <span style="font-size: 15px; color: #e5e5e5;">Connect your databases (PostgreSQL, MySQL, Oracle)</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
                    <span style="display: inline-block; width: 28px; height: 28px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; text-align: center; line-height: 28px; font-weight: 700; color: #ffffff; margin-right: 12px;">2</span>
                    <span style="font-size: 15px; color: #e5e5e5;">Ask questions in natural language</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0;">
                    <span style="display: inline-block; width: 28px; height: 28px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; text-align: center; line-height: 28px; font-weight: 700; color: #ffffff; margin-right: 12px;">3</span>
                    <span style="font-size: 15px; color: #e5e5e5;">Get instant insights with visualizations</span>
                  </td>
                </tr>
              </table>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${dashboardUrl}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; letter-spacing: 0.5px; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
                      Go to Dashboard →
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 30px 0 0 0; font-size: 14px; line-height: 1.6; color: #8b8b8b;">
                Need help getting started? Check out our documentation or reach out to our support team.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: rgba(0, 0, 0, 0.3); padding: 30px; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.05);">
              <p style="margin: 0 0 10px 0; font-size: 13px; color: #8b8b8b;">
                © ${new Date().getFullYear()} Picard.ai. All rights reserved.
              </p>
              <p style="margin: 0; font-size: 12px; color: #666; font-family: 'Courier New', monospace; letter-spacing: 1px;">
                Compiled in Sector DTX - 214  with 🤖❤️ • MMXXV
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `
}
