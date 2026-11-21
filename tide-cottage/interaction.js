export function readStorage(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(`tide-cottage:${key}`)) ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeStorage(key, value) {
  try {
    localStorage.setItem(`tide-cottage:${key}`, JSON.stringify(value));
  } catch {
    // The scene remains usable when browser storage is unavailable.
  }
}

function photoRequest(text) {
  if (/第一人称|从你(?:的)?视角|你(?:现在|此刻)?(?:看见|看到)了?什么|拍.{0,8}你眼前/.test(text)) return "view";
  if (/自拍|(?:拍|截).{0,16}(?:照|图)|(?:照片|截图).{0,12}(?:在干嘛|在干什么|在做什么)/.test(text)) return "portrait";
  return null;
}

function asksAboutActivity(text) {
  return /^(?:Ww[\s，,：:]*)?(?:你)?(?:现在|此刻|这会儿)?在(?:干嘛|干啥|干什么|做什么|做啥|忙什么|忙啥)(?:呢|呀|啊|嘛)?[？?。！!]*$/i.test(text);
}

function enableChatResize(panel) {
  const handle = panel.querySelector("#chat-resize");
  let drag;

  function setSize(width, height) {
    panel.style.setProperty("--chat-width", `${Math.max(235, Math.min(width, panel.offsetLeft + panel.offsetWidth - 10))}px`);
    panel.style.setProperty("--chat-height", `${Math.max(205, Math.min(height, panel.offsetTop + panel.offsetHeight - 18))}px`);
  }

  handle.addEventListener("pointerdown", event => {
    if (event.button !== 0 || drag) return;
    handle.setPointerCapture(event.pointerId);
    drag = { x: event.clientX, y: event.clientY, width: panel.offsetWidth, height: panel.offsetHeight };
  });
  handle.addEventListener("pointermove", event => {
    if (drag && handle.hasPointerCapture(event.pointerId)) {
      setSize(drag.width + drag.x - event.clientX, drag.height + drag.y - event.clientY);
    }
  });
  handle.addEventListener("lostpointercapture", () => { drag = undefined; });
  handle.addEventListener("keydown", event => {
    const delta = { ArrowLeft: [16, 0], ArrowRight: [-16, 0], ArrowUp: [0, 16], ArrowDown: [0, -16] }[event.key];
    if (!delta) return;
    event.preventDefault();
    setSize(panel.offsetWidth + delta[0], panel.offsetHeight + delta[1]);
  });
}

export function createChat(elements, { harvest, animate, takePhoto, describeActivity, getView, getLight }) {
  const { panel, launch, close, messages, form, input } = elements;
  enableChatResize(panel);
  const ownerChat = window.tideOwnerChat;
  const saved = ownerChat ? [] : readStorage("chat", []);
  let history = Array.isArray(saved) ? saved.filter(entry =>
    typeof entry?.text === "string" && ["guest", "amo"].includes(entry.role)
  ).slice(-40) : [];
  let outstanding = 0;
  let lastReply = "";
  const idleReplies = [
    "我在听。海浪刚好慢了一点，你可以继续说。",
    "要不要在这里坐一会儿？门廊刚好有风，橘猫也在。",
    "我把这句记在今天的小岛聊天里。等你想聊了，我们再继续。",
    "我给你留了靠窗的位置。你想看海，还是陪我去菜园逛逛？",
  ];

  function message(role, text, persist = true, photo) {
    const bubble = document.createElement("p");
    bubble.className = role === "guest" ? "message self" : "message";
    bubble.textContent = text;
    if (photo) {
      const link = document.createElement("a");
      const image = document.createElement("img");
      link.className = "message-photo";
      link.href = URL.createObjectURL(photo);
      link.download = "Ww-海岛照片.jpg";
      image.src = link.href;
      image.alt = text;
      link.append(image);
      bubble.append(link);
      image.addEventListener("load", () => { messages.scrollTop = messages.scrollHeight; }, { once: true });
    }
    messages.append(bubble);
    while (messages.childElementCount > 40) {
      const oldest = messages.firstElementChild;
      const link = oldest.querySelector(".message-photo");
      if (link) URL.revokeObjectURL(link.href);
      oldest.remove();
    }
    messages.scrollTop = messages.scrollHeight;
    if (persist && !ownerChat) {
      history = [...history, { role, text }].slice(-40);
      writeStorage("chat", history);
    }
  }

  if (history.length) {
    history.forEach(({ role, text }) => message(role, text, false));
  } else {
    if (!ownerChat) message("amo", "嗨，我是 Ww。可以进来坐坐，也可以和我去菜园摘个西瓜。");
  }

  function open(focus = false) {
    panel.hidden = false;
    launch.setAttribute("aria-expanded", "true");
    messages.scrollTop = messages.scrollHeight;
    if (focus) input.focus({ preventScroll: true });
  }

  function hide(focus = false) {
    panel.hidden = true;
    launch.setAttribute("aria-expanded", "false");
    if (focus) launch.focus({ preventScroll: true });
  }

  function reply(text) {
    if (/(摘|采|种|收|拿).{0,6}(西瓜|瓜)|西瓜.{0,6}(摘|采)/.test(text)) {
      const accepted = harvest();
      return accepted ? "好呀！我去菜园挑一个熟透的。" : "等我忙完这一会儿，我们再一起去菜园。";
    }
    if (/(吃|切).{0,5}(西瓜|瓜)|西瓜/.test(text)) {
      animate("eat");
      return "给你掰一块。今天这颗脆脆的，橘猫只负责闻。";
    }
    if (/(橘猫|猫|喵)/.test(text)) {
      animate("greet");
      return "它叫柚子。天一暖就往窗边跑，我去哪儿它也跟去哪儿。";
    }
    if (/(累|难过|伤心|压力|烦|焦虑|不好)/.test(text)) {
      return "听着就挺累的。我们先歇一会儿吧，你想说的，我都慢慢听。";
    }
    if (/(天气|几点|日落|夜晚|晚上|太阳|月亮|白天)/.test(text)) {
      return { dusk: "这会儿是日落，海面像铺了一层金色的碎光。", night: "天黑了。小屋的灯还亮着，海面也有月光。", day: "现在是白天，正适合到码头吹吹风。" }[getLight()];
    }
    if (/(家|小屋|家具|房间|在哪|码头|海边|海岛)/.test(text)) {
      return getView() === "room" ? "我们正在小屋里。想换换位置的话，可以点「布置」挪动家具。" : "我们在海岛上。顺着石板路走，玻璃窗旁边那扇门就是我的家。";
    }
    if (/(你好|嗨|哈[喽啰]|过得|在吗|hi\b|hello)/i.test(text)) {
      animate("greet");
      return "我挺好的！刚去码头听了会儿浪。你今天过得怎么样？";
    }
    if (/谢谢|晚安|再见/.test(text)) {
      animate("greet");
      return "等你下次来，屋里的灯会亮着。";
    }
    const options = idleReplies.filter(option => option !== lastReply);
    return options[Math.floor(Math.random() * options.length)];
  }

  async function send(value) {
    const text = value.trim().slice(0, 180);
    const photo = photoRequest(text);
    const activity = !photo && asksAboutActivity(text);
    if (!text || (ownerChat && outstanding && !photo && !activity)) return;
    message("guest", text, !photo && !activity);
    input.value = "";
    const description = activity ? describeActivity() : null;
    if (activity && Math.random() < .5) {
      message("amo", description, false);
      return;
    }
    if (photo || activity) {
      const firstPerson = photo === "view" || activity;
      try {
        const image = await takePhoto(firstPerson);
        message("amo", description ?? (firstPerson ? "这是我现在看到的。" : "这是我现在的样子。"), false, image);
      } catch {
        message("amo", description ?? "刚才没拍成功，再试一次吧。", false);
      }
      return;
    }
    if (ownerChat) {
      outstanding++;
      try {
        message("amo", await ownerChat(text));
      } catch (error) {
        message("amo", error.message || "Ww 暂时无法回复。", false);
      } finally {
        outstanding--;
      }
      return;
    }
    window.setTimeout(() => {
      lastReply = reply(text);
      message("amo", lastReply);
      outstanding--;
    }, 360 + outstanding * 260);
    outstanding++;
  }

  launch.addEventListener("click", () => panel.hidden ? open() : hide());
  close.addEventListener("click", () => hide(true));
  form.addEventListener("submit", event => {
    event.preventDefault();
    send(input.value);
  });
  panel.querySelectorAll("[data-suggestion]").forEach(button => {
    button.addEventListener("click", () => send(button.dataset.suggestion));
  });
  return { open, hide, message, get isOpen() { return !panel.hidden; } };
}

export function createSurf() {
  let context, master;
  let audible = false;
  async function set(enabled) {
    if (!enabled && !context) return false;
    if (!context) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return false;
      context = new Audio();
      const count = context.sampleRate * 5;
      const buffer = context.createBuffer(2, count, context.sampleRate);
      for (let channel = 0; channel < 2; channel++) {
        let last = 0;
        const data = buffer.getChannelData(channel);
        for (let i = 0; i < count; i++) {
          last = (last + .056 * (Math.random() * 2 - 1)) / 1.056;
          data[i] = last * 2.5;
        }
      }
      const noise = context.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;
      const filter = context.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 540;
      const swell = context.createGain();
      swell.gain.value = .4;
      master = context.createGain();
      master.gain.value = 0;
      const oscillator = context.createOscillator();
      oscillator.frequency.value = .16;
      const depth = context.createGain();
      depth.gain.value = .29;
      oscillator.connect(depth).connect(swell.gain);
      noise.connect(filter).connect(swell).connect(master).connect(context.destination);
      oscillator.start();
      noise.start();
    }
    if (enabled && context.state !== "running") {
      try {
        await context.resume();
      } catch {
        return false;
      }
    }
    master.gain.cancelScheduledValues(context.currentTime);
    master.gain.setTargetAtTime(enabled ? .30 : 0, context.currentTime, .14);
    audible = enabled;
    return audible;
  }
  return { set, get audible() { return audible; } };
}
