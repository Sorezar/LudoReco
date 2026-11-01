// Forwards /api/* to the Python API, so the browser only talks to this app (no CORS, API address set at runtime)
const API_URL = process.env.API_URL ?? "http://localhost:8000";

async function forward(request: Request, { params }: RouteContext<"/api/[...path]">) {
  const { path } = await params;
  const url = new URL(path.join("/"), API_URL + "/");
  url.search = new URL(request.url).search;
  try {
    const response = await fetch(url, {
      method: request.method,
      headers: { "Content-Type": "application/json" },
      body: request.method === "POST" ? await request.text() : undefined,
    });
    return new Response(response.body, { status: response.status, headers: { "Content-Type": "application/json" } });
  } catch {
    return Response.json({ detail: "The recommendation API is not reachable" }, { status: 502 });
  }
}

export { forward as GET, forward as POST };
