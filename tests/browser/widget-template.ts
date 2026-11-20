import { execFileSync } from 'node:child_process';

// Render the actual installed widget template rather than maintaining a second
// copy of its controls in the standalone editor/clipboard harnesses.
export const widgetArguments: [string, Record<string, string>] = JSON.parse(execFileSync(
  '.venv/bin/python', ['-c', `
import json
import django
django.setup()
from wagtail_table.widgets import TableInput, TableInputAdapter
print(json.dumps(TableInputAdapter().js_args(TableInput())))
`],
  { encoding: 'utf8', env: { ...process.env, DJANGO_SETTINGS_MODULE: 'tests.test_project.settings' } },
));
