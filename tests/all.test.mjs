// Единая точка запуска не создаёт отдельный Node-процесс на каждый файл в Windows CI.
await import('./security-foundation.test.mjs');
await import('./admin-rbac.test.mjs');
await import('./api-security.test.mjs');
await import('./auth-security.test.mjs');
await import('./max-bot-stage-2.test.mjs');
await import('./parser-stage-3.test.mjs');
await import('./chat-discovery-stage-4.test.mjs');
await import('./legal-stage-5.test.mjs');
await import('./yookassa-stage-6.test.mjs');
