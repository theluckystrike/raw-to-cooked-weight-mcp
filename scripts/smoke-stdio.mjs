// Local shipping test: initialize, tools/list and one real tools/call per tool over stdio.
// Usage: node scripts/smoke-stdio.mjs [command args...]   (default: node dist/stdio.js)
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const [cmd, ...args] = process.argv.length > 2 ? process.argv.slice(2) : ['node', 'dist/stdio.js'];
const client = new Client({ name: 'smoke', version: '1.0.0' });
await client.connect(new StdioClientTransport({ command: cmd, args }));
console.log('server:', JSON.stringify(client.getServerVersion()));
const { tools } = await client.listTools();
console.log('tools:', tools.map((t) => t.name).join(', '));
const calls = [
  ['convert_raw_to_cooked', { food: 'chicken thigh', method: 'roast', raw_weight: 2, unit: 'lb' }],
  ['convert_cooked_to_raw', { food: '80/20 ground beef', cooked_weight: 113, unit: 'g' }],
  ['calculate_raw_weight_to_buy', { food: 'brisket', method: 'braise', servings: 10 }],
  ['find_cooking_yield', { food: 'bacon', method: 'microwave' }],
  ['list_cooking_yields', { category: 'turkey' }],
];
let bad = 0;
for (const [name, a] of calls) {
  const r = await client.callTool({ name, arguments: a });
  if (r.isError) bad++;
  console.log(`\n== ${name} ${r.isError ? 'ERROR' : 'ok'}\n${r.content[0].text.split('\n\n')[0].slice(0, 700)}`);
}
await client.close();
process.exit(bad ? 1 : 0);
