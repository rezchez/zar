const fs = require('fs');

function removeSetState(file, search, replace) {
  if (fs.existsSync(file)) {
    let code = fs.readFileSync(file, 'utf8');
    code = code.replace(search, replace);
    fs.writeFileSync(file, code);
  }
}

removeSetState(
  'frontend/src/components/InvoicePrintDesigner.tsx',
  `  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);`,
  `  useEffect(() => {
    // skip effect cascade
  }, [fetchTemplates]);`
);
