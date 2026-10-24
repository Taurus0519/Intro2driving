// Supabase limits each response to a page; totals must include every page.
export async function fetchAllRows(buildQuery) {
  const pageSize = 1000;
  const rows = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await buildQuery().range(
      offset,
      offset + pageSize - 1,
    );
    if (error) return { data: null, error };
    rows.push(...(data || []));
    if (!data || data.length < pageSize) return { data: rows, error: null };
  }
}

export function summarizeSuccess(rows, maximumField) {
  let earned = 0;
  let possible = 0;
  let attempts = 0;
  for (const row of rows || []) {
    if (row.score == null || row[maximumField] == null) continue;
    const score = Number(row.score);
    const maximum = Number(row[maximumField]);
    if (
      !Number.isFinite(score) ||
      !Number.isFinite(maximum) ||
      maximum <= 0 ||
      score < 0 ||
      score > maximum
    )
      continue;
    earned += score;
    possible += maximum;
    attempts += 1;
  }
  return {
    earned,
    possible,
    remaining: possible - earned,
    attempts,
    percentage: possible > 0 ? (earned / possible) * 100 : null,
  };
}
