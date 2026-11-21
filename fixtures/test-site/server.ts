import express, { type Express } from 'express';
import type { Server } from 'node:http';

export interface FixtureServerInstance {
  app: Express;
  server: Server;
  port: number;
  baseUrl: string;
  stop: () => Promise<void>;
}

export function createFixtureApp(): Express {
  const app = express();

  // 1. Clean root page
  app.get('/', (req, res) => {
    const host = req.get('host') || 'localhost:3000';
    const canonical = `http://${host}/`;
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Acme Storefront - High Quality Outdoor Adventure Gear</title>
  <meta name="description" content="Discover top-quality outdoor camping, hiking boots, and trail gear at Acme Storefront. Enjoy free shipping on eligible orders.">
  <link rel="canonical" href="${canonical}">
  <meta name="robots" content="index, follow">
</head>
<body>
  <h1>Welcome to Acme Storefront</h1>
  <p>Explore our wide selection of trail gear.</p>
</body>
</html>`);
  });

  // 2. Clean about page
  app.get('/about', (req, res) => {
    const host = req.get('host') || 'localhost:3000';
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>About Acme Storefront - Our Heritage & Mission</title>
  <meta name="description" content="Learn about Acme Storefront's legacy in providing outdoor enthusiasts with durable equipment and sustainable adventure apparel.">
  <link rel="canonical" href="http://${host}/about">
</head>
<body>
  <h1>About Our Company</h1>
  <p>Committed to quality since 1994.</p>
</body>
</html>`);
  });

  // 3. Missing title
  app.get('/missing-title', (req, res) => {
    const host = req.get('host') || 'localhost:3000';
    res.send(`<!DOCTYPE html>
<html>
<head>
  <meta name="description" content="A valid meta description that has enough characters to fulfill the minimum requirement for search engines.">
  <link rel="canonical" href="http://${host}/missing-title">
</head>
<body>
  <h1>Missing Title Page</h1>
</body>
</html>`);
  });

  // 4. Short title
  app.get('/short-title', (req, res) => {
    const host = req.get('host') || 'localhost:3000';
    res.send(`<!DOCTYPE html>
<html>
<head>
  <title>Hi</title>
  <meta name="description" content="A valid meta description that has enough characters to fulfill the minimum requirement for search engines.">
  <link rel="canonical" href="http://${host}/short-title">
</head>
<body>
  <h1>Short Title Page</h1>
</body>
</html>`);
  });

  // 5. Duplicate titles
  app.get('/duplicate-title-1', (req, res) => {
    const host = req.get('host') || 'localhost:3000';
    res.send(`<!DOCTYPE html>
<html>
<head>
  <title>Standard Duplicate Page Title for Testing</title>
  <meta name="description" content="Description for duplicate title test page number one with adequate length for search engines.">
  <link rel="canonical" href="http://${host}/duplicate-title-1">
</head>
<body>
  <h1>Duplicate Title 1</h1>
</body>
</html>`);
  });

  app.get('/duplicate-title-2', (req, res) => {
    const host = req.get('host') || 'localhost:3000';
    res.send(`<!DOCTYPE html>
<html>
<head>
  <title>Standard Duplicate Page Title for Testing</title>
  <meta name="description" content="Description for duplicate title test page number two with adequate length for search engines.">
  <link rel="canonical" href="http://${host}/duplicate-title-2">
</head>
<body>
  <h1>Duplicate Title 2</h1>
</body>
</html>`);
  });

  // 6. Missing description
  app.get('/missing-description', (req, res) => {
    const host = req.get('host') || 'localhost:3000';
    res.send(`<!DOCTYPE html>
<html>
<head>
  <title>Page Missing Meta Description Tag Example</title>
  <link rel="canonical" href="http://${host}/missing-description">
</head>
<body>
  <h1>Missing Description</h1>
</body>
</html>`);
  });

  // 7. Missing H1
  app.get('/missing-h1', (req, res) => {
    const host = req.get('host') || 'localhost:3000';
    res.send(`<!DOCTYPE html>
<html>
<head>
  <title>Page With No H1 Heading Tag Anywhere</title>
  <meta name="description" content="A valid meta description that has enough characters to fulfill the minimum requirement for search engines.">
  <link rel="canonical" href="http://${host}/missing-h1">
</head>
<body>
  <p>No H1 element on this page at all.</p>
</body>
</html>`);
  });

  // 8. Multiple H1
  app.get('/multiple-h1', (req, res) => {
    const host = req.get('host') || 'localhost:3000';
    res.send(`<!DOCTYPE html>
<html>
<head>
  <title>Page With Multiple H1 Heading Tags Rendered</title>
  <meta name="description" content="A valid meta description that has enough characters to fulfill the minimum requirement for search engines.">
  <link rel="canonical" href="http://${host}/multiple-h1">
</head>
<body>
  <h1>Primary First Heading</h1>
  <h1>Secondary Unwanted Heading</h1>
</body>
</html>`);
  });

  // 9. Missing canonical
  app.get('/missing-canonical', (req, res) => {
    res.send(`<!DOCTYPE html>
<html>
<head>
  <title>Page Missing Canonical Tag Demonstration</title>
  <meta name="description" content="A valid meta description that has enough characters to fulfill the minimum requirement for search engines.">
</head>
<body>
  <h1>Missing Canonical</h1>
</body>
</html>`);
  });

  // 10. Relative canonical
  app.get('/relative-canonical', (req, res) => {
    res.send(`<!DOCTYPE html>
<html>
<head>
  <title>Page With Relative Canonical Tag Demonstration</title>
  <meta name="description" content="A valid meta description that has enough characters to fulfill the minimum requirement for search engines.">
  <link rel="canonical" href="/relative-target">
</head>
<body>
  <h1>Relative Canonical</h1>
</body>
</html>`);
  });

  // 11. Broken canonical target
  app.get('/broken-canonical', (req, res) => {
    const host = req.get('host') || 'localhost:3000';
    res.send(`<!DOCTYPE html>
<html>
<head>
  <title>Page Canonical Points To Broken 404 Target</title>
  <meta name="description" content="A valid meta description that has enough characters to fulfill the minimum requirement for search engines.">
  <link rel="canonical" href="http://${host}/broken-404">
</head>
<body>
  <h1>Broken Canonical Target</h1>
</body>
</html>`);
  });

  // 12. Accidental noindex meta tag
  app.get('/accidental-noindex-meta', (req, res) => {
    const host = req.get('host') || 'localhost:3000';
    res.send(`<!DOCTYPE html>
<html>
<head>
  <title>Page With Accidental Meta Noindex Directive</title>
  <meta name="description" content="A valid meta description that has enough characters to fulfill the minimum requirement for search engines.">
  <link rel="canonical" href="http://${host}/accidental-noindex-meta">
  <meta name="robots" content="noindex, follow">
</head>
<body>
  <h1>Accidental Noindex Meta</h1>
</body>
</html>`);
  });

  // 13. Accidental noindex header
  app.get('/accidental-noindex-header', (req, res) => {
    const host = req.get('host') || 'localhost:3000';
    res.set('X-Robots-Tag', 'noindex');
    res.send(`<!DOCTYPE html>
<html>
<head>
  <title>Page With Accidental X-Robots-Tag Header Directive</title>
  <meta name="description" content="A valid meta description that has enough characters to fulfill the minimum requirement for search engines.">
  <link rel="canonical" href="http://${host}/accidental-noindex-header">
</head>
<body>
  <h1>Accidental Noindex Header</h1>
</body>
</html>`);
  });

  // 14. Redirect chain: chain-1 -> chain-2 -> chain-final
  app.get('/redirect-chain-1', (req, res) => {
    res.redirect(301, '/redirect-chain-2');
  });

  app.get('/redirect-chain-2', (req, res) => {
    res.redirect(302, '/redirect-final');
  });

  app.get('/redirect-final', (req, res) => {
    const host = req.get('host') || 'localhost:3000';
    res.send(`<!DOCTYPE html>
<html>
<head>
  <title>Redirect Final Destination Page Example</title>
  <meta name="description" content="A valid meta description that has enough characters to fulfill the minimum requirement for search engines.">
  <link rel="canonical" href="http://${host}/redirect-final">
</head>
<body>
  <h1>Redirect Destination</h1>
</body>
</html>`);
  });

  // 15. Redirect loop
  app.get('/redirect-loop-1', (req, res) => {
    res.redirect(302, '/redirect-loop-2');
  });

  app.get('/redirect-loop-2', (req, res) => {
    res.redirect(302, '/redirect-loop-1');
  });

  // 16. Broken HTTP errors
  app.get('/broken-404', (req, res) => {
    res.status(404).send('Not Found');
  });

  app.get('/broken-500', (req, res) => {
    res.status(500).send('Internal Server Error');
  });

  // 17. Sitemap.xml
  app.get('/sitemap.xml', (req, res) => {
    const host = req.get('host') || 'localhost:3000';
    res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>http://${host}/</loc></url>
  <url><loc>http://${host}/about</loc></url>
  <url><loc>http://${host}/missing-title</loc></url>
  <url><loc>http://${host}/broken-404</loc></url>
</urlset>`);
  });

  // 18. JavaScript-rendered storefront page
  app.get('/rendered-vs-raw-js-only', (req, res) => {
    const host = req.get('host') || 'localhost:3000';
    res.send(`<!DOCTYPE html>
<html>
<head>
  <title></title>
  <link rel="canonical" href="http://${host}/rendered-vs-raw-js-only">
  <script>
    document.addEventListener("DOMContentLoaded", () => {
      document.title = "Client Rendered Product Page Title";
      const h1 = document.createElement("h1");
      h1.textContent = "Client Rendered Dynamic H1";
      document.body.appendChild(h1);
      const desc = document.createElement("meta");
      desc.name = "description";
      desc.content = "Dynamically injected meta description via client-side script execution.";
      document.head.appendChild(desc);
    });
  </script>
</head>
<body>
  <div id="root">Loading product catalog...</div>
</body>
</html>`);
  });

  // 19. Structured data: clean
  app.get('/structured-data-clean', (req, res) => {
    const host = req.get('host') || 'localhost:3000';
    res.send(`<!DOCTYPE html>
<html>
<head>
  <title>Clean Product With Valid Schema Markup</title>
  <meta name="description" content="Product page containing complete schema.org Product and BreadcrumbList markup.">
  <link rel="canonical" href="http://${host}/structured-data-clean">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "Trailmaster Waterproof Boots",
    "image": "https://example.com/boots.jpg",
    "offers": {
      "@type": "Offer",
      "price": "149.99",
      "priceCurrency": "USD"
    }
  }
  </script>
</head>
<body>
  <h1>Trailmaster Waterproof Boots</h1>
</body>
</html>`);
  });

  // 20. Structured data: syntax error
  app.get('/structured-data-syntax-error', (req, res) => {
    const host = req.get('host') || 'localhost:3000';
    res.send(`<!DOCTYPE html>
<html>
<head>
  <title>Product With Malformed JSON-LD Syntax</title>
  <meta name="description" content="Product page containing a broken JSON-LD syntax script tag.">
  <link rel="canonical" href="http://${host}/structured-data-syntax-error">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "Broken JSON Shoe",
    "trailing_comma_error": true,
  }
  </script>
</head>
<body>
  <h1>Broken JSON Shoe</h1>
</body>
</html>`);
  });

  // 21. Structured data: missing field
  app.get('/structured-data-missing-field', (req, res) => {
    const host = req.get('host') || 'localhost:3000';
    res.send(`<!DOCTYPE html>
<html>
<head>
  <title>Product With Incomplete Schema Markup</title>
  <meta name="description" content="Product page missing recommended schema properties.">
  <link rel="canonical" href="http://${host}/structured-data-missing-field">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "Incomplete Product"
  }
  </script>
</head>
<body>
  <h1>Incomplete Product</h1>
</body>
</html>`);
  });

  // 22. Hreflang reciprocal pairs
  app.get('/hreflang-clean-en', (req, res) => {
    const host = req.get('host') || 'localhost:3000';
    res.send(`<!DOCTYPE html>
<html>
<head>
  <title>English Storefront Landing Page Version</title>
  <meta name="description" content="English language version of international storefront with alternate hreflang.">
  <link rel="canonical" href="http://${host}/hreflang-clean-en">
  <link rel="alternate" hreflang="en" href="http://${host}/hreflang-clean-en">
  <link rel="alternate" hreflang="es" href="http://${host}/hreflang-clean-es">
</head>
<body>
  <h1>Welcome to Storefront</h1>
</body>
</html>`);
  });

  app.get('/hreflang-clean-es', (req, res) => {
    const host = req.get('host') || 'localhost:3000';
    res.send(`<!DOCTYPE html>
<html>
<head>
  <title>Spanish Storefront Landing Page Version</title>
  <meta name="description" content="Spanish language version of international storefront with alternate hreflang.">
  <link rel="canonical" href="http://${host}/hreflang-clean-es">
  <link rel="alternate" hreflang="es" href="http://${host}/hreflang-clean-es">
  <link rel="alternate" hreflang="en" href="http://${host}/hreflang-clean-en">
</head>
<body>
  <h1>Bienvenido a la Tienda</h1>
</body>
</html>`);
  });

  // 23. Robots.txt
  app.get('/robots.txt', (req, res) => {
    res.type('text/plain').send(`User-agent: *
Disallow: /cart
Disallow: /admin/
Allow: /
`);
  });

  // 24. Hreflang non-reciprocal pair
  app.get('/hreflang-broken-en', (req, res) => {
    const host = req.get('host') || 'localhost:3000';
    res.send(`<!DOCTYPE html>
<html>
<head>
  <title>English Storefront With Broken Reciprocal Hreflang</title>
  <meta name="description" content="English language version pointing to an alternate that lacks a return link.">
  <link rel="canonical" href="http://${host}/hreflang-broken-en">
  <link rel="alternate" hreflang="en" href="http://${host}/hreflang-broken-en">
  <link rel="alternate" hreflang="es" href="http://${host}/hreflang-broken-es">
</head>
<body>
  <h1>English Storefront</h1>
</body>
</html>`);
  });

  app.get('/hreflang-broken-es', (req, res) => {
    const host = req.get('host') || 'localhost:3000';
    res.send(`<!DOCTYPE html>
<html>
<head>
  <title>Spanish Storefront Missing Return Reciprocal Tag</title>
  <meta name="description" content="Spanish language version that omits reciprocal link back to English.">
  <link rel="canonical" href="http://${host}/hreflang-broken-es">
  <link rel="alternate" hreflang="es" href="http://${host}/hreflang-broken-es">
</head>
<body>
  <h1>Tienda en Espanol</h1>
</body>
</html>`);
  });

  return app;
}

export function startFixtureServer(port: number = 0): Promise<FixtureServerInstance> {
  const app = createFixtureApp();
  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      const addr = server.address();
      const actualPort = typeof addr === 'object' && addr ? addr.port : port;
      const baseUrl = `http://127.0.0.1:${actualPort}`;
      resolve({
        app,
        server,
        port: actualPort,
        baseUrl,
        stop: () =>
          new Promise<void>((stopResolve, stopReject) => {
            server.close((err) => (err ? stopReject(err) : stopResolve()));
          }),
      });
    });
  });
}
