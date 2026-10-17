const RUN_ID_HEADER = "X-Lovable-AIG-Run-ID";

export const getLovableAiGatewayRunId = (request: Request) =>
  request.headers.get(RUN_ID_HEADER) ?? undefined;

export const createLovableAiGatewayRunIdFetch = (initialRunId?: string) => {
  let runId = initialRunId;
  return {
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (runId) headers.set(RUN_ID_HEADER, runId);
      const response = await fetch(input, { ...init, headers });
      runId = response.headers.get(RUN_ID_HEADER) ?? runId;
      return response;
    },
    getRunId: () => runId,
  };
};

export const withLovableAiGatewayRunIdHeader = (
  response: Response,
  tracker: { getRunId: () => string | undefined },
) => {
  const runId = tracker.getRunId();
  if (runId) response.headers.set(RUN_ID_HEADER, runId);
  return response;
};
