import fs from 'node:fs';
import path from 'node:path';
import { startFixtureServer } from '../fixtures/test-site/server.js';
import { executeRun } from '../src/cli/commands.js';

async function main() {
  console.log('🚀 Starting local fixture test server...');
  const fixture = await startFixtureServer(0);
  console.log(`📡 Fixture server listening at: ${fixture.baseUrl}`);

  const demoConfigPath = path.resolve(process.cwd(), 'demo-config.yml');
  const demoReportPath = path.resolve(process.cwd(), 'demo-report.json');

  const configContent = `
target: ${fixture.baseUrl}
mode: strict
pages:
  include:
    - "/"
    - "/about"
    - "/missing-title"
    - "/accidental-noindex-meta"
    - "/redirect-chain-1"
  sitemap: false
  crawl:
    concurrency: 2
    delayMs: 50
checks:
  title:
    min: 20
    max: 65
    unique: true
  metaDescription:
    min: 70
    max: 160
    unique: true
`;

  fs.writeFileSync(demoConfigPath, configContent, 'utf8');

  try {
    console.log('\n--- EXECUTING seo-gate CLI RUN ---');
    const exitCode = await executeRun({
      config: demoConfigPath,
      output: demoReportPath,
    });
    console.log(`\nExit Code: ${exitCode}`);
  } finally {
    await fixture.stop();
    if (fs.existsSync(demoConfigPath)) fs.unlinkSync(demoConfigPath);
    if (fs.existsSync(demoReportPath)) fs.unlinkSync(demoReportPath);
    console.log('🏁 Demo complete.');
  }
}

main().catch(console.error);
