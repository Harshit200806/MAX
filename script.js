(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const state = {
    currentPage: "home",
    messageCount: 1,
    filter: "all",
    listening: false,
    recognition: null,
    toastTimer: null,
    speechEnabled: true,
  };

  const toast = $("#toast");
  const chatLog = $("#chat-log");
  const chatInput = $("#chat-input");
  const messageCount = $("#message-count");
  const assistantState = $("#assistant-state");
  const orbCaption = $("#orb-caption");
  const micButton = $("#mic-button");
  const voiceStatus = $("#voice-status");
  const voiceSettingStatus = $("#voice-setting-status");

  $$("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => toast.classList.remove("show"), 3100);
  }

  function navigate(page) {
    const target = document.getElementById(page);
    if (!target || !target.classList.contains("page")) return;
    state.currentPage = page;
    $$(".page").forEach((section) => section.classList.toggle("active-page", section.id === page));
    $$(".nav-link").forEach((link) => link.classList.toggle("active", link.dataset.page === page));
    $("#breadcrumb-current").textContent = ({
      home: "Overview",
      assistant: "MAX Assistant",
      tools: "AI Tools",
      projects: "Projects",
      about: "About MAX",
      settings: "Settings",
    })[page] || "Overview";
    history.replaceState(null, "", `#${page}`);
    $("#sidebar").classList.remove("open");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function addMessage(role, text) {
    const row = document.createElement("div");
    row.className = `chat-message ${role === "user" ? "user-message" : "assistant-message"}`;

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.textContent = role === "user" ? "YOU" : "M";

    const body = document.createElement("div");
    body.className = "message-body";
    const author = document.createElement("span");
    author.className = "message-author";
    author.append(document.createTextNode(role === "user" ? "YOU " : "MAX "));
    const time = document.createElement("small");
    time.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }).toUpperCase();
    author.append(time);

    const paragraph = document.createElement("p");
    // Treat all user/assistant text as text, never as executable HTML.
    paragraph.textContent = text;
    body.append(author, paragraph);
    row.append(avatar, body);
    chatLog.append(row);
    chatLog.scrollTop = chatLog.scrollHeight;
    state.messageCount += 1;
    messageCount.textContent = state.messageCount;
  }

  function setAssistantMode(mode, label) {
    document.body.classList.remove("is-listening", "is-processing");
    if (mode === "listening") document.body.classList.add("is-listening");
    if (mode === "processing") document.body.classList.add("is-processing");
    assistantState.textContent = label;
    orbCaption.textContent = ({
      ready: "READY TO CONNECT",
      listening: "LISTENING TO YOU",
      processing: "PROCESSING REQUEST",
      speaking: "MAX IS SPEAKING",
    })[mode] || "READY TO CONNECT";
    micButton.classList.toggle("listening", mode === "listening");
  }

  function localReply(rawText) {
    const text = rawText.trim();
    const lower = text.toLowerCase();

    if (/^(hi|hello|hey|yo)\b/.test(lower)) {
      return "Hey! MAX is online and ready. Try asking what I can do, check the time, or explore the AI tools.";
    }
    if (lower.includes("what can you do") || lower.includes("capabilities") || lower.includes("help")) {
      return "I can demonstrate this interface, respond to basic local commands, tell you the current time and date, open supported web pages, and take you to the AI tools or projects sections. Real AI conversations and PC control need a connected backend or desktop bridge.";
    }
    if (lower.includes("time") || lower.includes("date")) {
      return `Your browser's local time is ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })} on ${new Date().toLocaleDateString([], { weekday: "long", year: "numeric", month: "long", day: "numeric" })}.`;
    }
    if (lower.includes("open ai tools") || lower.includes("explore tools") || lower.includes("show tools")) {
      navigate("tools");
      return "Opening the AI Tools Library. These are sample cards—connect your real project URLs to launch your tools.";
    }
    if (lower.includes("open assistant") || lower.includes("launch max")) {
      navigate("assistant");
      return "You're already in MAX's assistant workspace. Type a message or use the microphone to test voice input.";
    }
    if (lower.includes("open project")) {
      navigate("projects");
      return "Opening the Project Lab. Add your real demos and repository links to make each project card launchable.";
    }
    if (lower.includes("open google") || lower.includes("search google")) {
      window.open("https://www.google.com/", "_blank", "noopener,noreferrer");
      return "Google was opened in a new tab. Web navigation is supported here; local desktop apps need the separate desktop bridge.";
    }
    if (lower.includes("open youtube")) {
      window.open("https://www.youtube.com/", "_blank", "noopener,noreferrer");
      return "YouTube was opened in a new tab.";
    }
    if (lower.includes("open github")) {
      window.open("https://github.com/", "_blank", "noopener,noreferrer");
      return "GitHub was opened in a new tab.";
    }
    if (lower.includes("settings")) {
      navigate("settings");
      return "Opening settings. You can toggle visual glow and spoken demo responses here.";
    }
    if (lower.includes("who are you") || lower.includes("your name")) {
      return "I'm MAX, your personal AI assistant interface. This version uses local demo responses; connect your assistant's API for full conversational intelligence.";
    }
    if (lower.includes("thank")) {
      return "Anytime. MAX is standing by for the next command.";
    }
    return `I received: "${text}". This front-end demo doesn't have a live AI model connected yet. To get intelligent answers, connect a backend endpoint in script.js; don't put private API keys in browser code.`;
  }

  function speak(text) {
    if (!state.speechEnabled || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onstart = () => setAssistantMode("speaking", "MAX is speaking");
    utterance.onend = () => setAssistantMode("ready", "MAX is standing by");
    utterance.onerror = () => setAssistantMode("ready", "MAX is standing by");
    window.speechSynthesis.speak(utterance);
  }

  async function getAssistantReply(text) {
    /*
      BACKEND INTEGRATION POINT
      Replace the local demo response below with your own API request when ready.
      Example:
        const response = await fetch("http://127.0.0.1:PORT/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text })
        });
        if (!response.ok) throw new Error("Assistant backend is unavailable");
        const data = await response.json();
        return data.reply;
      Only connect to a trusted local service you control. Validate commands server-side.
      Never expose arbitrary shell execution or secrets to this public frontend.
    */
    await new Promise((resolve) => setTimeout(resolve, 250));
    return localReply(text);
  }

  async function sendMessage(rawText) {
    const text = String(rawText || "").trim();
    if (!text) return;
    chatInput.value = "";
    addMessage("user", text);
    setAssistantMode("processing", "MAX is processing");
    try {
      const reply = await getAssistantReply(text);
      addMessage("assistant", reply);
      setAssistantMode("ready", "MAX is standing by");
      speak(reply);
    } catch (error) {
      console.error("MAX reply error:", error);
      const reply = "I couldn't reach the assistant service. Check your local backend connection and try again.";
      addMessage("assistant", reply);
      setAssistantMode("ready", "MAX is standing by");
      showToast(reply);
    }
  }

  $("#chat-form").addEventListener("submit", (event) => {
    event.preventDefault();
    sendMessage(chatInput.value);
  });

  function handleCommand(command) {
    if (command) {
      navigate("assistant");
      sendMessage(command);
    }
  }

  document.addEventListener("click", (event) => {
    const go = event.target.closest("[data-go]");
    if (go) {
      event.preventDefault();
      navigate(go.dataset.go);
      return;
    }
    const command = event.target.closest("[data-command]");
    if (command) {
      handleCommand(command.dataset.command);
      return;
    }
    const demo = event.target.closest("[data-demo]");
    if (demo) showToast(`${demo.dataset.demo} is a placeholder card. Connect its real URL or build the feature to launch it.`);
  });

  $$(".nav-link").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      navigate(link.dataset.page);
    });
  });

  $$(".feature-card").forEach((card) => {
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        navigate(card.dataset.go);
      }
    });
  });

  $("#menu-toggle").addEventListener("click", () => $("#sidebar").classList.toggle("open"));

  function toggleGlow(enabled) {
    document.body.classList.toggle("glow-off", !enabled);
    $("#glow-setting").checked = enabled;
  }
  $("#theme-glow").addEventListener("click", () => toggleGlow(document.body.classList.contains("glow-off")));
  $("#glow-setting").addEventListener("change", (event) => toggleGlow(event.target.checked));

  $("#speech-setting").addEventListener("change", (event) => {
    state.speechEnabled = event.target.checked;
    if (!state.speechEnabled && "speechSynthesis" in window) window.speechSynthesis.cancel();
    showToast(state.speechEnabled ? "Spoken responses enabled." : "Spoken responses disabled.");
  });

  $("#clear-chat").addEventListener("click", () => {
    chatLog.replaceChildren();
    state.messageCount = 0;
    messageCount.textContent = "0";
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setAssistantMode("ready", "MAX is standing by");
    showToast("Session chat cleared.");
  });

  // Search + category filters for the tool library.
  const toolSearch = $("#tool-search");
  function filterTools() {
    const query = toolSearch.value.trim().toLowerCase();
    let visible = 0;
    $$(".tool-card").forEach((card) => {
      const matchesCategory = state.filter === "all" || card.dataset.category === state.filter;
      const matchesQuery = `${card.dataset.name} ${card.textContent}`.toLowerCase().includes(query);
      const show = matchesCategory && matchesQuery;
      card.classList.toggle("hidden", !show);
      if (show) visible += 1;
    });
    $("#empty-tools").classList.toggle("hidden", visible > 0);
  }
  toolSearch.addEventListener("input", filterTools);
  $$(".filter-chip").forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      $$(".filter-chip").forEach((chip) => chip.classList.toggle("active", chip === button));
      filterTools();
    });
  });

  // Browser speech recognition support varies; Chrome/Edge generally offer the widest support.
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
    state.recognition = new SpeechRecognition();
    state.recognition.lang = navigator.language || "en-US";
    state.recognition.interimResults = true;
    state.recognition.continuous = false;

    state.recognition.onstart = () => {
      state.listening = true;
      micButton.classList.add("listening");
      micButton.setAttribute("aria-label", "Stop voice input");
      setAssistantMode("listening", "Listening… speak now");
    };
    state.recognition.onresult = (event) => {
      let interim = "";
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += transcript;
        else interim += transcript;
      }
      chatInput.value = finalText || interim;
      if (finalText.trim()) {
        state.recognition.stop();
        sendMessage(finalText.trim());
      }
    };
    state.recognition.onerror = (event) => {
      state.listening = false;
      micButton.classList.remove("listening");
      micButton.setAttribute("aria-label", "Start voice input");
      setAssistantMode("ready", "MAX is standing by");
      if (event.error !== "aborted" && event.error !== "no-speech") {
        showToast(event.error === "not-allowed"
          ? "Microphone access was blocked. Allow it in your browser's site settings."
          : `Voice input error: ${event.error}. You can type instead.`);
      }
    };
    state.recognition.onend = () => {
      state.listening = false;
      micButton.classList.remove("listening");
      micButton.setAttribute("aria-label", "Start voice input");
      if (!document.body.classList.contains("is-processing")) setAssistantMode("ready", "MAX is standing by");
    };
    voiceStatus.textContent = "Supported";
    voiceSettingStatus.textContent = "Browser supported";
  } else {
    micButton.title = "Voice recognition is not supported in this browser";
    voiceStatus.textContent = "Unavailable";
    voiceSettingStatus.textContent = "Not supported";
  }

  micButton.addEventListener("click", () => {
    if (!state.recognition) {
      showToast("Voice recognition is not supported in this browser. Try a recent version of Chrome or Edge, or type your message.");
      return;
    }
    if (state.listening) {
      state.recognition.stop();
      setAssistantMode("ready", "MAX is standing by");
    } else {
      try {
        state.recognition.start();
      } catch (error) {
        showToast("Voice input is already starting. Please try again in a moment.");
      }
    }
  });

  // Make internal links work when opening the page directly on a hash.
  const initialPage = window.location.hash.replace("#", "");
  if (initialPage && document.getElementById(initialPage)?.classList.contains("page")) navigate(initialPage);
})();
