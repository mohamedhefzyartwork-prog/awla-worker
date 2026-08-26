
const MODELS = {
  dev: "@cf/black-forest-labs/flux-2-dev",
  fast: "@cf/black-forest-labs/flux-2-klein-4b"
};
const DEFAULT_ENGINE = "dev";
const DEFAULT_ORIGIN = "https://mohamedhefzyartwork-prog.github.io";

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGIN || DEFAULT_ORIGIN).split(",").map(s => s.trim());
  const allowOrigin = allowed.includes(origin) ? origin : allowed[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers }
  });
}

function clampInt(value, fallback, min = 256, max = 1920) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

async function runFlux(env, form, engine = DEFAULT_ENGINE) {
  const serialized = new Response(form);
  const model = MODELS[engine] || MODELS[DEFAULT_ENGINE];
  return env.AI.run(model, {
    multipart: {
      body: serialized.body,
      contentType: serialized.headers.get("content-type")
    }
  });
}

function decodeBase64(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function generateFromJSON(request, env, engine) {
  const body = await request.json();
  const prompt = String(body.prompt || "").trim();
  if (!prompt) return json({ ok:false, error:"prompt is required" }, 400);

  const form = new FormData();
  form.append("prompt", prompt);
  form.append("width", String(clampInt(body.width, 1024)));
  form.append("height", String(clampInt(body.height, 1024)));
  if (body.guidance != null) form.append("guidance", String(body.guidance));
  if (body.seed != null) form.append("seed", String(body.seed));
  if (engine === "dev") {
    const steps = Math.min(12, Math.max(8, Number(body.steps || 10)));
    form.append("steps", String(steps));
  }

  return runFlux(env, form, engine);
}

async function editFromMultipart(request, env, engine) {
  const incoming = await request.formData();
  const prompt = String(incoming.get("prompt") || "").trim();
  if (!prompt) return json({ ok:false, error:"prompt is required" }, 400);

  const form = new FormData();
  form.append("prompt", prompt);
  form.append("width", String(clampInt(incoming.get("width"), 1024)));
  form.append("height", String(clampInt(incoming.get("height"), 1024)));
  if (incoming.get("guidance") != null) form.append("guidance", String(incoming.get("guidance")));
  if (incoming.get("seed") != null) form.append("seed", String(incoming.get("seed")));
  if (engine === "dev") {
    const steps = Math.min(12, Math.max(8, Number(incoming.get("steps") || 10)));
    form.append("steps", String(steps));
  }

  let refs = 0;
  for (let i = 0; i < 4; i++) {
    const file = incoming.get(`input_image_${i}`);
    if (file instanceof File && file.size > 0) {
      if (!file.type.startsWith("image/")) {
        return json({ ok:false, error:`input_image_${i} must be an image` }, 400);
      }
      if (file.size > 6 * 1024 * 1024) {
        return json({ ok:false, error:`input_image_${i} is too large for this pilot endpoint` }, 413);
      }
      form.append(`input_image_${i}`, file, file.name || `reference-${i}.png`);
      refs++;
    }
  }

  if (!refs) {
    return json({ ok:false, error:"At least input_image_0 is required for /edit" }, 400);
  }

  return runFlux(env, form, engine);
}

async function toImageResponse(result, cors) {
  if (!result || !result.image) {
    return json({ ok:false, error:"Model returned no image", raw:result }, 502, cors);
  }
  return new Response(decodeBase64(result.image), {
    status: 200,
    headers: {
      "content-type": "image/jpeg",
      "cache-control": "no-store",
      ...cors
    }
  });
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === "OPTIONS") {
      return new Response(null, { status:204, headers:cors });
    }

    const url = new URL(request.url);
    const engine = url.searchParams.get("engine") || DEFAULT_ENGINE;
    if (!MODELS[engine]) {
      return json({ ok:false, error:"Unknown engine. Use ?engine=dev or ?engine=fast" }, 400, cors);
    }

    try {
      if (url.pathname === "/" || url.pathname === "/health") {
        return json({
          ok:true,
          service:"AWLA AI Worker",
          model:MODELS[DEFAULT_ENGINE],
          engines:MODELS,
          workersAI:true,
          routes:{
            "POST /generate":"JSON prompt -> JPEG",
            "POST /generate-json":"JSON prompt -> raw JSON/base64",
            "POST /edit":"multipart prompt + input_image_0..3 -> JPEG",
            "POST /edit-json":"multipart prompt + input_image_0..3 -> raw JSON/base64"
          }
        }, 200, cors);
      }

      if (request.method === "POST" && url.pathname === "/generate") {
        const result = await generateFromJSON(request, env, engine);
        if (result instanceof Response) {
          return new Response(result.body, { status:result.status, headers:{...Object.fromEntries(result.headers), ...cors} });
        }
        return toImageResponse(result, cors);
      }

      if (request.method === "POST" && url.pathname === "/generate-json") {
        const result = await generateFromJSON(request, env, engine);
        if (result instanceof Response) {
          return new Response(result.body, { status:result.status, headers:{...Object.fromEntries(result.headers), ...cors} });
        }
        return json({ ok:true, model:MODELS[engine], engine, result }, 200, cors);
      }

      if (request.method === "POST" && url.pathname === "/edit") {
        const result = await editFromMultipart(request, env, engine);
        if (result instanceof Response) {
          return new Response(result.body, { status:result.status, headers:{...Object.fromEntries(result.headers), ...cors} });
        }
        return toImageResponse(result, cors);
      }

      if (request.method === "POST" && url.pathname === "/edit-json") {
        const result = await editFromMultipart(request, env, engine);
        if (result instanceof Response) {
          return new Response(result.body, { status:result.status, headers:{...Object.fromEntries(result.headers), ...cors} });
        }
        return json({ ok:true, model:MODELS[engine], engine, result }, 200, cors);
      }

      return json({ ok:false, error:"Not found" }, 404, cors);
    } catch (error) {
      return json({ ok:false, error:error?.message || String(error) }, 500, cors);
    }
  }
};
