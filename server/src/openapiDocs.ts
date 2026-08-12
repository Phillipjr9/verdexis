import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

interface RouteRegistrar {
  get(path: string, handler: (req: unknown, res: any) => void): void
}

interface OpenApiDocument {
  openapi: string
  info: {
    title: string
    version: string
    description: string
    contact?: { name: string }
  }
  servers?: Array<{ url: string; description?: string }>
  paths: Record<string, unknown>
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const specPath = path.resolve(__dirname, '../../docs/openapi.json')

export function getOpenApiDocument(): OpenApiDocument {
  return JSON.parse(readFileSync(specPath, 'utf8')) as OpenApiDocument
}

export function registerOpenApiDocs(app: RouteRegistrar): void {
  app.get('/api/docs', (_req, res) => {
    res.type('html').send(`<!doctype html>
<html lang="en">
  <head>
    <!-- Google tag (gtag.js) -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=AW-18384264054"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);} 
      gtag('js', new Date());

      gtag('config', 'AW-18384264054');
    </script>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Verdexis API Docs</title>
    <style>
      body { font-family: Inter, Arial, sans-serif; margin: 2rem; color: #e5e5e5; background: #071116; }
      a { color: #0c8b44; }
      code { background: #0f1619; padding: 0.2rem 0.4rem; border-radius: 0.25rem; }
    </style>
  </head>
  <body>
    <h1>Verdexis API Docs</h1>
    <p>This endpoint exposes the initial OpenAPI document for the Verdexis web API.</p>
    <ul>
      <li><a href="/api/docs/openapi.json">Download OpenAPI JSON</a></li>
      <li><a href="/api/health">Health check</a></li>
    </ul>
  </body>
</html>`)
  })

  app.get('/api/docs/openapi.json', (_req, res) => {
    res.json(getOpenApiDocument())
  })

  app.get('/api/docs/swagger', (_req, res) => {
    // Lightweight Swagger UI that loads the local openapi JSON
    res.type('html').send(`<!doctype html>
<html lang="en">
  <head>
    <!-- Google tag (gtag.js) -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=AW-18384264054"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);} 
      gtag('js', new Date());

      gtag('config', 'AW-18384264054');
    </script>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Verdexis API - Swagger UI</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@4.21.0/swagger-ui.css" />
    <style>body{margin:0;padding:0}</style>
  </head>
  <body>
    <div id="swagger"></div>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@4.21.0/swagger-ui-bundle.js"></script>
    <script>
      window.onload = function () {
        const ui = SwaggerUIBundle({
          url: '/api/docs/openapi.json',
          dom_id: '#swagger',
          presets: [SwaggerUIBundle.presets.apis],
          layout: 'BaseLayout'
        })
        window.ui = ui
      }
    </script>
  </body>
</html>`)
  })
}
