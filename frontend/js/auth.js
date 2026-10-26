window.Auth = (() => {
  const TOKEN_KEY = 'post_registry_access_token';
  return {
    getToken: () => localStorage.getItem(TOKEN_KEY),
    setToken: (token) => localStorage.setItem(TOKEN_KEY, token),
    clearToken: () => localStorage.removeItem(TOKEN_KEY),
  };
})();
