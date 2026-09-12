const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const envExample = fs.readFileSync('.env.example', 'utf8');
const compose = fs.readFileSync('docker-compose.yml', 'utf8');

test('configuración reproducible declara secreto interno y límites', () => {
  assert.match(envExample, /^INTERNAL_SERVICE_TOKEN=.+$/m);
  assert.match(envExample, /^JSON_BODY_LIMIT=.+$/m);
  assert.match(compose, /INTERNAL_SERVICE_TOKEN/);
  assert.match(compose, /JSON_BODY_LIMIT/);
});
