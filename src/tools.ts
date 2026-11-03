// Tool registry shared by the stdio and Worker entries.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  InputError, METHODS, REPO, SITE, calculateRawWeightToBuy, convertCookedToRaw, convertRawToCooked, findCookingYield, listCookingYields,
} from './core.js';

export const VERSION = '1.0.0';

export const TOOL_INFO = [
  { name: 'convert_raw_to_cooked', blurb: 'Cooked weight of a raw cut of meat or poultry (chicken thigh, 80/20 ground beef, pork tenderloin, bacon) by cooking method, from USDA measured cooking yields.' },
  { name: 'convert_cooked_to_raw', blurb: 'Raw weight behind a cooked portion, for logging macros against raw nutrition labels or scaling a recipe.' },
  { name: 'calculate_raw_weight_to_buy', blurb: 'How much raw meat to buy for a number of cooked servings.' },
  { name: 'find_cooking_yield', blurb: 'USDA cooking yield, sample range, moisture loss and fat loss for a cut and cooking method, with close alternatives.' },
  { name: 'list_cooking_yields', blurb: 'Browse all 173 rows of the USDA table by category (beef, pork, poultry, lamb/veal/game) and cooking method.' },
];

const RO = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;

function ok(data: Record<string, unknown> & { summary: string }) {
  return { content: [{ type: 'text' as const, text: `${data.summary}\n\n${JSON.stringify(data, null, 2)}` }], structuredContent: data };
}
function fail(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  return { isError: true, content: [{ type: 'text' as const, text: `${e instanceof InputError ? 'Error' : 'Internal error'}: ${msg}` }] };
}

const food = z.string().min(2).max(160).describe('Cut and species in plain words, for example "chicken thigh", "80/20 ground beef patty", "ribeye steak", "pork tenderloin", "bacon", "turkey breast", "bison burger".');
const method = z.string().min(2).max(40).optional().describe(`Cooking method: ${Object.keys(METHODS).join(', ')}. Plain words work too (grilled, baked, slow cooker, sauteed, boiled).`);
const yieldId = z.number().int().min(1).max(500).optional().describe('Exact row id from find_cooking_yield or list_cooking_yields. Overrides food and method.');
const unit = z.string().min(1).max(12).optional().describe('Weight unit: g, kg, oz or lb. Default g.');

export function createServer(): McpServer {
  const server = new McpServer({ name: REPO, version: VERSION, websiteUrl: SITE } as any, {
    instructions:
      'Raw to cooked weight conversions for meat and poultry from the USDA Table of Cooking Yields for Meat and Poultry (ARS, Release 2, 173 measured cut and method rows). ' +
      'Yields differ a lot by cut, fat level and method (bacon keeps about 30% of its raw weight, a cured ham 85-96%), so do not use a flat 25% loss: call these tools.',
  });

  server.registerTool('convert_raw_to_cooked', {
    title: 'Convert raw to cooked weight',
    description:
      'Cooked weight of raw meat or poultry using the USDA measured cooking yield for that cut and cooking method (USDA Table of Cooking Yields for Meat and Poultry). ' +
      'Returns the expected cooked weight in g, oz, lb and kg, the range seen across USDA samples, the weight lost, and the USDA row used. Understands ground beef lean ratios such as 80/20 or 93% lean.',
    inputSchema: { food: food.optional(), method, yield_id: yieldId, raw_weight: z.number().positive().max(1e6).describe('Raw weight, for example 1.5 or 500.'), unit },
    annotations: { title: 'Raw to cooked weight', ...RO },
  }, async (a) => {
    try { return ok(convertRawToCooked(a) as any); } catch (e) { return fail(e); }
  });

  server.registerTool('convert_cooked_to_raw', {
    title: 'Convert cooked to raw weight',
    description:
      'Raw weight that a cooked portion of meat or poultry came from, using the USDA measured cooking yield. Use it to log a cooked portion against raw nutrition data (labels and most databases list raw meat) or to scale a recipe written in cooked weight. ' +
      'Returns raw weight in g, oz, lb and kg, and the raw weight if the yield was at the USDA high or low end.',
    inputSchema: { food: food.optional(), method, yield_id: yieldId, cooked_weight: z.number().positive().max(1e6).describe('Cooked weight, for example 150.'), unit },
    annotations: { title: 'Cooked to raw weight', ...RO },
  }, async (a) => {
    try { return ok(convertCookedToRaw(a) as any); } catch (e) { return fail(e); }
  });

  server.registerTool('calculate_raw_weight_to_buy', {
    title: 'Calculate raw meat to buy',
    description:
      'How much raw meat or poultry to buy for a number of cooked servings, from the USDA cooking yield for that cut and method. Default cooked serving is 3 oz (85 g).',
    inputSchema: {
      food: food.optional(), method, yield_id: yieldId,
      servings: z.number().positive().max(10000).describe('Number of servings, for example 8.'),
      cooked_serving_size: z.number().positive().max(10000).optional().describe('Cooked weight per serving in the chosen unit. Default 3 oz or 85 g.'),
      unit: z.string().min(1).max(12).optional().describe('Unit of cooked_serving_size: g, kg, oz or lb. Default oz.'),
    },
    annotations: { title: 'Raw meat to buy', ...RO },
  }, async (a) => {
    try { return ok(calculateRawWeightToBuy(a) as any); } catch (e) { return fail(e); }
  });

  server.registerTool('find_cooking_yield', {
    title: 'Find USDA cooking yield',
    description:
      'Look up the USDA cooking yield percent for a cut of meat or poultry and a cooking method, with the yield range, sample count, moisture change and fat change measured by USDA, plus up to 4 close alternative rows with their yield_id.',
    inputSchema: { food, method, limit: z.number().int().min(1).max(20).optional().describe('Rows to return, default 5.') },
    annotations: { title: 'USDA cooking yield', ...RO },
  }, async (a) => {
    try { return ok(findCookingYield(a) as any); } catch (e) { return fail(e); }
  });

  server.registerTool('list_cooking_yields', {
    title: 'List USDA cooking yields',
    description: 'List rows of the USDA Table of Cooking Yields for Meat and Poultry, filtered by category (beef, pork, poultry, chicken, turkey, lamb, veal, game, sausage) and cooking method.',
    inputSchema: {
      category: z.string().min(3).max(30).optional().describe('beef, pork, poultry, chicken, turkey, lamb, veal, game or sausage.'),
      method,
    },
    annotations: { title: 'List cooking yields', ...RO },
  }, async (a) => {
    try { return ok(listCookingYields(a) as any); } catch (e) { return fail(e); }
  });

  return server;
}
