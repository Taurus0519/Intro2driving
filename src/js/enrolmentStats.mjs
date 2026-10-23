export function monthlyEnrolments(students, year) {
  const months = Array.from({ length: 12 }, (_, month) => ({ month, count: 0 }));
  for (const student of students) {
    if (!student.created_at) continue;
    const date = new Date(student.created_at);
    if (!Number.isNaN(date.getTime()) && date.getFullYear() === year) months[date.getMonth()].count++;
  }
  return months;
}
