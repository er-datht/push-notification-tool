/**
 * Server-side proxy for POST /api/test_notification/auto_app_pushes.
 *
 * The X-APIToken is a shared secret, and the ecs-api path is not in the CORS allowlist, so the
 * browser must never call it directly. Do not put NEXT_PUBLIC_ in front of either env var. That
 * would copy the token into the browser bundle.
 */

const ENDPOINT = '/api/test_notification/auto_app_pushes'

/**
 * Same `messages[]` shape as the API's 400, so the client reads both the same way. The first
 * entry is the sentence the tester reads; the rest is raw detail like "TypeError: fetch failed".
 */
const problem = (status: number, description: string, detail: string[] = []) =>
  Response.json({ messages: [description, ...detail] }, { status })

export async function POST(req: Request) {
  const base = process.env.ECS_API_URL
  const token = process.env.TEST_NOTIFICATION_API_TOKEN

  const missing = [!base && 'ECS_API_URL', !token && 'TEST_NOTIFICATION_API_TOKEN'].filter(Boolean) as string[]
  if (missing.length) {
    return problem(500, 'The tool is not set up yet. Copy .env.example to .env.local and fill it in.', missing.map((name) => `${name} is not set`))
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return problem(400, 'The request body is not valid JSON.')
  }

  const url = `${base!.replace(/\/+$/, '')}${ENDPOINT}`
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-APIToken': token! },
      body: JSON.stringify(body),
      cache: 'no-store',
    })
  } catch (err) {
    return problem(502, `Could not reach ${url}. Check ECS_API_URL and whether staging is up.`, [String(err)])
  }

  // 401 and 404 have no body, so do not call res.json() on them.
  if (res.status === 401 || res.status === 404) {
    return new Response(null, { status: res.status })
  }

  // Pass 201 and 400 straight through. The client puts `messages[]` back into the form.
  const text = await res.text()
  if (!text) return new Response(null, { status: res.status })

  return new Response(text, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
  })
}
