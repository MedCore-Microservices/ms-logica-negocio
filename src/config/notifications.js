// config/notifications.js
const config = {
  mode: process.env.NOTIFICATIONS_MODE || 'mock', // 'mock' | 'twilio'
  auto: process.env.NOTIFICATIONS_AUTO !== 'false', // default true
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    from: process.env.TWILIO_FROM || '',
  },
};

module.exports = config;
