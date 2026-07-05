// popup.js - YouTube AI Companion Popup Logic

document.addEventListener("DOMContentLoaded", () => {
  // Detect if running as a popup or side panel
  const urlParams = new URLSearchParams(window.location.search);
  const isSidePanel = urlParams.get('sidepanel') === 'true';
  if (!isSidePanel) {
    document.body.classList.add("is-popup");
  }

  // Elements
  const tabs = document.querySelectorAll(".tab-btn");
  const tabPanels = document.querySelectorAll(".tab-panel");
  
  const connectionBar = document.getElementById("connection-bar");
  const connectionText = document.getElementById("connection-text");
  
  const openSettingsBtn = document.getElementById("open-settings");
  const closeSettingsBtn = document.getElementById("close-settings");
  const settingsDrawer = document.getElementById("settings-drawer");
  const backendUrlInput = document.getElementById("backend-url");
  const saveSettingsBtn = document.getElementById("save-settings");

  // Chat Elements
  const chatInput = document.getElementById("chat-input");
  const chatSendBtn = document.getElementById("chat-send");
  const chatHistory = document.getElementById("chat-history");
  const chatLoading = document.getElementById("chat-loading");

  // Brand Elements
  const trackBrandsBtn = document.getElementById("track-brands-btn");
  const brandList = document.getElementById("brand-list");
  const brandSkeleton = document.getElementById("brand-skeleton");

  // Summary Elements
  const summarizeBtn = document.getElementById("summarize-btn");
  const summaryContent = document.getElementById("summary-content");
  const summarySkeleton = document.getElementById("summary-skeleton");

  // State Variables
  let activeVideoId = null;
  let backendUrl = localStorage.getItem("popown_backend_url") || "http://localhost:8000";
  
  // Set initial settings input
  backendUrlInput.value = backendUrl;

  // 1. Drawer Logic
  openSettingsBtn.addEventListener("click", () => settingsDrawer.classList.remove("hidden"));
  closeSettingsBtn.addEventListener("click", () => settingsDrawer.classList.add("hidden"));
  saveSettingsBtn.addEventListener("click", () => {
    let url = backendUrlInput.value.trim();
    if (url.endsWith("/")) {
      url = url.slice(0, -1);
    }
    backendUrl = url;
    localStorage.setItem("popown_backend_url", backendUrl);
    settingsDrawer.classList.add("hidden");
    showNotification("Pengaturan disimpan!");
  });

  // 2. Tab Switching Logic
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const targetPanel = tab.getAttribute("data-tab");
      
      tabs.forEach(t => t.classList.remove("active"));
      tabPanels.forEach(p => p.classList.remove("active"));
      
      tab.classList.add("active");
      document.getElementById(targetPanel).classList.add("active");
    });
  });

  // 3. YouTube Video Detection
  // 3. YouTube Video Detection
  detectYouTubeVideo();

  if (typeof chrome !== "undefined" && chrome.tabs) {
    // Listen for tab activation (switching tabs)
    chrome.tabs.onActivated.addListener(() => {
      detectYouTubeVideo();
    });

    // Listen for tab updates (navigating to different pages/videos)
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      // Only trigger if the URL has changed and the tab is active
      if (changeInfo.url && tab.active) {
        detectYouTubeVideo();
      }
    });
  }

  function detectYouTubeVideo() {
    if (typeof chrome !== "undefined" && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs[0]) {
          const url = tabs[0].url;
          const videoId = extractVideoId(url);
          
          if (videoId) {
            if (activeVideoId !== videoId) {
              activeVideoId = videoId;
              setConnectedState(videoId, tabs[0].title);
              resetUI();
            }
          } else {
            if (activeVideoId !== null) {
              activeVideoId = null;
              setDisconnectedState("Buka video YouTube terlebih dahulu.");
              resetUI();
            }
          }
        } else {
          if (activeVideoId !== null) {
            activeVideoId = null;
            setDisconnectedState("Tidak dapat mendeteksi tab aktif.");
            resetUI();
          }
        }
      });
    } else {
      // Mocking environment for development/testing outside Chrome extension environment
      const mockUrl = "https://www.youtube.com/watch?v=xlWhpXdOlTo";
      const videoId = extractVideoId(mockUrl);
      if (activeVideoId !== videoId) {
        activeVideoId = videoId;
        setConnectedState(videoId, "Mock Video untuk Pengembangan");
        resetUI();
        console.log("Menjalankan di luar lingkungan Extension - Menggunakan mock video ID:", videoId);
      }
    }
  }

  function extractVideoId(url) {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  }

  function setConnectedState(videoId, videoTitle) {
    connectionBar.className = "connection-bar connected";
    connectionText.textContent = `Connected: ${videoTitle || videoId}`;
    
    // Enable inputs and buttons
    chatInput.disabled = false;
    chatSendBtn.disabled = false;
    trackBrandsBtn.disabled = false;
    summarizeBtn.disabled = false;
  }

  function setDisconnectedState(message) {
    connectionBar.className = "connection-bar disconnected";
    connectionText.textContent = message;
    
    // Disable inputs and buttons
    chatInput.disabled = true;
    chatSendBtn.disabled = true;
    trackBrandsBtn.disabled = true;
    summarizeBtn.disabled = true;
  }

  function resetUI() {
    // Reset Chat
    chatHistory.innerHTML = `
      <div class="chat-message system">
        Hai! Saya asisten YouTube AI Anda. Silakan tanyakan apa saja mengenai isi video ini. Anda juga bisa menyuruh saya lompat ke menit tertentu (contoh: "ke menit 3:15" atau "ke adegan KFC").
      </div>
    `;
    chatInput.value = "";
    
    // Reset Brand
    brandList.className = "brand-list empty-state";
    brandList.innerHTML = 'Klik tombol "Lacak Brand" di atas untuk menganalisis transkrip.';
    brandSkeleton.classList.add("hidden");
    
    // Reset Summary
    summaryContent.className = "summary-content empty-state";
    summaryContent.innerHTML = 'Klik tombol "Buat Rangkuman" di atas untuk meringkas video.';
    summarySkeleton.classList.add("hidden");
  }

  // 4. API Core Invoker
  async function callAPI(endpoint, method, body) {
    const response = await fetch(`${backendUrl}${endpoint}`, {
      method: method,
      headers: {
        "Content-Type": "application/json"
      },
      body: body ? JSON.stringify(body) : null
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `HTTP Error ${response.status}`);
    }
    return response.json();
  }

  // 5. Chat Functionality
  chatSendBtn.addEventListener("click", sendChatMessage);
  chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendChatMessage();
  });

  async function sendChatMessage() {
    const text = chatInput.value.trim();
    if (!text || !activeVideoId) return;

    // Append user message
    appendMessage(text, "user");
    chatInput.value = "";
    
    // Show Loading
    chatLoading.classList.remove("hidden");
    scrollToBottom(chatHistory);

    try {
      const res = await callAPI("/api/chat", "POST", {
        video_id: activeVideoId,
        message: text,
        language: "id"
      });

      chatLoading.classList.add("hidden");
      
      // Append AI response
      appendMessage(res.reply, "companion", res.jump_to_seconds);
    } catch (err) {
      chatLoading.classList.add("hidden");
      appendMessage(`Error: Gagal memanggil API. Pastikan server backend Anda berjalan di ${backendUrl}. Detail: ${err.message}`, "system");
    }
    
    scrollToBottom(chatHistory);
  }

  function appendMessage(text, sender, jumpToSeconds = null) {
    const msgDiv = document.createElement("div");
    msgDiv.className = `chat-message ${sender}`;
    
    let htmlContent = "";
    if (sender === "system") {
      htmlContent = escapeHTML(text);
    } else {
      htmlContent = renderMarkdown(text);
      htmlContent = parseAndFormatTimestamps(htmlContent);
    }

    msgDiv.innerHTML = htmlContent;
    
    // Add specific jump button if API returned jump_to_seconds explicitly
    if (jumpToSeconds !== null && jumpToSeconds !== undefined && sender === "companion") {
      const jumpBtn = document.createElement("button");
      jumpBtn.className = "timestamp-pill";
      jumpBtn.innerHTML = `⏱️ Jump to ${formatSeconds(jumpToSeconds)}`;
      jumpBtn.addEventListener("click", () => seekVideoTo(jumpToSeconds));
      msgDiv.appendChild(document.createElement("br"));
      msgDiv.appendChild(jumpBtn);
    }

    chatHistory.appendChild(msgDiv);
    
    // Attach event listeners for parsed timestamps in the text
    msgDiv.querySelectorAll(".timestamp-link").forEach(link => {
      const secs = parseFloat(link.getAttribute("data-seconds"));
      link.addEventListener("click", (e) => {
        e.preventDefault();
        seekVideoTo(secs);
      });
    });
  }

  // 6. Brand Tracker Functionality
  trackBrandsBtn.addEventListener("click", async () => {
    if (!activeVideoId) return;
    
    trackBrandsBtn.disabled = true;
    brandList.classList.add("hidden");
    brandSkeleton.classList.remove("hidden");
    
    try {
      const res = await callAPI("/api/brand", "POST", {
        video_id: activeVideoId,
        language: "id"
      });
      
      brandSkeleton.classList.add("hidden");
      brandList.classList.remove("hidden");
      brandList.innerHTML = "";
      brandList.className = "brand-list"; // clear empty-state

      if (res.brands && res.brands.length > 0) {
        res.brands.forEach(item => {
          const card = document.createElement("div");
          card.className = "brand-card";
          
          const info = document.createElement("div");
          info.className = "brand-info";
          
          const name = document.createElement("div");
          name.className = "brand-name";
          name.textContent = item.brand;
          
          const context = document.createElement("div");
          context.className = "brand-context";
          context.textContent = item.context || "Disebutkan dalam video";
          
          info.appendChild(name);
          info.appendChild(context);
          card.appendChild(info);
          
          // Timestamp button
          const timeBtn = document.createElement("button");
          timeBtn.className = "btn btn-sm primary";
          timeBtn.innerHTML = `⏱️ ${formatSeconds(item.timestamp_seconds)}`;
          timeBtn.addEventListener("click", () => seekVideoTo(item.timestamp_seconds));
          card.appendChild(timeBtn);
          
          brandList.appendChild(card);
        });
      } else {
        brandList.className = "brand-list empty-state";
        brandList.textContent = "Tidak ada brand/merek yang terdeteksi dari video ini.";
      }
    } catch (err) {
      brandSkeleton.classList.add("hidden");
      brandList.classList.remove("hidden");
      brandList.className = "brand-list";
      brandList.innerHTML = `<div class="error-message">Gagal melacak brand. Pastikan backend aktif. <br>Detail: ${err.message}</div>`;
    } finally {
      trackBrandsBtn.disabled = false;
    }
  });

  // 7. Summarizer Functionality
  summarizeBtn.addEventListener("click", async () => {
    if (!activeVideoId) return;

    summarizeBtn.disabled = true;
    summaryContent.classList.add("hidden");
    summarySkeleton.classList.remove("hidden");

    try {
      const res = await callAPI("/api/summarize", "POST", {
        video_id: activeVideoId,
        language: "id"
      });

      summarySkeleton.classList.add("hidden");
      summaryContent.classList.remove("hidden");
      summaryContent.className = "summary-content"; // clear empty-state
      
      // Parse markdown summary
      summaryContent.innerHTML = renderMarkdown(res.summary);
    } catch (err) {
      summarySkeleton.classList.add("hidden");
      summaryContent.classList.remove("hidden");
      summaryContent.className = "summary-content";
      summaryContent.innerHTML = `<div class="error-message">Gagal memuat rangkuman. Pastikan backend aktif. <br>Detail: ${err.message}</div>`;
    } finally {
      summarizeBtn.disabled = false;
    }
  });

  // Helper functions
  function seekVideoTo(seconds) {
    if (typeof chrome !== "undefined" && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { action: "seekTo", seconds: parseFloat(seconds) }, (response) => {
            if (chrome.runtime.lastError) {
              console.log("Error sending seek message:", chrome.runtime.lastError.message);
              // Fallback inject script directly if content script isn't loaded
              chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                func: (secs) => {
                  const video = document.querySelector("video");
                  if (video) {
                    video.currentTime = secs;
                    if (video.paused) video.play();
                  }
                },
                args: [parseFloat(seconds)]
              });
            }
          });
        }
      });
    } else {
      console.log(`Mock seek video to: ${seconds} seconds.`);
      showNotification(`Mock seek: ${formatSeconds(seconds)}`);
    }
  }

  function formatSeconds(seconds) {
    const s = Math.floor(seconds);
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s - hrs * 3600) / 60);
    const secs = s - hrs * 3600 - mins * 60;
    
    const formattedMins = mins.toString().padStart(2, "0");
    const formattedSecs = secs.toString().padStart(2, "0");
    
    if (hrs > 0) {
      return `${hrs}:${formattedMins}:${formattedSecs}`;
    }
    return `${mins}:${formattedSecs}`;
  }

  function escapeHTML(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Parse strings like "03:15" or "1:02:40" and wrap in timestamp links
  function parseAndFormatTimestamps(text) {
    // Matches 12:34 or 1:23:45
    const timeRegex = /\b(?:(\d+):)?(\d+):(\d+)\b/g;
    return text.replace(timeRegex, (match, hrs, mins, secs) => {
      let totalSeconds = 0;
      if (hrs) {
        totalSeconds = parseInt(hrs) * 3600 + parseInt(mins) * 60 + parseInt(secs);
      } else {
        totalSeconds = parseInt(mins) * 60 + parseInt(secs);
      }
      return `<a href="#" class="timestamp-link" data-seconds="${totalSeconds}">${match}</a>`;
    });
  }

  function renderMarkdown(mdText) {
    if (!mdText) return "";
    
    // Preprocess escaped characters to avoid markdown formatting
    let html = mdText
      .replace(/\\\*/g, "★")
      .replace(/\\#/g, "＃")
      .replace(/\\_/g, "＿");
    
    // Fast lightweight markdown regex parser
    // Headings (h1 to h6)
    html = html.replace(/^###### (.*$)/gim, "<h4>$1</h4>");
    html = html.replace(/^##### (.*$)/gim, "<h4>$1</h4>");
    html = html.replace(/^#### (.*$)/gim, "<h4>$1</h4>");
    html = html.replace(/^### (.*$)/gim, "<h3>$1</h3>");
    html = html.replace(/^## (.*$)/gim, "<h2>$1</h2>");
    html = html.replace(/^# (.*$)/gim, "<h2>$1</h2>");
    
    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    
    // Italics
    html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
    html = html.replace(/_(.*?)_/g, "<em>$1</em>");
    
    // Horizontal Rules
    html = html.replace(/^---$/gim, "<hr style='margin: 16px 0; border: none; border-top: 1px solid var(--border-color);' />");
    html = html.replace(/^\*\*\*$/gim, "<hr style='margin: 16px 0; border: none; border-top: 1px solid var(--border-color);' />");

    // Table parsing
    const lines = html.split("\n");
    const parsedLines = [];
    let tableRows = [];

    const flushTable = () => {
      if (tableRows.length > 0) {
        const headers = tableRows[0];
        let dataRows = tableRows.slice(1);
        
        // Skip separator row (e.g. |---|---|)
        if (dataRows.length > 0 && dataRows[0].every(cell => cell.trim().match(/^-+$/))) {
          dataRows = dataRows.slice(1);
        }

        let tableHtml = `<div class="table-responsive" style="overflow-x: auto; margin: 12px 0;">`;
        tableHtml += `<table style="width: 100%; border-collapse: collapse; font-size: 11px; border: 1px solid var(--border-color); text-align: left;">`;
        
        // Render Header
        tableHtml += `<thead><tr style="background-color: var(--accent-light); border-bottom: 2px solid var(--accent-border);">`;
        headers.forEach(h => {
          tableHtml += `<th style="padding: 6px 8px; font-weight: 600; color: var(--accent);">${h.trim()}</th>`;
        });
        tableHtml += `</tr></thead>`;

        // Render Body
        tableHtml += `<tbody>`;
        dataRows.forEach((row, rIdx) => {
          const bg = rIdx % 2 === 0 ? "transparent" : "var(--bg-secondary)";
          tableHtml += `<tr style="border-bottom: 1px solid var(--border-color); background-color: ${bg};">`;
          row.forEach(cell => {
            tableHtml += `<td style="padding: 6px 8px; color: var(--text-primary);">${cell.trim()}</td>`;
          });
          tableHtml += `</tr>`;
        });
        tableHtml += `</tbody></table></div>`;

        parsedLines.push(tableHtml);
        tableRows = [];
      }
    };

    let listOpen = false;
    let currentListType = null; // 'ul' or 'ol'
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const cleanLine = line.trim();

      // Check if it's a table line
      if (cleanLine.startsWith("|")) {
        // Close list if open
        if (listOpen) {
          parsedLines.push(currentListType === "ul" ? "</ul>" : "</ol>");
          listOpen = false;
          currentListType = null;
        }
        const cells = cleanLine.split("|").slice(1, -1);
        tableRows.push(cells);
      } else {
        // Close table if open
        flushTable();

        // Check if it's a list item
        const ulMatch = cleanLine.match(/^[\-\*]\s+(.*)$/);
        const olMatch = cleanLine.match(/^(\d+)\.\s+(.*)$/);

        if (ulMatch) {
          if (!listOpen || currentListType !== "ul") {
            if (listOpen) {
              parsedLines.push(currentListType === "ul" ? "</ul>" : "</ol>");
            }
            listOpen = true;
            currentListType = "ul";
            parsedLines.push("<ul style='margin: 8px 0 8px 20px; padding-left: 0; list-style-type: disc;'><li>" + ulMatch[1] + "</li>");
          } else {
            parsedLines.push("<li>" + ulMatch[1] + "</li>");
          }
        } else if (olMatch) {
          if (!listOpen || currentListType !== "ol") {
            if (listOpen) {
              parsedLines.push(currentListType === "ul" ? "</ul>" : "</ol>");
            }
            listOpen = true;
            currentListType = "ol";
            parsedLines.push("<ol style='margin: 8px 0 8px 20px; padding-left: 0; list-style-type: decimal;'><li>" + olMatch[2] + "</li>");
          } else {
            parsedLines.push("<li>" + olMatch[2] + "</li>");
          }
        } else {
          if (listOpen) {
            parsedLines.push(currentListType === "ul" ? "</ul>" : "</ol>");
            listOpen = false;
            currentListType = null;
          }
          parsedLines.push(line);
        }
      }
    }

    // Flush any remaining tables or lists at the end
    flushTable();
    if (listOpen) {
      parsedLines.push(currentListType === "ul" ? "</ul>" : "</ol>");
    }

    html = parsedLines.join("\n");
    
    // Paragraphs
    html = html.split("\n\n").map(p => {
      p = p.trim();
      if (!p) return "";
      if (p.startsWith("<h") || p.startsWith("<ul") || p.startsWith("<ol") || p.startsWith("<li") || p.startsWith("<div") || p.startsWith("<hr")) return p;
      return `<p style='margin-bottom: 6px; line-height: 1.45;'>${p}</p>`;
    }).join("\n");

    // Postprocess to restore escaped characters
    html = html
      .replace(/★/g, "*")
      .replace(/＃/g, "#")
      .replace(/＿/g, "_");

    return html;
  }

  function scrollToBottom(element) {
    element.scrollTop = element.scrollHeight;
  }

  function showNotification(message) {
    const toast = document.createElement("div");
    toast.style.position = "absolute";
    toast.style.bottom = "60px";
    toast.style.left = "50%";
    toast.style.transform = "translateX(-50%)";
    toast.style.backgroundColor = "#1e293b";
    toast.style.color = "#ffffff";
    toast.style.padding = "6px 16px";
    toast.style.borderRadius = "20px";
    toast.style.fontSize = "11px";
    toast.style.zIndex = "1000";
    toast.style.pointerEvents = "none";
    toast.style.transition = "opacity 0.3s ease";
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }
});
