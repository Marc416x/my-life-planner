/* ============================================================
   MyLifePlanner — export.js
   Data export — CSV and PDF/print export helpers.
   ============================================================ */

// ---------- 7.8 DATA EXPORT (real client-side CSV + printable PDF report) ----------
function downloadBlob(content, filename, mime) {
  var blob = new Blob([content], { type: mime });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function csvEscape(v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }
function exportDataCSV() {
  var scope = document.getElementById('export-scope').value;
  var rows = [['Section', 'Field 1', 'Field 2', 'Field 3', 'Field 4']];
  sampleCourses.forEach(function(c) { rows.push(['Course', c.name, c.credits + ' credits', c.gradePct + '%', 'weight ' + c.weightPct + '%']); });
  drugLog.forEach(function(d) { d.drugs.forEach(function(dr) { rows.push(['Drug Log', d.date, dr.name, dr.cls, dr.dose]); }); });
  nclexSessions.forEach(function(n) { rows.push(['NCLEX Session', n.date, nclexCatNames[n.cat], n.correct + '/' + n.done, n.pct + '%']); });
  dailyTasks.forEach(function(t) { rows.push(['Daily Task', t.text || t, t.done ? 'Done' : 'Pending', '', '']); });
  weeklyGoals.forEach(function(g) { rows.push(['Weekly Goal', g.text || g, g.done ? 'Done' : 'Pending', '', '']); });
  var csv = rows.map(function(r) { return r.map(csvEscape).join(','); }).join('\n');
  downloadBlob(csv, 'mylifeplanner-export-' + scope + '.csv', 'text/csv');
  showNotif('⬇ CSV exported!');
}
function exportDataPDF() {
  var scope = document.getElementById('export-scope').value;
  var gpa = computeCreditWeightedGPA(sampleCourses).toFixed(2);
  var win = window.open('', '_blank');
  var html = '<html><head><title>MyLifePlanner Report</title><style>' +
    'body{font-family:Georgia,serif;padding:2rem;color:#2D1F14;} h1{font-family:Georgia,serif;} table{width:100%;border-collapse:collapse;margin-top:1rem;} td,th{border:1px solid #ccc;padding:6px 10px;text-align:left;font-size:0.85rem;}' +
    '</style></head><body>' +
    '<h1>MyLifePlanner — Semester Report</h1>' +
    '<p><strong>Student:</strong> ' + (userData.name || 'Student') + ' &nbsp; <strong>Scope:</strong> ' + scope + ' &nbsp; <strong>GPA:</strong> ' + gpa + '</p>' +
    '<h3>Courses</h3><table><tr><th>Course</th><th>Credits</th><th>Grade %</th><th>Weight %</th></tr>' +
    sampleCourses.map(function(c) { return '<tr><td>' + c.name + '</td><td>' + c.credits + '</td><td>' + c.gradePct + '%</td><td>' + c.weightPct + '%</td></tr>'; }).join('') +
    '</table><h3>Clinical Hours</h3><p>' + (clinicalVal || 0) + ' hours logged this semester.</p>' +
    '<script>window.onload = function(){ window.print(); };<' + '/script>' +
    '</body></html>';
  win.document.write(html);
  win.document.close();
  showNotif('⬇ PDF report opened — use your browser\'s Print dialog to save as PDF.');
}
