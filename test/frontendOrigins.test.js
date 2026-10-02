const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getFrontendOrigins,
  getPrimaryFrontendOrigin,
  isAllowedFrontendOrigin,
} = require('../frontendOrigins');

const withEnvironment = (values, callback) => {
  const previous = Object.fromEntries(
    Object.keys(values).map((key) => [key, process.env[key]])
  );
  Object.assign(process.env, values);
  try {
    callback();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
};

test('production accepts only explicitly configured frontend origins', () => {
  withEnvironment({
    NODE_ENV: 'production',
    FRONTEND_URL: 'https://nutrix.example, https://preview.nutrix.example/path',
  }, () => {
    assert.deepEqual(getFrontendOrigins(), [
      'https://nutrix.example',
      'https://preview.nutrix.example',
    ]);
    assert.equal(getPrimaryFrontendOrigin(), 'https://nutrix.example');
    assert.equal(isAllowedFrontendOrigin('https://preview.nutrix.example/dashboard'), true);
    assert.equal(isAllowedFrontendOrigin('http://localhost:3000'), false);
  });
});

test('development permits localhost origins', () => {
  withEnvironment({ NODE_ENV: 'development', FRONTEND_URL: 'http://localhost:3000' }, () => {
    assert.equal(isAllowedFrontendOrigin('http://localhost:3001'), true);
  });
});
