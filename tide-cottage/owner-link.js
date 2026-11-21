const publicPage = "https://lanzier.github.io/tide-cottage/";
const publicOrigin = new URL(publicPage).origin;
const localOrigin = "http://127.0.0.1:6187";
const channel = "tide-cottage-private";

if (location.origin === localOrigin && window.tideOwnerChat) {
  const button = document.getElementById("open-online-private");
  button.hidden = false;
  let pairing;
  button.addEventListener("click", () => {
    const nonce = crypto.randomUUID();
    const tab = window.open(publicPage + "#ww=" + nonce, "_blank");
    if (!tab) {
      button.textContent = "请允许打开新标签页";
      return;
    }
    pairing = { nonce, tab };
  });

  window.addEventListener("message", async event => {
    const { data } = event;
    if (!pairing || event.origin !== publicOrigin || event.source !== pairing.tab ||
        data?.channel !== channel || data.nonce !== pairing.nonce) return;

    const respond = payload => event.source.postMessage(
      { channel, nonce: data.nonce, ...payload }, publicOrigin,
    );
    if (data.type === "hello") {
      respond({ type: "ready" });
    } else if (data.type === "chat" && typeof data.id === "string" &&
               typeof data.text === "string" && data.text.length <= 180) {
      try {
        respond({ type: "result", id: data.id, reply: await window.tideOwnerChat(data.text) });
      } catch (error) {
        respond({ type: "result", id: data.id, error: error.message });
      }
    }
  });
}

const publicCottage = location.origin === publicOrigin && location.pathname === new URL(publicPage).pathname;
const pairingKey = "tide-cottage:owner-pair";
let privateNonce;
if (publicCottage && window.opener) {
  privateNonce = new URLSearchParams(location.hash.slice(1)).get("ww");
  try {
    if (privateNonce) sessionStorage.setItem(pairingKey, privateNonce);
    else privateNonce = sessionStorage.getItem(pairingKey);
  } catch {
    // Pairing still works without storage until the page is refreshed.
  }
}
if (publicCottage && privateNonce) {
  history.replaceState(null, "", location.pathname + location.search);
  const parentTab = window.opener;
  const pending = new Map();
  let ready;
  const connected = new Promise(resolve => { ready = resolve; });
  const post = payload => parentTab?.postMessage(
    { channel, nonce: privateNonce, ...payload }, localOrigin,
  );

  window.addEventListener("message", event => {
    const { data } = event;
    if (event.origin !== localOrigin || event.source !== parentTab ||
        data?.channel !== channel || data.nonce !== privateNonce) return;
    if (data.type === "ready") ready(true);
    if (data.type !== "result" || !pending.has(data.id)) return;
    const { resolve, reject, timer } = pending.get(data.id);
    clearTimeout(timer);
    pending.delete(data.id);
    if (typeof data.reply === "string") resolve(data.reply);
    else reject(new Error(data.error || "Ww 暂时无法回复。"));
  });

  window.tideOwnerChat = async text => {
    if (parentTab?.closed || !await Promise.race([
      connected,
      new Promise(resolve => setTimeout(resolve, 2500, false)),
    ])) {
      throw new Error("私人聊天未连接。请从本机入口重新打开，并保留连接标签页。");
    }
    return new Promise((resolve, reject) => {
      const id = crypto.randomUUID();
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error("等待 Ww 回复超时。"));
      }, 100000);
      pending.set(id, { resolve, reject, timer });
      post({ type: "chat", id, text });
    });
  };
  post({ type: "hello" });
}
