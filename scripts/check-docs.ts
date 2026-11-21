import fs from 'node:fs';
import path from 'node:path';
import fg from 'fast-glob';

async function main() {
  console.log('🔍 Running docs:check across documentation files...');
  const docFiles = await fg(['docs/**/*.md', 'README.md', 'CONTRIBUTING.md', 'SECURITY.md'], { cwd: process.cwd() });
  let hasErrors = false;

  const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const mermaidRegex = /```mermaid([\s\S]*?)```/g;

  for (const relPath of docFiles) {
    const fullPath = path.resolve(process.cwd(), relPath);
    const content = fs.readFileSync(fullPath, 'utf8');

    // 1. Validate Mermaid blocks
    const mermaidMatches = [...content.matchAll(mermaidRegex)];
    for (const match of mermaidMatches) {
      const diagram = match[1].trim();
      if (!diagram) {
        console.error(`❌ Empty Mermaid block in ${relPath}`);
        hasErrors = true;
      }
    }

    // 2. Validate links
    let linkMatch: RegExpExecArray | null;
    while ((linkMatch = markdownLinkRegex.exec(content)) !== null) {
      const linkTarget = linkMatch[2].trim();

      // Skip external web URLs
      if (linkTarget.startsWith('http://') || linkTarget.startsWith('https://')) {
        continue;
      }

      // Handle file:/// absolute links
      if (linkTarget.startsWith('file:///')) {
        let cleanPath = linkTarget.replace('file:///', '');
        // strip anchor / line numbers
        cleanPath = cleanPath.split('#')[0];
        // Normalize windows drive paths (e.g. D:/seo-gate/... or d:/seo-gate/...)
        cleanPath = decodeURIComponent(cleanPath);
        if (!fs.existsSync(cleanPath)) {
          console.error(`❌ Broken file link in ${relPath}: ${linkTarget} -> ${cleanPath} does not exist`);
          hasErrors = true;
        }
        continue;
      }

      // Handle relative file links
      if (!linkTarget.startsWith('#')) {
        const targetPathWithoutHash = linkTarget.split('#')[0];
        if (targetPathWithoutHash) {
          const resolvedPath = path.resolve(path.dirname(fullPath), targetPathWithoutHash);
          if (!fs.existsSync(resolvedPath)) {
            console.error(`❌ Broken relative link in ${relPath}: ${linkTarget} -> ${resolvedPath} does not exist`);
            hasErrors = true;
          }
        }
      }
    }
  }

  if (hasErrors) {
    console.error('\n❌ docs:check found broken links or issues.');
    process.exit(1);
  } else {
    console.log(`\n✅ docs:check passed! Verified ${docFiles.length} markdown documents.`);
  }
}

main().catch((err) => {
  console.error('Fatal error in docs:check:', err);
  process.exit(1);
});
