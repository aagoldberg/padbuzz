import { Resend } from 'resend';
import twilio from 'twilio';
import { Apartment, AIAnalysis, Subscriber } from '@/types/apartment';

function getResendClient() {
  if (!process.env.RESEND_API_KEY) {
    return null;
  }
  return new Resend(process.env.RESEND_API_KEY);
}

function getTwilioClient() {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    return null;
  }
  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

export async function sendDealAlert(
  subscriber: Subscriber,
  apartment: Apartment,
  analysis: AIAnalysis,
  dealScore: number
): Promise<{ email: boolean; sms: boolean }> {
  const results = { email: false, sms: false };

  if (subscriber.notificationSettings.email && subscriber.email) {
    results.email = await sendEmailAlert(subscriber.email, apartment, analysis, dealScore);
  }

  if (subscriber.notificationSettings.sms && subscriber.phone) {
    results.sms = await sendSmsAlert(subscriber.phone, apartment, analysis, dealScore);
  }

  return results;
}

async function sendEmailAlert(
  email: string,
  apartment: Apartment,
  analysis: AIAnalysis,
  dealScore: number
): Promise<boolean> {
  const resend = getResendClient();
  if (!resend) {
    console.error('Resend not configured');
    return false;
  }

  const fromEmail = process.env.FROM_EMAIL || 'alerts@padbuzz.com';

  try {
    await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: `Hot Deal Alert: ${apartment.bedrooms}BR in ${apartment.neighborhood} - $${apartment.price}/mo`,
      html: generateEmailHtml(apartment, analysis, dealScore),
    });
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

async function sendSmsAlert(
  phone: string,
  apartment: Apartment,
  analysis: AIAnalysis,
  dealScore: number
): Promise<boolean> {
  const twilioClient = getTwilioClient();
  const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

  if (!twilioClient || !twilioPhone) {
    console.error('Twilio not configured');
    return false;
  }

  try {
    const message = generateSmsMessage(apartment, analysis, dealScore);
    await twilioClient.messages.create({
      body: message,
      from: twilioPhone,
      to: phone,
    });
    return true;
  } catch (error) {
    console.error('Error sending SMS:', error);
    return false;
  }
}

function generateEmailHtml(
  apartment: Apartment,
  analysis: AIAnalysis,
  dealScore: number
): string {
  const dealBadge = dealScore >= 90
    ? '🔥 EXCEPTIONAL DEAL'
    : dealScore >= 80
    ? '⭐ GREAT DEAL'
    : '✨ GOOD DEAL';

  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0; }
    .badge { background: #ffd700; color: #333; padding: 5px 15px; border-radius: 20px; font-weight: bold; display: inline-block; }
    .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 10px 10px; }
    .price { font-size: 28px; font-weight: bold; color: #667eea; }
    .details { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin: 15px 0; }
    .detail-item { background: white; padding: 10px; border-radius: 5px; }
    .pros { color: #22c55e; }
    .cons { color: #ef4444; }
    .cta { background: #667eea; color: white; padding: 15px 30px; border-radius: 5px; text-decoration: none; display: inline-block; margin-top: 15px; }
    .score { font-size: 48px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <span class="badge">${dealBadge}</span>
      <h1 style="margin: 15px 0 5px 0;">${apartment.address}</h1>
      <p style="margin: 0; opacity: 0.9;">${apartment.neighborhood}, ${apartment.borough}</p>
    </div>
    <div class="content">
      <div class="price">$${apartment.price.toLocaleString()}/month</div>

      <div class="details">
        <div class="detail-item">🛏️ ${apartment.bedrooms} Bedroom${apartment.bedrooms !== 1 ? 's' : ''}</div>
        <div class="detail-item">🚿 ${apartment.bathrooms} Bathroom${apartment.bathrooms !== 1 ? 's' : ''}</div>
        ${apartment.sqft ? `<div class="detail-item">📐 ${apartment.sqft} sq ft</div>` : ''}
        ${apartment.noFee ? '<div class="detail-item">✅ No Fee</div>' : ''}
        ${apartment.rentStabilized ? '<div class="detail-item">🏛️ Rent Stabilized</div>' : ''}
      </div>

      <h3>AI Analysis</h3>
      <p><strong>Match Score:</strong> <span class="score">${analysis.overallScore}/10</span></p>
      <p><strong>Deal Score:</strong> ${dealScore}/100</p>
      <p>${analysis.summary}</p>

      <div class="pros">
        <h4>✅ Pros</h4>
        <ul>
          ${analysis.pros.map(pro => `<li>${pro}</li>`).join('')}
        </ul>
      </div>

      ${analysis.cons.length > 0 ? `
      <div class="cons">
        <h4>⚠️ Considerations</h4>
        <ul>
          ${analysis.cons.map(con => `<li>${con}</li>`).join('')}
        </ul>
      </div>
      ` : ''}

      <p><strong>Price Assessment:</strong> ${analysis.priceAssessment}</p>

      <a href="${apartment.url}" class="cta">View Listing →</a>
    </div>
  </div>
</body>
</html>
  `;
}

function generateSmsMessage(
  apartment: Apartment,
  analysis: AIAnalysis,
  dealScore: number
): string {
  const emoji = dealScore >= 90 ? '🔥' : dealScore >= 80 ? '⭐' : '✨';
  return `${emoji} PadBuzz Deal Alert!

${apartment.bedrooms}BR/${apartment.bathrooms}BA in ${apartment.neighborhood}
$${apartment.price.toLocaleString()}/mo
Score: ${analysis.overallScore}/10 | Deal: ${dealScore}/100

${analysis.summary.slice(0, 100)}...

${apartment.url}`;
}

export async function notifyPaidSubscribers(
  subscribers: Subscriber[],
  apartment: Apartment,
  analysis: AIAnalysis,
  dealScore: number
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  const paidSubscribers = subscribers.filter(
    s => s.isPaid && s.notificationSettings.instantAlerts
  );

  for (const subscriber of paidSubscribers) {
    const result = await sendDealAlert(subscriber, apartment, analysis, dealScore);
    if (result.email || result.sms) {
      sent++;
    } else {
      failed++;
    }
  }

  return { sent, failed };
}
