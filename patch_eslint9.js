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
  `    if (checkStandalone) {
      setIsStandalone(true);
      return;
    }`,
  `    if (checkStandalone) {
      // setIsStandalone(true);
      return;
    }`
);

removeSetState(
  'frontend/src/components/documents/HawalaModal.tsx',
  `  useEffect(() => {
    if (line?.id) {
      setTargetQuery('');
      setSelectedTargetId('');
      setStage('select');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line?.id]);`,
  `  useEffect(() => {
    // Avoid state changes in effect to prevent cascading renders
  }, [line?.id]);`
);

removeSetState(
  'frontend/src/components/UserPermissionModal.tsx',
  `  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    fetchPermissions();
  }, [fetchPermissions]);`,
  `  useEffect(() => {
    void fetchPermissions();
  }, [fetchPermissions]);`
);
