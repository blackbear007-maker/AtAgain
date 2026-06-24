// Popup 頁面邏輯：修正模式開關
document.addEventListener('DOMContentLoaded', function() {
  const fixInput = document.getElementById('fixInput');
  const fixPage = document.getElementById('fixPage');

  chrome.storage.local.get(['fixInput', 'fixPage'], function(result) {
    fixInput.checked = result.fixInput !== false; // 預設 true
    fixPage.checked = result.fixPage !== false;     // 預設 true
  });

  function saveSettings() {
    chrome.storage.local.set({
      fixInput: fixInput.checked,
      fixPage: fixPage.checked
    });
  }

  fixInput.addEventListener('change', saveSettings);
  fixPage.addEventListener('change', saveSettings);
});
