// Sends a push notification via ntfy.sh (https://ntfy.sh). Free, no account
// needed — pick a hard-to-guess topic name, subscribe to it in the ntfy iOS
// app, and anything POSTed here shows up as a phone notification.
async function sendPush(title, message) {
  const topic = process.env.NTFY_TOPIC;
  if (!topic) {
    throw new Error('Missing NTFY_TOPIC env var — pick a private topic name and set it in your Vercel project.');
  }
  const server = process.env.NTFY_SERVER || 'https://ntfy.sh';

  const res = await fetch(`${server}/${encodeURIComponent(topic)}`, {
    method: 'POST',
    headers: {
      'Title': title,
      'Priority': 'high',
      'Tags': 'moneybag'
    },
    body: message
  });

  if (!res.ok) {
    throw new Error(`ntfy push failed (${res.status})`);
  }
}

module.exports = { sendPush };
