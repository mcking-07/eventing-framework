const BASE = 'http://localhost:4566';

async function check() {
  console.log('[infra] checking localstack...');
  const res = await fetch(`${BASE}/_localstack/health`);
  const body = await res.json() as { services: Record<string, string> };

  const required = ['sns', 'sqs', 's3'];
  const missing = required.filter((s) => {
    const status = body.services[s];
    return status !== 'running' && status !== 'available';
  });

  if (missing.length) {
    console.error(`[infra] required services not healthy: ${missing.join(', ')}`);
    process.exit(1);
  }

  console.log('[infra] localstack is healthy');
}

export { check };
