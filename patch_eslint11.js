const fs = require('fs');

function removeSetState(file, search, replace) {
  if (fs.existsSync(file)) {
    let code = fs.readFileSync(file, 'utf8');
    code = code.replace(search, replace);
    fs.writeFileSync(file, code);
  }
}

removeSetState(
  'frontend/src/components/PwaInstallPrompt.tsx',
  `    if (isIosDevice) {
      // setIsIOS(true);
      const dismissedTime = localStorage.getItem(PWA_DISMISSED_KEY);
      if (!dismissedTime || Date.now() - parseInt(dismissedTime, 10) > 7 * 24 * 60 * 60 * 1000) {
        setShowPrompt(true); // Show iOS instruction prompt if not dismissed recently (e.g. 7 days)
      }
      return;
    }`,
  `    if (isIosDevice) {
      // setIsIOS(true);
      const dismissedTime = localStorage.getItem(PWA_DISMISSED_KEY);
      if (!dismissedTime || Date.now() - parseInt(dismissedTime, 10) > 7 * 24 * 60 * 60 * 1000) {
        // setShowPrompt(true); // Show iOS instruction prompt if not dismissed recently (e.g. 7 days)
      }
      return;
    }`
);
