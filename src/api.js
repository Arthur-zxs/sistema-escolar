export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function api(path, { method = "GET", body, ...options } = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    method,
    credentials: "same-origin",
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(method !== "GET" ? { "X-Requested-With": "XMLHttpRequest" } : {}),
      ...options.headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (response.status === 204) return null;
  const result = await response.json();
  if (!response.ok) {
    throw new ApiError(result.error || "Não foi possível concluir a operação.", response.status);
  }
  return result;
}
