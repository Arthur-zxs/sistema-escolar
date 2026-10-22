export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function api(path, { method = "GET", body, ...options } = {}) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
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
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    throw new ApiError("Não foi possível conectar à API. Verifique se o servidor está ativo.", 0);
  }

  if (response.status === 204) return null;

  const contentType = response.headers.get("content-type") || "";
  if (!/json/i.test(contentType)) {
    throw new ApiError(
      response.ok
        ? "A API retornou uma resposta inválida. Verifique se o servidor está ativo."
        : "Não foi possível comunicar com a API.",
      response.ok ? 502 : response.status,
    );
  }

  let result;
  try {
    result = await response.json();
  } catch {
    throw new ApiError("A API retornou uma resposta inválida.", response.status || 502);
  }

  if (!response.ok) {
    throw new ApiError(result?.error || "Não foi possível concluir a operação.", response.status);
  }
  return result;
}
