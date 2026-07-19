/* ============================================================
   MyLifePlanner — grades.js
   Grades & GPA — grade-point conversion, credit-weighted GPA, unweighted average, dashboard render.
   ============================================================ */

function pctToGradePoint(pct) {
  if (pct >= 93) return 4.0; if (pct >= 90) return 3.7; if (pct >= 87) return 3.3;
  if (pct >= 83) return 3.0; if (pct >= 80) return 2.7; if (pct >= 77) return 2.3;
  if (pct >= 73) return 2.0; if (pct >= 70) return 1.7; if (pct >= 60) return 1.0;
  return 0.0;
}
function computeCreditWeightedGPA(courses) {
  var totalCredits = courses.reduce(function(s, c) { return s + c.credits; }, 0);
  var points = courses.reduce(function(s, c) { return s + pctToGradePoint(c.gradePct) * c.credits; }, 0);
  return totalCredits ? (points / totalCredits) : 0;
}
function computeUnweightedAverage(courses) {
  var sum = courses.reduce(function(s, c) { return s + c.gradePct; }, 0);
  return courses.length ? (sum / courses.length) : 0;
}
function renderGPA() {
  var gpaEl = document.querySelector('.gpa-val');
  if (!gpaEl) return;
  var gpa = computeCreditWeightedGPA(sampleCourses);
  var avg = computeUnweightedAverage(sampleCourses);
  gpaEl.textContent = gpa.toFixed(1);
  var sub = document.querySelector('.gpa-val').parentElement.querySelector('div[style*="font-size:0.78rem"]');
  if (sub) sub.innerHTML = 'Spring 2026 Semester<br><span style="font-size:0.68rem;">Unweighted avg: ' + avg.toFixed(1) + '%</span>';
}
