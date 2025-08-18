chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === "lookup") {
        const selection = window.getSelection();
        performAPILookup(selection);
    }

    if (msg.action === "lookupLocal") {
        const selection = window.getSelection();
        const raw = selection.toString();
        if (!raw) return;
        const match = raw.match(/[A-Za-z\-']+/);
        if (!match) return;
        const word = match[0].toLowerCase();

        showLoading();
        chrome.runtime.sendMessage({ action: "getLocalDict" }, (resp) => {
            if (!resp || !resp.ok) {
                // If local dict fails, fall back to API
                console.error("读取词典失败：", resp && resp.error);
                hideLoading();
                performAPILookup(selection);
                return;
            }

            const text = resp.text;
            const lines = text.split(/\r?\n/);
            const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const regexPrimary = new RegExp(`^${escaped}\\s*\\[`, 'i');
            const regexFallback = new RegExp(`^${escaped}\\b`, 'i');

            let found = lines.find(line => regexPrimary.test(line));
            if (!found) {
                found = lines.find(line => regexFallback.test(line));
            }

            if (found) {
                hideLoading();
                const m = found.match(/^([A-Za-z\-']+)\s*(\[[^\]]+\])?\s*(.*)$/);
                if (m) {
                    const wordStr = m[1];
                    const phonetic = m[2] ? ` ${m[2]}` : "";
                    const meanings = m[3] || "";
                    const pretty = `【四级词典】\n${wordStr}${phonetic}\n${meanings}`;
                    showCustomPopup(pretty);
                } else {
                    showCustomPopup(`【四级词典】\n${found}`);
                }
            } else {
                // Not found in local dict, fall back to API without showing "not found" message
                hideLoading();
                performAPILookup(selection);
            }
        });
    }
});

function performAPILookup(selection) {
    const selectedText = selection.toString();
    if (!selectedText) return;

    const node = selection.anchorNode;
    if (!node) return;

    const text = node.textContent;
    const offset = selection.anchorOffset;
    const before = text.slice(0, offset);
    const after = text.slice(offset);
    const left = before.lastIndexOf('.') + 1;
    const rightEnd = after.indexOf('.') + 1;
    const right = rightEnd > 0 ? offset + rightEnd : text.length;

    const sentence = text.slice(left, right).trim();

    console.log("gao3 内容脚本已执行")
    showLoading();
    fetch("https://ark.cn-beijing.volces.com/api/v3/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer 10c1f619-4e57-446b-9663-f40f880ec5ff"
        },
        body: JSON.stringify({
            model: "ep-20241226150845-xbl62",
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: `我选中的英文是："${selectedText}"，它出现在这句话中："${sentence}"。请告诉我在这个上下文中，"${selectedText}"是什么意思？同时翻译整句`
                        }
                    ]
                }
            ]
        })
    })
    .then(res => res.json())
    .then(data => {
        console.log('return')
        hideLoading();
        const answer = data.choices[0].message.content;
        showCustomPopup(answer);
    })
    .catch(err => {
        console.error("API 请求失败：", err);
        hideLoading();
    });
}

function showCustomPopup(content) {
  const existing = document.getElementById("context-word-popup");
  if (existing) existing.remove();

  const popup = document.createElement("div");
  popup.id = "context-word-popup";
  popup.style.position = "fixed";
  popup.style.top = "50px";
  popup.style.right = "50px";
  popup.style.zIndex = "99999";
  popup.style.maxWidth = "400px";
  popup.style.maxHeight = "300px";
  popup.style.overflowY = "auto";
  popup.style.background = "white";
  popup.style.border = "1px solid #ccc";
  popup.style.borderRadius = "8px";
  popup.style.boxShadow = "0 2px 10px rgba(0,0,0,0.2)";
  popup.style.padding = "16px";
  popup.style.fontSize = "14px";
  popup.style.lineHeight = "1.5";
  popup.style.color = "#333";

  const closeBtn = document.createElement("div");
  closeBtn.textContent = "✕";
  closeBtn.style.position = "absolute";
  closeBtn.style.top = "8px";
  closeBtn.style.right = "12px";
  closeBtn.style.cursor = "pointer";
  closeBtn.style.fontWeight = "bold";
  closeBtn.style.fontSize = "16px";
  closeBtn.onclick = () => popup.remove();
  popup.appendChild(closeBtn);

  const contentDiv = document.createElement("div");
  contentDiv.innerHTML = renderMarkdown(content);
  popup.appendChild(contentDiv);

  document.body.appendChild(popup);
}

function showLoading() {
  if (document.getElementById("context-loading-popup")) return;

  const loading = document.createElement("div");
  loading.id = "context-loading-popup";
  loading.style.position = "fixed";
  loading.style.top = "10%";
  loading.style.left = "80%";
  loading.style.transform = "translate(-50%, -50%)";
  loading.style.background = "rgba(0,0,0,0.75)";
  loading.style.color = "#fff";
  loading.style.padding = "16px 24px";
  loading.style.borderRadius = "8px";
  loading.style.fontSize = "16px";
  loading.style.zIndex = "99999";
  loading.innerHTML = `
    <div style="text-align:center;">
      <div class="spinner" style="width:28px;height:28px;border:4px solid #ccc;border-top:4px solid #fff;border-radius:50%;animation:spin 1s linear infinite;margin:auto;"></div>
      <div style="margin-top:10px;">正在加载...</div>
    </div>
  `;

  const style = document.createElement("style");
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  style.id = "context-loading-style";
  document.head.appendChild(style);
  document.body.appendChild(loading);
}

function hideLoading() {
  const loading = document.getElementById("context-loading-popup");
  if (loading) loading.remove();
  const style = document.getElementById("context-loading-style");
  if (style) style.remove();
}

function renderMarkdown(md) {
  if (!md) return "";
  const lines = md.split(/\r?\n/);
  const html = [];
  let inCode = false;
  let codeBuf = [];
  let listOpen = false;

  const closeListIfOpen = () => {
    if (listOpen) {
      html.push("</ul>");
      listOpen = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.replace(/\t/g, "    ");

    // fenced code blocks
    if (/^\s*```/.test(line)) {
      if (inCode) {
        // close code
        const code = codeBuf.join("\n");
        html.push(`<pre style="background:#f6f8fa;padding:10px;border-radius:6px;overflow:auto;white-space:pre;"><code>${escapeHtml(code)}</code></pre>`);
        codeBuf = [];
        inCode = false;
      } else {
        closeListIfOpen();
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      codeBuf.push(raw);
      continue;
    }

    // headings
    const heading = line.match(/^\s*(#{1,6})\s+(.+)$/);
    if (heading) {
      closeListIfOpen();
      const level = heading[1].length;
      const text = heading[2];
      html.push(`<h${level} style="margin:6px 0;">${formatInline(text)}</h${level}>`);
      continue;
    }

    // unordered list
    const listItem = line.match(/^\s*[-*+]\s+(.+)$/);
    if (listItem) {
      if (!listOpen) {
        html.push('<ul style="padding-left:20px;margin:6px 0 6px 16px;">');
        listOpen = true;
      }
      html.push(`<li>${formatInline(listItem[1])}</li>`);
      continue;
    }

    // paragraph / blank
    closeListIfOpen();
    if (line.trim() === "") {
      html.push("<br>");
    } else {
      html.push(`<p style="margin:6px 0;">${formatInline(line)}</p>`);
    }
  }

  // close any open structures
  if (inCode) {
    const code = codeBuf.join("\n");
    html.push(`<pre style="background:#f6f8fa;padding:10px;border-radius:6px;overflow:auto;white-space:pre;"><code>${escapeHtml(code)}</code></pre>`);
  }
  if (listOpen) html.push("</ul>");

  return html.join("");
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatInline(text) {
  let t = escapeHtml(text);
  // inline code
  t = t.replace(/`([^`]+)`/g, '<code style="background:#f6f8fa;padding:1px 4px;border-radius:4px;">$1<\/code>');
  // bold
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1<\/strong>');
  // italic (simple)
  t = t.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1<\/em>');
  // links
  t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1<\/a>');
  return t;
}
