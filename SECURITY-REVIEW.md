# Pre-deployment security review

Date: 2026-10-16

## Findings

| Severity | File | Lines | Finding | Resolution |
| --- | --- | --- | --- | --- |
| CRITICAL | `app/api/upload/postimages/route.ts:7-18` | Upload endpoint accepted unauthenticated requests, trusted arbitrary MIME types, and returned attacker-controlled data URLs. | Require the `adminToken` cookie, reject non-image and SVG uploads, and fail with `502` when both upstream services fail. |
| WARNING | `middleware.ts:4-9` | Admin-page routing was based only on cookie presence, so a fabricated cookie could pass the UI gate. | The proxy and upload API now require the cookie and forward it as a bearer token for backend authorization. The backend remains the authority for token validity. |
| WARNING | `app/api/auth/login/route.ts:10`, `app/api/proxy/[...path]/route.ts:8` | Missing configuration silently sent credentials and API traffic to plaintext localhost. | Use server-only `BACKEND_API_BASE_URL`, fail when absent, and require HTTPS in production. |
| WARNING | `app/api/proxy/[...path]/route.ts:21-27` | The proxy forwarded client cookies and returned all backend response headers. | Remove the incoming `cookie` header and return only safe response headers. |

## Verification

- `npm.cmd run build` passed successfully before the hardening changes.
- `npm.cmd run lint` completed with warnings but no errors.
- `npm.cmd audit --omit=dev` reported no production dependency vulnerabilities.

## Deployment configuration

Set `BACKEND_API_BASE_URL` to the HTTPS backend URL in production. Keep `POSTIMAGES_API_KEY` server-only; it must not use a `NEXT_PUBLIC_` prefix.
