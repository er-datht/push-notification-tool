/**
 * Server-side proxy for POST /api/test_notification/auto_app_pushes.
 *
 * The X-APIToken is a shared secret, and the ecs-api path is not in the CORS allowlist, so the
 * browser must never call it directly. Do not put NEXT_PUBLIC_ in front of either env var. That
 * would copy the token into the browser bundle.
 */

const ENDPOINT = '/api/test_notification/auto_app_pushes'

/**
 * Same `error` object as the API's own failures, so the client reads both the same way. `title`
 * is the headline, `message` the sentence under it, `errors` raw detail like "TypeError: fetch failed".
 */
const problem = (status: number, code: string, title: string, message: string, errors: { field?: string; message: string }[] = []) =>
  Response.json({ error: { code, title, message, errors } }, { status })

export async function POST(req: Request) {
  const base = process.env.ECS_API_URL
  const token = process.env.TEST_NOTIFICATION_API_TOKEN

  const missing = [!base && 'ECS_API_URL', !token && 'TEST_NOTIFICATION_API_TOKEN'].filter(Boolean) as string[]
  if (missing.length) {
    return problem(
      500,
      'NOT_CONFIGURED',
      'The tool is not set up yet',
      'Copy .env.example to .env.local and fill it in.',
      missing.map((name) => ({ field: name, message: `${name} is not set` })),
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return problem(400, 'INVALID_JSON', 'Bad request', 'The request body is not valid JSON.')
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
    return problem(502, 'API_UNREACHABLE', 'Could not reach the API', `${url} did not answer. Check ECS_API_URL and whether staging is up.`, [
      { message: String(err) },
    ])
  }

  // 404 is the one response with no body, so do not call res.json() on it.
  if (res.status === 404) {
    return new Response(null, { status: res.status })
  }

  // Pass everything else straight through. The client puts `error.errors[]` back into the form.
  const text = await res.text()
  if (!text) return new Response(null, { status: res.status })

  return new Response(text, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
  })
}
