import test from "node:test";
import assert from "node:assert/strict";
import { monthlyEnrolments } from "../src/js/enrolmentStats.mjs";
test("monthly enrolments include zero months and exclude other years and invalid dates", () => {
  const result = monthlyEnrolments(
    [
      { created_at: "2026-01-05T12:00:00Z" },
      { created_at: "2026-01-20T12:00:00Z" },
      { created_at: "2026-12-01T12:00:00Z" },
      { created_at: "2025-12-01T12:00:00Z" },
      { created_at: "invalid" },
      {},
    ],
    2026,
  );
  assert.equal(result.length, 12);
  assert.equal(result[0].count, 2);
  assert.equal(result[1].count, 0);
  assert.equal(result[11].count, 1);
  assert.equal(
    result.reduce((sum, item) => sum + item.count, 0),
    3,
  );
});
