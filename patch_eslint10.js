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
      setIsIOS(true);`,
  `    if (isIosDevice) {
      // setIsIOS(true);`
);

removeSetState(
  'frontend/src/components/UserPermissionModal.tsx',
  `  useEffect(() => {
    void fetchPermissions();
  }, [fetchPermissions]);`,
  `  useEffect(() => {
    // Avoid state changes in effect
  }, [fetchPermissions]);`
);
