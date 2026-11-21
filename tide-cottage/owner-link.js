const ownerPage = location.origin === "https://lanzier.github.io" &&
  location.pathname === "/tide-cottage/";
const storageKey = "tide-cottage:chat-access";

if (ownerPage) {
  const form = document.getElementById("owner-connect");
  const code = document.getElementById("owner-code");
  const status = document.getElementById("owner-status");
  let access = "";
  try { access = sessionStorage.getItem(storageKey) || ""; } catch {}

  function update(message) {
    status.textContent = message;
    form.hidden = Boolean(access);
  }

  async function request(value, path, body) {
    let response;
    try {
      response = await fetch("http://127.0.0.1:6188/" + path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + value,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(105000),
      });
    } catch {
      throw new Error("无法连接本机 AstrBot。请确认桥接正在运行，并在浏览器提示时允许访问本地网络。");
    }
    if (response.status === 401) {
      access = "";
      try { sessionStorage.removeItem(storageKey); } catch {}
      update("需要有效的连接码。");
      throw new Error("连接码无效，请重新连接。");
    }
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Ww 暂时无法回复。");
    return result;
  }

  update(access ? "已保存本次连接" : "输入连接码，连接本机 AstrBot。");
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
    const result = await request(access, "chat", { text });
    status.textContent = "已连接 AstrBot";
    return result.reply;
  };
}
