const http = require('http');

if (!process.env.PORT) process.env.PORT = 3000;

console.log('[CRON] Starting 24/7 background parser...');
console.log('[CRON] Watchdog started. Polling every 10s to check interval...');

setInterval(() => {
  const req = http.request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/parser/cron',
    method: 'POST'
  }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const result = JSON.parse(data);
        if (!result.skipped) {
          console.log('[CRON] ' + new Date().toLocaleTimeString() + ' -> Success. New leads: ' + (result.leadsCount || 0));
        }
      } catch (e) { }
    });
  });
  req.on('error', (e) => {});
  req.end();
}, 10000);