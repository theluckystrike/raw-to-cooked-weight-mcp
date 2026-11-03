export interface YieldRow {
  id: number;
  group: string;
  group_code: string;
  ndb: string | null;
  description: string;
  method: string;
  yield_pct: number;
  n: number | null;
  sd: number | null;
  min_pct: number | null;
  max_pct: number | null;
  moisture_change_pct: number | null;
  fat_change_pct: number | null;
  release_year: number | null;
}
