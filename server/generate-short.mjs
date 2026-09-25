/**
 * Server-only Source → Short generation for Creator Lab.
 * The browser sends transcript context + one selected grounded moment.
 * No credential may ever be returned to the client.
 */

function clean(value, max = 2000) {
  return String(value || "").slice(0, max);
}

export async function generateShort(body = {}) {
  const token = process.env.SKYCASTLE_LLM_TOKEN;

  if (!token) {
    return {
      ok: false,
      error: "SERVER_SHORT_GENERATION_NOT_CONFIGURED"
    };
  }

  const source = body.source || {};
  const moment = body.moment || {};
  const target = body.target || {};

  const payload = {
    source: {
      title: clean(source.title, 200),
      duration: Number(source.duration) || 0
    },
    moment: {
      id: clean(moment.id, 80),
      start: Number(moment.start) || 0,
      end: Number(moment.end) || 0,
      type: clean(moment.type, 80),
      description: clean(moment.description, 600),
      evidence: clean(moment.evidence, 1200),
      provenance: clean(moment.provenance, 120)
    },
    transcriptContext: clean(body.transcriptContext, 4000),
    mechanism: clean(body.mechanism, 600),
    target: {
      platform: clean(target.platform, 80) || "TikTok",
      audience: clean(target.audience, 120) || "General",
      goal: clean(target.goal, 120) || "Views",
      durationSeconds: Math.max(4, Math.min(15, Number(target.durationSeconds) || 8)),
      aspectRatio: clean(target.aspectRatio, 20) || "9:16"
    }
  };

  const systemPrompt = [
    "You are Creator Lab's Source → Short agent.",
    "You receive one grounded moment from a source video plus nearby transcript context.",
    "Your job is to extract the storytelling mechanism and create THREE original short-video concepts.",
    "",
    "Important originality rules:",
    "- Preserve the underlying idea, factual topic, and storytelling mechanism when useful.",
    "- Do NOT quote, closely paraphrase, imitate, or reproduce the source creator's distinctive wording.",
    "- Do NOT create a remake shot-for-shot.",
    "- If a reference image contains an identifiable real person, treat it as composition/environment reference unless the uploader has permission to reproduce that likeness.",
    "- Do NOT invent factual claims that are not supported by the supplied source context.",
    "",
    "Each concept must be executable as an 8-second AI Studio / Veo-style vertical video.",
    "The three concepts must be meaningfully different: Proof First, Tension First, and Original Reframe.",
    "",
    "Return JSON only, using this exact schema:",
    "{",
    '  "variants": [',
    "    {",
    '      "name": string,',
    '      "hook": string,',
    '      "script": string,',
    '      "overlay": string,',
    '      "mechanism": string,',
    '      "prompt": string',
    "    }",
    "  ]",
    "}",
    "",
    "The prompt field must be a complete paste-ready AI Studio video prompt.",
    "It must specify: 9:16 vertical, duration, reference-image handling, 0-2s / 2-5.5s / 5.5-8s shot plan, voiceover intent, on-screen text, visual continuity, and originality constraints.",
    "Keep spoken copy short enough to be believable within the requested duration."
  ].join("\n");

  const response = await fetch("https://skycastle.ai/api/capabilities/llm", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(payload) }
      ]
    })
  });

  if (!response.ok) {
    return {
      ok: false,
      error: "LLM_REQUEST_FAILED"
    };
  }

  const data = await response.json();
  const raw = data?.choices?.[0]?.message?.content;

  if (!raw) {
    return {
      ok: false,
      error: "EMPTY_LLM_RESPONSE"
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(
      String(raw)
        .replace(/^\`\`\`json\s*/i, "")
        .replace(/\`\`\`$/i, "")
        .trim()
    );
  } catch {
    return {
      ok: false,
      error: "INVALID_LLM_JSON"
    };
  }

  const variants = Array.isArray(parsed?.variants)
    ? parsed.variants.slice(0, 3).map((variant, index) => ({
        name: clean(variant?.name, 80) || ["Proof First", "Tension First", "Original Reframe"][index] || "Short Variant",
        hook: clean(variant?.hook, 500),
        script: clean(variant?.script, 1200),
        overlay: clean(variant?.overlay, 240),
        mechanism: clean(variant?.mechanism, 600),
        prompt: clean(variant?.prompt, 6000)
      }))
    : [];

  if (!variants.length) {
    return {
      ok: false,
      error: "NO_VARIANTS"
    };
  }

  return {
    ok: true,
    variants
  };
}
