export interface HttpStubResponse { status: number; body: unknown; headers?: Record<string, string>; }

export function createHttpStub(routes: Record<string, HttpStubResponse>) {
  const calls: string[] = [];
  return {
    calls: () => [...calls],
    fetcher: async (input: string | URL | Request): Promise<Response> => {
      const url = String(input);
      calls.push(url);
      const route = routes[url];
      if (!route) throw new Error(`Unexpected outbound request: ${url}`);
      return new Response(JSON.stringify(route.body), { status: route.status, headers: { "content-type": "application/json", ...route.headers } });
    },
  };
}
