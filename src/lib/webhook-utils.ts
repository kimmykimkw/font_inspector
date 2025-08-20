/**
 * Webhook utility functions for n8n integration
 */

interface WebhookPayload {
  email: string;
}

/**
 * Send user email to n8n webhook when new user registers or requests access
 */
export async function sendNewUserWebhook(email: string): Promise<void> {
  const webhookUrl = 'https://n8n.srv902870.hstgr.cloud/webhook/new-user-alert';
  
  const payload: WebhookPayload = {
    email: email
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.warn(`Webhook notification failed: ${response.status} ${response.statusText}`);
    } else {
      console.log(`Successfully sent webhook notification for email: ${email}`);
    }
  } catch (error) {
    console.error('Error sending webhook notification:', error);
    // Don't throw the error to avoid breaking the main flow
  }
}
