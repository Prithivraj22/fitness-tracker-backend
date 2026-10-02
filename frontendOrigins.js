const LOCAL_FRONTEND_URL = 'http://localhost:3000';

const getFrontendOrigins = () => {
  const configured = process.env.FRONTEND_URL || LOCAL_FRONTEND_URL;
  return configured
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => new URL(value).origin);
};

const getPrimaryFrontendOrigin = () => getFrontendOrigins()[0];

const isAllowedFrontendOrigin = (value) => {
  if (!value) return false;

  try {
    const origin = new URL(value).origin;
    if (getFrontendOrigins().includes(origin)) return true;
    return process.env.NODE_ENV !== 'production' && new URL(origin).hostname === 'localhost';
  } catch (error) {
    return false;
  }
};

module.exports = {
  getFrontendOrigins,
  getPrimaryFrontendOrigin,
  isAllowedFrontendOrigin,
};
