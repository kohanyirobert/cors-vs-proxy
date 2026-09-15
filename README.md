# CORS, and why the proxy "did not work"

A minimal, runnable demo. One endpoint, two backends (Spring Boot and
ASP.NET), one Vite frontend. Everything below was measured against these
projects, not quoted from documentation.

The point it exists to make: **a dev proxy and a backend CORS config are two
different answers to the same question, and switching to the proxy without
deleting the CORS config is what breaks.**

---

## The setup

```
frontend/         Vite + React, pinned to port 5174, proxies /api -> :8080
backend-spring/   Spring Boot 4.1.1, Java 25, port 8080
backend-aspnet/   ASP.NET minimal API, .NET 10, port 8080
```

Both backends expose exactly one endpoint, `POST /api/register`, and both take a
`CORS_MODE` environment variable so the whole matrix can be demonstrated without
editing code:

| `CORS_MODE` | meaning |
|---|---|
| `none` (default) | no CORS configuration at all. Correct when a proxy is in front, and correct in production when no other site consumes the API. |
| `wrong` | allows one hardcoded origin, `http://localhost:5173`. The line everybody copies from Stack Overflow. |
| `open` | allows the origin the frontend actually runs on. |

The frontend is pinned to **5174 on purpose**. Vite normally takes 5173 and
silently moves to 5174 when it is busy, which is how a hardcoded
`@CrossOrigin("http://localhost:5173")` starts failing for one person on the
team and nobody else.

## Running it

Two terminals. Backend first:

```bash
# Spring
cd backend-spring && ./mvnw spring-boot:run
# or a specific mode:
CORS_MODE=wrong ./mvnw spring-boot:run

# ASP.NET, same endpoint, same port, run one at a time
cd backend-aspnet && ASPNETCORE_URLS=http://localhost:8080 dotnet run
CORS_MODE=wrong ASPNETCORE_URLS=http://localhost:8080 dotnet run
```

Then the frontend:

```bash
cd frontend && npm install && npm run dev   # http://localhost:5174
```

The page has two buttons for the same request:

- **`POST /api/register`** goes through the Vite proxy. Same-origin as far as
  the browser is concerned, so CORS never applies.
- **`POST http://localhost:8080/api/register`** goes straight to the backend.
  Cross-origin, so CORS applies.

Watch three places at once: the browser console, the backend console, and the
**terminal running Vite**, which prints every proxied request, the headers it
forwards, and the response.

---

## What actually happens

### Spring Boot, measured

Actual `POST`, and the `OPTIONS` preflight in brackets:

| `CORS_MODE` | proxy, `changeOrigin: false` | proxy, `changeOrigin: true` | direct from the browser |
|---|---|---|---|
| `none` | 200 (preflight 200) | 200 (preflight 200) | **blocked**, no `Access-Control-Allow-Origin` |
| `wrong` | 200 (preflight 200) | **403 `Invalid CORS request`** (preflight 403) | **blocked**, 5174 is not 5173 |
| `open` | 200 | 200 (preflight 200, `ACAO: http://localhost:5174`) | works |

**Exactly one cell fails, and it is the one the students hit.**

### ASP.NET, measured

| `CORS_MODE` | actual POST | preflight | `Access-Control-Allow-Origin` |
|---|---|---|---|
| `none` | 200 | **405**, there is no OPTIONS handler | absent |
| `wrong` | 200 | 204 | **absent**, the origin is not allowed |
| `open` | 200 | 204 | present |

**ASP.NET never returns 403.** A disallowed origin does not reject the request,
it just omits the `Access-Control-Allow-Origin` header and lets the request run.
The *browser* is what blocks the response. Spring is the opposite: its
`DefaultCorsProcessor` actively rejects with `403 Invalid CORS request`, which
is visible in curl and in the proxy log, with no browser involved.

That difference matters when you debug: a broken CORS config on ASP.NET is
invisible from the server side, and obvious on Spring.

---

## Why the proxy "did not work"

The proxy is a server. When the browser asks `http://localhost:5174/api/register`
that is same-origin, the browser applies no CORS at all, and the request reaches
Vite. Vite then makes a **fresh server-to-server request** to
`http://localhost:8080/api/register`. No browser, no CORS.

But Vite forwards the browser's headers, **including `Origin`**. So the backend
still sees `Origin: http://localhost:5174` and, if it has a CORS config, applies
it. `changeOrigin` decides whether the backend considers that a cross-origin
call:

| `changeOrigin` | `Host` sent on | `Origin` sent on | Spring's view |
|---|---|---|---|
| `false` | `localhost:5174` | `http://localhost:5174` | they match, so **same-origin**, CORS skipped entirely |
| `true` | `localhost:8080` | `http://localhost:5174` | they differ, so **cross-origin**, the CORS config is enforced |

`changeOrigin: true` is what the Vite docs and every tutorial show. Combined
with a leftover `@CrossOrigin("http://localhost:5173")` on a frontend that is
running on 5174, you get:

```
403  Invalid CORS request
```

which reads like the proxy is broken. It is not. The proxy is working perfectly
and faithfully delivering a request the backend has been configured to refuse.

### The fix

**Delete the CORS configuration from the backend.** That is the whole point of
proxying. `CORS_MODE=none` passes every cell of the table above.

Setting `changeOrigin: false` also makes the symptom disappear, because Host and
Origin match again and Spring stops treating it as CORS. It works, but it hides
a stale config rather than removing it, so prefer deleting the config.

---

## When do you actually want CORS?

Only when a **browser on another origin** must call your API:

- your API is a public one that third party sites consume
- your frontend and backend are genuinely on different domains in production
  and you are not putting a reverse proxy or gateway in front of them

For the projects on this course neither is true, so the answer is a proxy in
development and same-origin serving in production. Leave CORS off and keep the
API closed.

And the thing worth saying out loud: **CORS is a browser rule, not a security
boundary.** `curl`, Postman, a mobile app and any server ignore it completely.
It protects a logged-in user's browser from a malicious page spending their
cookies; it does not protect your API. Authentication and authorisation do that.

## Reading the proxy log

`frontend/vite.config.js` hooks the proxy's own events and prints, for every
call, the headers being forwarded, whether it is a preflight, the status that
came back, and any `Access-Control-*` headers on the response. It is about
thirty lines of plain JavaScript, worth reading on screen, because it makes the
proxy stop being magic:

```
[proxy] -> outgoing POST /api/register
[proxy]    headers we forward: {"Host":"localhost:8080","Origin":"http://localhost:5174", ...}
[proxy]    note: an Origin header is still going to the backend, so the backend
[proxy]          still thinks this is a cross-origin call even though the browser does not.
[proxy] <- backend answered 403 for POST /api/register
[proxy]    CORS headers it sent back: (none, and that is fine through a proxy)
```

## A five minute demo script

1. `CORS_MODE=none`, press the **direct** button. Browser blocks it. Show the
   console message, and that the `catch` block only ever sees
   `TypeError: Failed to fetch` with no detail. That is deliberate.
2. Press the **proxy** button. 200. Show the Vite log: the request really did
   reach the backend, and the backend really did see an `Origin` header.
3. Restart the backend with `CORS_MODE=wrong`. Press the **proxy** button.
   `403 Invalid CORS request` on Spring. Ask what changed. Nothing in the
   frontend did.
4. Show the `changeOrigin` table. Set `CORS_MODE=none` again and watch it pass.
5. Close on: the proxy did not fail, the backend was told to refuse that origin.
