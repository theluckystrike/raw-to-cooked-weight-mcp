# Data sources

All numbers were fetched on 2026-11-03. Nothing comes from model memory.

## Cooking yields

- USDA Agricultural Research Service, Methods and Application of Food Composition Laboratory, cooking yields page:
  https://www.ars.usda.gov/northeast-area/beltsville-md-bhnrc/beltsville-human-nutrition-research-center/methods-and-application-of-food-composition-laboratory/mafcl-site-pages/cooking-yields/ (fetched 2026-11-03, HTTP 200). The page links both files below.
- USDA Table of Cooking Yields for Meat and Poultry, Release 2 (September 2014), Excel:
  https://www.ars.usda.gov/ARSUserFiles/80400535/Data/retn/USDA_CookingYields_MeatPoultry02.xlsx
  (fetched 2026-11-03, HTTP 200, 35,078 bytes, sha256 13bd2cec633841867bf8532ed57114c81f3791b9bcd35a396dec6a1b960773ff).
  Saved as `data/USDA_CookingYields_MeatPoultry02.xlsx`. Sheet 1 has 175 rows under the header: 173 data rows and 2 footnotes.
- Same table, PDF with methods, definitions and glossary:
  https://www.ars.usda.gov/ARSUserFiles/80400535/Data/retn/USDA_CookingYields_MeatPoultry02.pdf
  (fetched 2026-11-03, HTTP 200, 100,996 bytes, sha256 69492fdf8334e8fbcf4a9204e70d685cbca5cf32f6e99a6648976db833e53765).
  Used for: Yield (%) = 100 x (Wch / Wcr), hot cooked weight over raw weight (p. 5); column definitions and the
  note that 1975 rows come from Agriculture Handbook 102 and have no n, SD, moisture or fat change (p. 27-28);
  preparation method definitions (p. 28).

`scripts/build_data.py` reads the xlsx with the Python standard library and writes `data/cooking-yields.json`
(173 rows: beef 66, pork 58, poultry 35, lamb, veal and game 12, sausages 2). `scripts/gen_ts.py` embeds it as
`src/data.ts`. Values are copied unchanged; only display rounding to 0.1% is applied in answers.

## Ground meat fat classes

The class boundaries are the USDA row labels themselves: beef low fat (<12%), medium fat (12%-22%), high fat
(>22%); pork low fat (<10%), medium fat (10%-27%), high fat (>27%). A lean ratio such as 80/20 is read as 20% fat.

## Units

- NIST SP 811 Appendix B.9, https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors/nist-guide-si-appendix-b9:
  1 lb = 0.45359237 kg exactly, 1 oz = 1/16 lb = 28.349523125 g.

## Money site

- https://recipetool.net/tools/raw-to-cooked-weight-calculator (HTTP 200 with the UTM query on 2026-11-03, listed in https://recipetool.net/sitemap.xml).
