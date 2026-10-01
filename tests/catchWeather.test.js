const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { mapWeather } = require('../services/catchWeather');

test('maps imperial temperature/wind and converts hPa to inHg', () => {
  assert.deepEqual(mapWeather({ temp: 64.7, pressure: 1013.25, wind_speed: 8.4, wind_deg: 315, weather: [{ description: 'clear sky' }] }), {
    temperature: 65, barometric: 29.92, wind_speed: 8, wind_direction: 'NW', weather_conditions: 'clear sky',
  });
});
test('preserves zero values and missing fields without inventing measurements', () => {
  const weather = mapWeather({ temp: 0, wind_speed: 0, wind_deg: 0 });
  assert.equal(weather.temperature, 0);
  assert.equal(weather.wind_speed, 0);
  assert.equal(weather.wind_direction, 'N');
  assert.equal(weather.barometric, null);
  assert.equal(weather.weather_conditions, null);
  assert.equal(mapWeather({ temp: -10, wind_deg: 360 }).wind_direction, 'N');
  assert.equal(mapWeather({ temp: null, wind_speed: 5 }).temperature, null);
  assert.throws(() => mapWeather({}));
  assert.throws(() => mapWeather(undefined));
});
test('maps compass directions within the existing two-character field', () => {
  for (const [degrees, direction] of [[0,'N'],[45,'NE'],[90,'E'],[135,'SE'],[180,'S'],[225,'SW'],[270,'W'],[315,'NW'],[359,'N']]) {
    assert.equal(mapWeather({ wind_deg: degrees }).wind_direction, direction);
  }
});
function setup(key = 'test-key') {
  const calls = [];
  const context = { module: { exports: {} }, process: { env: { WEATHER_API_KEY: key } }, require: () => ({ get: async (...args) => { calls.push(args); return { data: { data: [{ temp: 70 }] } }; } }) };
  vm.runInNewContext(fs.readFileSync(require.resolve('../services/catchWeather'), 'utf8'), context);
  return { calls, get: context.module.exports.getCatchWeather };
}
test('requests catch-time weather in imperial units with bounded wait and accepts zero coordinates', async () => {
  const { calls, get } = setup();
  const result = await get({ latitude: 0, longitude: 0 }, 1790695800);
  const [url, options] = calls[0];
  assert.match(url, /onecall\/timemachine$/);
  assert.equal(options.params.lat, 0);
  assert.equal(options.params.lon, 0);
  assert.equal(options.params.dt, 1790695800);
  assert.equal(options.params.units, 'imperial');
  assert.equal(options.params.appid, 'test-key');
  assert.equal(options.timeout, 5000);
  assert.equal(result.temperature, 70);
});
test('missing credentials or invalid coordinates do not call the provider', async () => {
  const missingKey = setup('');
  await assert.rejects(missingKey.get({ latitude: 42, longitude: -93 }, 1));
  assert.equal(missingKey.calls.length, 0);
  const { calls, get } = setup();
  for (const lake of [null, {}, { latitude: null, longitude: 0 }, { latitude: 91, longitude: 0 }, { latitude: 0, longitude: -181 }]) await assert.rejects(get(lake, 1));
  assert.equal(calls.length, 0);
});
