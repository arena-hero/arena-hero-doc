import {Parser, fromFile} from '@asyncapi/parser';
import {fileURLToPath} from 'node:url';

const source = fileURLToPath(new URL('../static/asyncapi.yaml', import.meta.url));
const parser = new Parser();
const diagnostics = await fromFile(parser, source).validate();

for (const diagnostic of diagnostics) {
  const location = diagnostic.range
    ? `${diagnostic.range.start.line + 1}:${diagnostic.range.start.character + 1}`
    : 'unknown';
  console.error(
    `${diagnostic.severity === 0 ? 'error' : 'warning'} ${location} ` +
      `${diagnostic.code ?? 'asyncapi'}: ${diagnostic.message}`,
  );
}

const errors = diagnostics.filter((diagnostic) => diagnostic.severity === 0);
if (errors.length > 0) {
  process.exitCode = 1;
} else {
  console.log('static/asyncapi.yaml is valid.');
}
