const { createApp, ref, reactive, computed, onMounted } = Vue;

createApp({
  setup() {
    const token = ref(Auth.getToken());
    const view = ref("login");
    const user = ref(null);
    const posts = ref([]);
    const notice = reactive({ message: "", type: "success" });
    const postFile = ref(null);
    const busy = reactive({
      login: false,
      register: false,
      forgot: false,
      reset: false,
      requestVerify: false,
      verify: false,
      logout: false,
      posts: false,
      createPost: false,
      deleting: "",
      profile: false,
      updateProfile: false,
    });
    const forms = reactive({
      login: { email: "", password: "" },
      register: { email: "", password: "", confirmPassword: "" },
      forgot: { email: "" },
      reset: {
        token: new URLSearchParams(location.search).get("token") || "",
        password: "",
      },
      requestVerify: { email: "" },
      verify: {
        token: new URLSearchParams(location.search).get("token") || "",
      },
      post: { caption: "" },
      profile: { email: "", password: "" },
    });
    const isAuthenticated = computed(() => Boolean(token.value));

    function message(text, type = "success") {
      notice.message = text;
      notice.type = type;
    }
    function clearSession() {
      Auth.clearToken();
      token.value = null;
      user.value = null;
      posts.value = [];
    }
    function handleError(error) {
      if (error.status === 401) {
        clearSession();
        view.value = "login";
        message("Your session has expired. Please sign in again.", "error");
        return;
      }
      message(
        error.message || "Something went wrong. Please try again.",
        "error",
      );
    }
    async function run(key, action) {
      busy[key] = true;
      try {
        return await action();
      } catch (error) {
        handleError(error);
        return undefined;
      } finally {
        busy[key] = false;
      }
    }
    async function loadProfile() {
      const result = await run("profile", () => Api.me());
      if (result) {
        user.value = result;
        forms.profile.email = result.email || "";
      }
      return result;
    }
    async function loadPosts() {
      const result = await run("posts", () => Api.posts());
      if (result) posts.value = result;
    }
    async function enterDashboard() {
      view.value = "posts";
      await Promise.all([loadProfile(), loadPosts()]);
    }
    async function go(next) {
      if ((next === "posts" || next === "profile") && !isAuthenticated.value) {
        view.value = "login";
        return;
      }
      view.value = next;
      if (next === "posts") await loadPosts();
      if (next === "profile") await loadProfile();
    }
    async function login() {
      if (!forms.login.email || !forms.login.password)
        return message("Enter both email and password.", "error");
      const result = await run("login", () =>
        Api.login(forms.login.email, forms.login.password),
      );
      if (result?.access_token) {
        Auth.setToken(result.access_token);
        token.value = result.access_token;
        forms.login.password = "";
        message("Signed in successfully.");
        await enterDashboard();
      }
    }
    async function register() {
      if (forms.register.password !== forms.register.confirmPassword)
        return message("Passwords do not match.", "error");
      const result = await run("register", () =>
        Api.register({
          email: forms.register.email,
          password: forms.register.password,
        }),
      );
      if (result) {
        forms.login.email = forms.register.email;
        forms.register.password = "";
        forms.register.confirmPassword = "";
        view.value = "login";
        message("Account created. You can now sign in.");
      }
    }
    async function forgotPassword() {
      if (!forms.forgot.email)
        return message("Enter your email address.", "error");
      const result = await run("forgot", () =>
        Api.forgotPassword(forms.forgot.email),
      );
      if (result !== undefined)
        message(
          "If an account exists, reset instructions have been requested.",
        );
    }
    async function resetPassword() {
      if (!forms.reset.token || !forms.reset.password)
        return message("Enter the reset token and a new password.", "error");
      const result = await run("reset", () =>
        Api.resetPassword(forms.reset.token, forms.reset.password),
      );
      if (result !== undefined) {
        view.value = "login";
        message("Password reset successfully. Please sign in.");
      }
    }
    async function requestVerification() {
      if (!forms.requestVerify.email)
        return message("Enter your email address.", "error");
      const result = await run("requestVerify", () =>
        Api.requestVerify(forms.requestVerify.email),
      );
      if (result !== undefined)
        message(
          "If verification is available for this account, a token has been requested.",
        );
    }
    async function verifyEmail() {
      if (!forms.verify.token)
        return message("Enter the verification token.", "error");
      const result = await run("verify", () => Api.verify(forms.verify.token));
      if (result) {
        view.value = "login";
        message("Email verified. You can now sign in.");
      }
    }
    async function logout() {
      await run("logout", () => Api.logout());
      clearSession();
      view.value = "login";
      message(
        "You have signed out. JWT logout is stateless: it clears this browser token but does not revoke an already-issued token server-side.",
      );
    }
    async function createPost() {
      const file = postFile.value?.files?.[0];
      if (!forms.post.caption || !file)
        return message("Provide both a caption and a file.", "error");
      const data = new FormData();
      data.append("caption", forms.post.caption);
      data.append("file", file);
      const result = await run("createPost", () => Api.createPost(data));
      if (result) {
        forms.post.caption = "";
        postFile.value.value = "";
        message("Post uploaded.");
        await loadPosts();
      }
    }
    async function deletePost(post) {
      if (!confirm(`Delete “${post.caption || "this post"}”?`)) return;
      const result = await run("deleting", () => {
        busy.deleting = post.id;
        return Api.deletePost(post.id);
      });
      busy.deleting = "";
      if (result !== undefined) {
        message("Post deleted.");
        await loadPosts();
      }
    }
    async function updateProfile() {
      const update = {};
      if (forms.profile.email && forms.profile.email !== user.value?.email)
        update.email = forms.profile.email;
      if (forms.profile.password) update.password = forms.profile.password;
      if (!Object.keys(update).length)
        return message("There are no changes to save.", "error");
      const result = await run("updateProfile", () => Api.updateMe(update));
      if (result) {
        user.value = result;
        forms.profile.email = result.email;
        forms.profile.password = "";
        message("Profile updated.");
      }
    }
    function isImage(post) {
      return (
        post.file_type === "image" ||
        /\.(png|jpe?g|gif|webp|svg)$/i.test(post.file_name || post.url || "")
      );
    }
    function formatDate(value) {
      if (!value) return "Unknown date";
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
    }
    onMounted(async () => {
      const queryView = new URLSearchParams(location.search).get("view");
      if (queryView === "reset" || queryView === "verify")
        view.value = queryView;
      if (isAuthenticated.value) await enterDashboard();
    });
    return {
      view,
      user,
      posts,
      notice,
      busy,
      forms,
      postFile,
      isAuthenticated,
      go,
      login,
      register,
      forgotPassword,
      resetPassword,
      requestVerification,
      verifyEmail,
      logout,
      loadPosts,
      createPost,
      deletePost,
      updateProfile,
      isImage,
      formatDate,
    };
  },
}).mount("#app");
