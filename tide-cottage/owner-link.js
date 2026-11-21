const ownerPage = location.origin === "https://lanzier.github.io" &&
  location.pathname === "/tide-cottage/";
const storageKey = "tide-cottage:chat-access";
const routeUrl = "https://gist.githubusercontent.com/Lanzier/7240deb50a14569b6b1cd6f2fd91032b/raw/route.json";

if (ownerPage) {
  const form = document.getElementById("owner-connect");
  const code = document.getElementById("owner-code");
  const status = document.getElementById("owner-status");
  let access = "";
  let endpoint;
  try { access = sessionStorage.getItem(storageKey) || ""; } catch {}

  function update(message) {
    status.textContent = message;
    form.hidden = Boolean(access);
  }

  function connectionError() {
    endpoint = undefined;
    return Object.assign(new Error("暂时连不上 Ww，请稍后再试。"), { retryable: true });
  }

  async function request(value, path, body) {
    let response;
    const headers = {
      "Content-Type": "application/json",
      Authorization: "Bearer " + value,
    };
    try {
      if (!endpoint) {
        const route = await fetch(routeUrl, { cache: "no-store", signal: AbortSignal.timeout(12000) });
        if (!route.ok) throw new Error();
        const data = await route.json();
        if (!/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(data.endpoint)) throw new Error();
        endpoint = data.endpoint;
      }
      response = await fetch(endpoint + "/" + path, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        redirect: "error",
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      throw connectionError();
    }
    if (response.status === 401) {
      access = "";
      try { sessionStorage.removeItem(storageKey); } catch {}
      update("需要有效的连接码。");
      throw new Error("连接码无效，请重新连接。");
    }
    let result;
    try {
      result = await response.json();
    } catch {
      throw connectionError();
    }
    if (!response.ok) throw new Error(result.error || "Ww 暂时无法回复。");
    return result;
  }

  update(access ? "已保存本次连接" : "输入连接码，和 Ww 开始私聊。");
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const value = code.value.trim();
    if (!value) return;
    const button = form.querySelector("button");
    button.disabled = true;
    status.textContent = "正在连接 AstrBot…";
    try {
      await request(value, "connect", {});
      access = value;
      try { sessionStorage.setItem(storageKey, value); } catch {}
      code.value = "";
      update("已连接 AstrBot");
    } catch (error) {
      update(error.message);
    } finally {
      button.disabled = false;
    }
  });

  window.tideOwnerChat = async text => {
    if (!access) throw new Error("先在聊天框上方输入连接码。");
    const id = crypto.randomUUID();
    status.textContent = "正在发送…";
    try {
      try {
        await request(access, "chat/start", { id, text });
      } catch (error) {
        if (!error.retryable) throw error;
        await request(access, "chat/start", { id, text });
      }
      status.textContent = "消息已送达，等 Ww 回复…";
      const deadline = Date.now() + 105000;
      while (Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 1800));
        try {
          const result = await request(access, "chat/result", { id });
          if (typeof result.reply === "string") {
            status.textContent = "已连接 AstrBot";
            return result.reply;
          }
        } catch (error) {
          if (!error.retryable) throw error;
        }
      }
      throw new Error("消息已送达，等待 Ww 回复超时。");
    } catch (error) {
      if (access) status.textContent = "本次聊天未完成";
      throw error;
    }
  };
}
