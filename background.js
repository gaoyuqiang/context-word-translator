chrome.commands.onCommand.addListener((command) => {
  if (command === "lookup-word") {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, {action: "lookup"});
    });
  }
  if (command === "lookup-local-word") {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, {action: "lookupLocal"});
    });
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.action === "getLocalDict") {
    const url = chrome.runtime.getURL("四级.txt");
    fetch(url)
      .then(r => r.text())
      .then(text => sendResponse({ ok: true, text }))
      .catch(err => sendResponse({ ok: false, error: String(err) }));
    return true;
  }
});
