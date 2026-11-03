# raw-to-cooked-weight-mcp

Raw to cooked weight for meat and poultry, for AI assistants, by cut and cooking method, from the USDA Table of Cooking Yields for Meat and Poultry.

This is a Model Context Protocol (MCP) server. It converts raw weight to cooked weight and cooked weight back to raw weight with the cooking yields USDA measured for 173 cut and method pairs of beef, pork, chicken, turkey, lamb, veal, bison and game. It needs no API key.

## Tools

| Tool | What it returns |
| --- | --- |
| `convert_raw_to_cooked` | Cooked weight of a raw cut (chicken thigh, 80/20 ground beef, pork tenderloin, bacon) in g, oz, lb and kg, the range seen across USDA samples, the weight lost and the USDA row used. |
| `convert_cooked_to_raw` | Raw weight behind a cooked portion, for logging food against raw nutrition labels or scaling a recipe written in cooked weight. |
| `calculate_raw_weight_to_buy` | How much raw meat to buy for a number of cooked servings (default 3 oz cooked). |
| `find_cooking_yield` | USDA cooking yield percent, sample range, moisture change and fat change for a cut and method, with close alternatives and their `yield_id`. |
| `list_cooking_yields` | All rows of the USDA table by category (beef, pork, poultry, chicken, turkey, lamb, veal, game, sausage) and method. |

Every result has structured JSON, a one-paragraph summary, `as_of`, `source` and `more` (the [raw to cooked weight calculator on recipetool.net](https://recipetool.net/tools/raw-to-cooked-weight-calculator?utm_source=mcp&utm_medium=raw-to-cooked-weight-mcp)).

## What it knows that your model does not

- Yields differ by cut, fat level and method. A flat "meat loses 25%" rule is wrong for most cuts. USDA measured bacon at 29 to 32% of its raw weight, 80/20 ground beef crumbles at 67%, a grilled bone-in rib eye steak at 85.7% and a boneless cured ham at 94 to 96%.
- The exact USDA number, its sample count and its range. Roast chicken thigh is 69%, but USDA samples ran from 58% to 79%. The tools return both.
- Ground meat lean ratios. "80/20", "93% lean" and "73/27" map to the USDA low, medium and high fat classes for beef (under 12%, 12 to 22%, over 22% fat) and pork (under 10%, 10 to 27%, over 27%).
- What is not covered. Fish, seafood, rice, pasta and vegetables are not in the USDA table. The tools say so instead of guessing.

## Install

### Hosted (Claude.ai custom connector, ChatGPT developer mode)

Paste this URL. No token, no sign-up.

```
https://raw-to-cooked-weight-mcp.lipmichal.workers.dev/mcp
```

### Claude Code

```
claude mcp add --transport http raw-to-cooked https://raw-to-cooked-weight-mcp.lipmichal.workers.dev/mcp
```

Or run it locally over stdio:

```
claude mcp add raw-to-cooked -- npx -y github:theluckystrike/raw-to-cooked-weight-mcp
```

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "raw-to-cooked": { "command": "npx", "args": ["-y", "github:theluckystrike/raw-to-cooked-weight-mcp"] }
  }
}
```

### Cursor

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "raw-to-cooked": { "url": "https://raw-to-cooked-weight-mcp.lipmichal.workers.dev/mcp" }
  }
}
```

### VS Code

Add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "raw-to-cooked": { "type": "http", "url": "https://raw-to-cooked-weight-mcp.lipmichal.workers.dev/mcp" }
  }
}
```

Node 20 or newer is needed for the local stdio version.

## Example prompts

- "I weighed 150 g of cooked chicken thigh. What was the raw weight for my macro log?"
- "How much does 2 lb of raw 80/20 ground beef weigh after browning?"
- "How much raw brisket do I buy to serve 12 people 4 oz cooked each?"
- "What percent of its weight does bacon lose in the microwave?"
- "Which pork cuts keep the most weight when grilled?"

## Data sources

Full list with fetch dates and checksums in [DATA_SOURCES.md](DATA_SOURCES.md).

- USDA Agricultural Research Service, Nutrient Data Laboratory. USDA Table of Cooking Yields for Meat and Poultry, Release 2, September 2014. [PDF](https://www.ars.usda.gov/ARSUserFiles/80400535/Data/retn/USDA_CookingYields_MeatPoultry02.pdf) and [Excel](https://www.ars.usda.gov/ARSUserFiles/80400535/Data/retn/USDA_CookingYields_MeatPoultry02.xlsx). The Excel file is in `data/` and `scripts/build_data.py` rebuilds the table from it.
- Pound and ounce from NIST SP 811 (1 lb = 453.59237 g exactly).

## Limitations

- USDA yield is hot cooked weight over raw weight of the same piece, cooked to USDA research protocols. Doneness, trim, bone, brines and how much of the pan juice you keep move your result. The tools return the USDA range when there is one.
- Rows with a 1975 release year come from USDA Agriculture Handbook 102. They have no sample count, moisture or fat change.
- A bone-in cut keeps its bone in both weights. Boneless skinless chicken breast and grilled chicken breast are not in the table; the tools return the closest row and say so.
- Fish, seafood, duck, eggs, rice, pasta and vegetables are not covered.

## More

The raw to cooked weight calculator and recipe nutrition tools are on [recipetool.net](https://recipetool.net/tools/raw-to-cooked-weight-calculator?utm_source=mcp&utm_medium=raw-to-cooked-weight-mcp).

Part of the Zovo MCP collection: https://mcp.zovo.one

## Development

```
npm install
npm test                       # builds, then runs the fixture tests
node scripts/smoke-stdio.mjs   # stdio check, one real call per tool
python3 scripts/build_data.py data/USDA_CookingYields_MeatPoultry02.xlsx data/cooking-yields.json
python3 scripts/gen_ts.py data/cooking-yields.json src/data.ts
npx wrangler deploy            # Cloudflare Worker, Streamable HTTP at /mcp
```

## License

MIT
