# AWLA AI Worker

Cloudflare Worker backend for AWLA image generation and reference-image editing.

## Current model
`@cf/black-forest-labs/flux-2-klein-4b`

## Routes
- `GET /health`
- `POST /generate`
- `POST /generate-json`
- `POST /edit`
- `POST /edit-json`

## Cloudflare setup
Worker name: `awla-ai`
Workers AI binding: `AI`

### Git deployment
If this folder is its own GitHub repo:
- Root directory: `/`
- Deploy command: `npx wrangler deploy`

If you place it inside the existing AWLA repo:
- Root directory: `worker`
- Deploy command: `npx wrangler deploy`

## Example: text-to-image
```bash
curl -X POST "https://awla-ai.mohamedhefzyartwork.workers.dev/generate"   -H "Content-Type: application/json"   -d '{"prompt":"luxury eyewear campaign, sculptural product, editorial lighting","width":1024,"height":1024}'   --output result.jpg
```

## Example: reference editing
```bash
curl -X POST "https://awla-ai.mohamedhefzyartwork.workers.dev/edit"   -F 'prompt=Preserve the exact sunglasses design. Create a world-class luxury editorial campaign environment with controlled cinematic lighting and premium materials. Do not change logo, frame geometry, lenses, hardware, proportions or distinctive details.'   -F 'width=1024'   -F 'height=1024'   -F 'input_image_0=@product.jpg'   --output edited.jpg
```

## Security note
This pilot build restricts browser CORS to the AWLA GitHub Pages origin, but it is not a full authentication layer. Add authenticated requests and rate limits before public launch.
Auto deploy test
