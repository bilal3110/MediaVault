window.API_BASE_URL = window.APP_CONFIG?.apiBaseUrl || "http://127.0.0.1:8000";

window.Api = (() => {
  function errorMessage(payload, fallback) {
    if (!payload) return fallback;
    if (typeof payload.detail === "string")
      return payload.detail.replaceAll("_", " ");
    if (payload.detail?.reason) return payload.detail.reason;
    if (Array.isArray(payload.detail))
      return payload.detail
        .map((item) => item.msg || "Invalid value")
        .join(". ");
    return fallback;
  }

  async function request(
    path,
    { method = "GET", body, headers = {}, auth = true } = {},
  ) {
    const requestHeaders = new Headers(headers);
    const token = window.Auth.getToken();
    if (auth && token) requestHeaders.set("Authorization", `Bearer ${token}`);
    const isFormBody =
      body instanceof FormData || body instanceof URLSearchParams;
    if (body && !isFormBody && !requestHeaders.has("Content-Type"))
      requestHeaders.set("Content-Type", "application/json");
    try {
      const response = await fetch(`${window.API_BASE_URL}${path}`, {
        method,
        headers: requestHeaders,
        body: isFormBody ? body : body ? JSON.stringify(body) : undefined,
      });
      const contentType = response.headers.get("content-type") || "";
      const data = contentType.includes("application/json")
        ? await response.json()
        : null;
      if (!response.ok) {
        const error = new Error(
          errorMessage(data, `Request failed (${response.status})`),
        );
        error.status = response.status;
        error.payload = data;
        throw error;
      }
      return data;
    } catch (error) {
      if (error instanceof TypeError)
        throw new Error(
          "Cannot reach the API. Confirm that FastAPI is running and CORS allows this origin.",
        );
      throw error;
    }
  }

  return {
    request,
    login: (email, password) =>
      request("/auth/jwt/login", {
        method: "POST",
        auth: false,
        body: new URLSearchParams({ username: email, password }),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }),
    register: (body) =>
      request("/auth/register", { method: "POST", auth: false, body }),
    forgotPassword: (email) =>
      request("/auth/forgot-password", {
        method: "POST",
        auth: false,
        body: { email },
      }),
    resetPassword: (token, password) =>
      request("/auth/reset-password", {
        method: "POST",
        auth: false,
        body: { token, password },
      }),
    requestVerify: (email) =>
      request("/auth/request-verify-token", {
        method: "POST",
        auth: false,
        body: { email },
      }),
    verify: (token) =>
      request("/auth/verify", { method: "POST", auth: false, body: { token } }),
    logout: () => request("/auth/jwt/logout", { method: "POST" }),
    me: () => request("/users/me"),
    updateMe: (body) => request("/users/me", { method: "PATCH", body }),
    posts: () => request("/posts/"),
    createPost: (body) => request("/posts/", { method: "POST", body }),
    deletePost: (id) =>
      request(`/posts/${encodeURIComponent(id)}`, { method: "DELETE" }),
    userById: (id) => request(`/users/${encodeURIComponent(id)}`),
    updateUser: (id, body) =>
      request(`/users/${encodeURIComponent(id)}`, { method: "PATCH", body }),
    deleteUser: (id) =>
      request(`/users/${encodeURIComponent(id)}`, { method: "DELETE" }),
  };
})();
