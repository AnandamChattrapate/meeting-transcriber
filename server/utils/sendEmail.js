async function sendMeetingSummaryEmail({ to, meeting }) {
  const { title, summary = [], actionItems = [], cleanedTranscript, rawTranscript, startedAt, endedAt } = meeting;
  const transcript = cleanedTranscript || rawTranscript || '';
  const duration = endedAt && startedAt
    ? Math.round((new Date(endedAt) - new Date(startedAt)) / 60000)
    : null;

  const li = (items) => items.map(s => `<li style="margin:5px 0;line-height:1.6">${s}</li>`).join('');

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;color:#1d1d1f;background:#fff;">
  <h1 style="font-size:24px;font-weight:700;margin:0 0 6px;">${title || 'Meeting Summary'}</h1>
  <p style="color:#6e6e73;font-size:13px;margin:0 0 32px;">${new Date(startedAt).toLocaleString()}${duration != null ? ` &nbsp;·&nbsp; ${duration} min` : ''}</p>

  ${summary.length ? `
  <h2 style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#7c3aed;margin:0 0 12px;">Summary</h2>
  <ul style="padding-left:20px;margin:0 0 28px;">${li(summary)}</ul>` : ''}

  ${actionItems.length ? `
  <h2 style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#7c3aed;margin:0 0 12px;">Action Items</h2>
  <ul style="padding-left:20px;margin:0 0 28px;">${li(actionItems)}</ul>` : ''}

  ${transcript ? `
  <h2 style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#7c3aed;margin:0 0 12px;">Transcript</h2>
  <div style="background:#f5f5f7;border-radius:12px;padding:18px;font-size:14px;line-height:1.75;white-space:pre-wrap;">${transcript}</div>` : ''}
</body>
</html>`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
      to: [to],
      subject: `Meeting Summary: ${title || new Date(startedAt).toLocaleDateString()}`,
      html,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Resend failed (${response.status}): ${err}`);
  }
  return response.json();
}

module.exports = { sendMeetingSummaryEmail };
