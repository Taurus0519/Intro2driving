import test from "node:test";
import assert from "node:assert/strict";
import { getStudentAgeGroups } from "../api/student-age-distribution.mjs";

test("age distribution excludes admins, super admins, and orphaned personal records", () => {
  const accounts = [
    { id: "student-one", role: "student" },
    { id: "student-two", role: "student" },
    { id: "admin", role: "admin" },
    { id: "super-admin", role: "superadmin" },
  ];
  const profiles = [
    { student_id: "student-one", age: 20 },
    { student_id: "student-two", age: 42 },
    { student_id: "admin", age: 30 },
    { student_id: "super-admin", age: 17 },
    { student_id: "deleted-student", age: 21 },
  ];
  const expected = { "16-17": 0, "18-24": 1, "25-34": 0, "35+": 1 };
  assert.deepEqual(getStudentAgeGroups(accounts, profiles), expected);

  profiles[2].date_of_birth = "1980-01-01";
  profiles[3].date_of_birth = "2000-01-01";
  assert.deepEqual(
    getStudentAgeGroups(accounts, profiles),
    expected,
    "Staff birthday edits never change student totals",
  );
});

test("changing a student to a staff role removes their age from student statistics", () => {
  const accounts = [{ id: "person", role: "student" }];
  const profiles = [{ student_id: "person", age: 23 }];
  assert.equal(getStudentAgeGroups(accounts, profiles)["18-24"], 1);
  accounts[0].role = "admin";
  assert.deepEqual(getStudentAgeGroups(accounts, profiles), {
    "16-17": 0,
    "18-24": 0,
    "25-34": 0,
    "35+": 0,
  });
});

test("age distribution uses valid student birthdays and ignores missing or invalid ages", () => {
  const accounts = ["birthday", "missing", "invalid", "future"].map((id) => ({
    id,
    role: "student",
  }));
  const year = new Date().getUTCFullYear();
  const profiles = [
    { student_id: "birthday", age: 17, date_of_birth: `${year - 40}-01-01` },
    { student_id: "missing", age: null },
    { student_id: "invalid", age: -1 },
    { student_id: "future", date_of_birth: `${year + 1}-01-01` },
  ];
  assert.deepEqual(getStudentAgeGroups(accounts, profiles), {
    "16-17": 0,
    "18-24": 0,
    "25-34": 0,
    "35+": 1,
  });
});
