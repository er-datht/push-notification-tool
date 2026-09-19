/**
 * Server-side proxy for POST /api/test_notification/auto_app_pushes.
 *
 * The ecs-api path is not in the CORS allowlist, so the browser must never call it directly. The
 * X-APIToken comes from the token field on the page, one request at a time: the browser sends it
 * to this handler, which passes it on. It is never read from env or kept anywhere on the server.
 * Do not put NEXT_PUBLIC_ in front of ECS_API_URL either.
 */

const ENDPOINT = '/api/test_notification/auto_app_pushes'

/** The header the browser sends the token in. The same name the API expects, so it is passed on as-is. */
const TOKEN_HEADER = 'X-APIToken'

/**
 * Same `error` object as the API's own failures, so the client reads both the same way. `title`
 * is the headline, `message` the sentence under it, `errors` raw detail like "TypeError: fetch failed".
 */
const problem = (status: number, code: string, title: string, message: string, errors: { field?: string; message: string }[] = []) =>
  Response.json({ error: { code, title, message, errors } }, { status })

export async function POST(req: Request) {
  const base = process.env.ECS_API_URL
  if (!base) {
    return problem(500, 'NOT_CONFIGURED', 'The tool is not set up yet', 'Copy .env.example to .env.local and fill it in.', [
      { field: 'ECS_API_URL', message: 'ECS_API_URL is not set' },
    ])
  }

  // The page blocks Execute on an empty token, so this only answers a request made by hand.
  const token = req.headers.get(TOKEN_HEADER)?.trim()
  if (!token) {
    return problem(401, 'NO_TOKEN', 'API token missing', 'Enter the API token and try again.')
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return problem(400, 'INVALID_JSON', 'Bad request', 'The request body is not valid JSON.')
  }

  const url = `${base.replace(/\/+$/, '')}${ENDPOINT}`
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', [TOKEN_HEADER]: token },
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
