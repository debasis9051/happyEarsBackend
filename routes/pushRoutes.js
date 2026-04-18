const express = require('express');
const crypto = require('crypto');
const webpush = require('web-push');
const checkJwt = require('../checkJwt');

const pushRoutes = express.Router();

const subscriptions = new Map();

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
const vapidEmail = process.env.VAPID_SUBJECT || 'mailto:admin@happyears.local';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);
}

const subscriptionId = (endpoint) => crypto.createHash('sha256').update(endpoint).digest('hex');

const broadcastPushNotification = async (message = 'New data is available. Open the app to refresh.', title = 'Happy Ears Update') => {
  if (!vapidPublicKey || !vapidPrivateKey || subscriptions.size === 0) {
    return { delivered: 0, total: subscriptions.size };
  }

  const payload = JSON.stringify({
    type: 'sync-notification',
    title,
    message,
  });

  const tasks = [...subscriptions.values()].map(async (subscription) => {
    try {
      await webpush.sendNotification(subscription, payload);
      return true;
    } catch (error) {
      if (error.statusCode === 404 || error.statusCode === 410) {
        subscriptions.delete(subscriptionId(subscription.endpoint));
      }
      return false;
    }
  });

  const results = await Promise.all(tasks);
  return {
    delivered: results.filter(Boolean).length,
    total: results.length,
  };
};

pushRoutes.post('/push/public-key', checkJwt([]), async (req, res) => {
  if (!vapidPublicKey) {
    return res.status(200).json({
      operation: 'error',
      message: 'Push is not configured on server. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.',
    });
  }

  return res.status(200).json({
    operation: 'success',
    info: { publicKey: vapidPublicKey },
  });
});

pushRoutes.post('/push/subscribe', checkJwt([]), async (req, res) => {
  const subscription = req.body.subscription;

  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ operation: 'error', message: 'Invalid push subscription payload.' });
  }

  const id = subscriptionId(subscription.endpoint);
  subscriptions.set(id, subscription);

  return res.status(200).json({ operation: 'success', message: 'Push subscription saved.' });
});

pushRoutes.post('/push/unsubscribe', checkJwt([]), async (req, res) => {
  const endpoint = req.body.endpoint;

  if (!endpoint) {
    return res.status(400).json({ operation: 'error', message: 'Endpoint is required.' });
  }

  subscriptions.delete(subscriptionId(endpoint));
  return res.status(200).json({ operation: 'success', message: 'Push subscription removed.' });
});

pushRoutes.post('/push/notify', checkJwt([]), async (req, res) => {
  if (!vapidPublicKey || !vapidPrivateKey) {
    return res.status(200).json({
      operation: 'error',
      message: 'Push is not configured on server. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.',
    });
  }

  const { delivered, total } = await broadcastPushNotification(
    req.body.message || 'New data is available. Open the app to refresh.',
    req.body.title || 'Happy Ears Update'
  );

  return res.status(200).json({
    operation: 'success',
    message: `Push sent to ${delivered}/${total} subscribers.`,
  });
});

module.exports = pushRoutes;
module.exports.broadcastPushNotification = broadcastPushNotification;
