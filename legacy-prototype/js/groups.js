/* ============================================================
   MyLifePlanner — groups.js
   Peer groups — create/join/leave groups, leaderboards, group chat, sharing quizzes.
   ============================================================ */

function genInviteCode() {
  return 'NUR-' + Math.random().toString(36).substring(2, 6).toUpperCase();
}
function onGroupTypeChange() {
  var type = document.getElementById('new-group-type').value;
  var modeSelect = document.getElementById('new-group-streak-mode');
  var note = document.getElementById('institutional-group-note');
  if (type === 'institutional') {
    modeSelect.value = 'threshold';
    modeSelect.disabled = true;
    note.style.display = 'block';
  } else {
    modeSelect.disabled = false;
    note.style.display = 'none';
  }
}
function createGroup() {
  var name = document.getElementById('new-group-name').value.trim();
  if (!name) { showNotif('Please name your group ⚠️'); return; }
  var type = document.getElementById('new-group-type').value;
  // Institutional groups are hard-locked to threshold mode, even if the UI were bypassed.
  var streakMode = type === 'institutional' ? 'threshold' : document.getElementById('new-group-streak-mode').value;
  currentGroup = { name: name, code: genInviteCode(), messages: [], streak: 0, quizzes: [], type: type, streakMode: streakMode, thresholdPct: 60 };
  enterGroup();
  showNotif('👥 ' + (type === 'institutional' ? 'Institutional cohort' : 'Group') + ' "' + name + '" created! Share code ' + currentGroup.code);
}
function joinGroup() {
  var code = document.getElementById('join-group-code').value.trim().toUpperCase();
  if (!code) { showNotif('Please enter an invite code ⚠️'); return; }
  currentGroup = { name: 'NUR301 Study Squad', code: code, messages: [], streak: 3, quizzes: [], type: 'peer', streakMode: 'threshold', thresholdPct: 60 };
  enterGroup();
  showNotif('🎉 Joined group with code ' + code + '!');
}
function enterGroup() {
  document.getElementById('groups-no-group-view').style.display = 'none';
  document.getElementById('groups-active-view').style.display = 'block';
  document.getElementById('active-group-name').textContent = '👥 ' + currentGroup.name;
  document.getElementById('active-group-code').textContent = currentGroup.code;
  document.getElementById('active-group-member-count').textContent = mockGroupMembers.length;
  document.getElementById('group-streak-val').textContent = currentGroup.streak;
  var typeBadge = document.getElementById('active-group-type-badge');
  var modeBadge = document.getElementById('active-group-streakmode-badge');
  var explainer = document.getElementById('active-group-streak-explainer');
  typeBadge.textContent = currentGroup.type === 'institutional' ? '🏫 Institutional Cohort' : '👥 Peer Group';
  modeBadge.textContent = currentGroup.streakMode === 'strict' ? 'Strict Streak' : 'Threshold Streak (' + currentGroup.thresholdPct + '%)';
  explainer.textContent = currentGroup.streakMode === 'strict'
    ? 'Strict mode: every active member has to study each day for the group streak to increment. High accountability — one missed day pauses it for everyone.'
    : 'Threshold mode: your group\'s streak grows any day ' + currentGroup.thresholdPct + '%+ of active members study — one person\'s off day won\'t reset it for everyone.';
  document.getElementById('settings-no-group').style.display = 'none';
  document.getElementById('settings-has-group').style.display = 'flex';
  document.getElementById('settings-group-name-label').textContent = currentGroup.name;
  renderGroupLeaderboard();
  renderGroupMessages();
  renderOtherGroupsLeaderboard('other-groups-list-active');
}
function leaveGroup() {
  if (!confirm('Leave this study group?')) return;
  currentGroup = null;
  document.getElementById('groups-no-group-view').style.display = 'block';
  document.getElementById('groups-active-view').style.display = 'none';
  document.getElementById('settings-no-group').style.display = 'block';
  document.getElementById('settings-has-group').style.display = 'none';
  showNotif('You left the group.');
}
function switchGroupTab(tab, btn) {
  document.querySelectorAll('#groups-active-view .tab-btn').forEach(function(b){ b.classList.remove('active'); });
  document.querySelectorAll('#groups-active-view .tab-content').forEach(function(c){ c.classList.remove('active'); });
  btn.classList.add('active');
  document.getElementById('group-tab-' + tab).classList.add('active');
}
function renderGroupLeaderboard() {
  var el = document.getElementById('group-leaderboard-list');
  var userStreak = parseInt(document.getElementById('streak-count') ? document.getElementById('streak-count').textContent : '0') || 0;
  var members = mockGroupMembers.map(function(m) { return m.isUser ? Object.assign({}, m, { streak: userStreak }) : m; });
  members.sort(function(a, b) { return b.streak - a.streak; });
  el.innerHTML = members.map(function(m, i) {
    var gradeLabel = m.shareGrade && m.practiceGrade != null ? 'Mastery ' + m.practiceGrade + '%' : 'Mastery private';
    return '<div class="group-rank-row"><div class="group-rank-num">' + (i + 1) + '</div>' +
      '<div style="flex:1;font-weight:' + (m.isUser ? '600' : '400') + ';">' + m.name + (m.isUser ? ' (you)' : '') + '</div>' +
      '<div style="color:var(--text-muted);font-size:0.78rem;">' + gradeLabel + '</div>' +
      '<div style="font-family:\'Caveat\',cursive;font-weight:700;color:var(--terracotta);">' + m.streak + '🔥</div></div>';
  }).join('');
}
function renderOtherGroupsLeaderboard(targetId) {
  var el = document.getElementById(targetId || 'other-groups-list');
  if (!el) return;
  var sorted = otherPeerGroups.slice().sort(function(a, b) { return b.streak - a.streak; });
  el.innerHTML = sorted.map(function(g, i) {
    return '<div class="group-rank-row" style="align-items:flex-start;flex-wrap:wrap;">' +
      '<div class="group-rank-num">' + (i + 1) + '</div>' +
      '<div style="flex:1;min-width:160px;">' +
        '<div style="font-weight:600;font-size:0.85rem;">' + g.name + '</div>' +
        '<div style="font-size:0.72rem;color:var(--text-muted);">' + g.members.join(', ') + '</div>' +
      '</div>' +
      '<div style="color:var(--text-muted);font-size:0.78rem;">avg mastery ' + g.avgPracticeGrade + '%</div>' +
      '<div style="font-family:\'Caveat\',cursive;font-weight:700;color:var(--terracotta);">' + g.streak + '🔥</div>' +
    '</div>';
  }).join('');
}
function shareQuizWithGroup() {
  if (!currentGroup) return;
  currentGroup.quizzes.push({ name: 'Pharmacology — Quiz 1', score: 91, date: new Date().toLocaleDateString() });
  var el = document.getElementById('group-quizzes-list');
  el.innerHTML = currentGroup.quizzes.map(function(q) {
    return '<div class="group-msg" style="margin-bottom:0.5rem;"><strong>' + q.name + '</strong> — ' + q.score + '% · shared ' + q.date + '</div>';
  }).join('');
  showNotif('📝 Quiz shared with the group!');
}
function sendGroupMessage() {
  if (!currentGroup) return;
  var input = document.getElementById('group-message-input');
  var msg = input.value.trim();
  if (!msg) return;
  currentGroup.messages.push({ from: 'You', text: msg, time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) });
  input.value = '';
  renderGroupMessages();
}
function renderGroupMessages() {
  var el = document.getElementById('group-messages-list');
  if (!currentGroup || !currentGroup.messages.length) {
    el.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:1rem;font-family:\'Nunito\',sans-serif;font-style:italic;">No messages yet — say hi to your group!</div>';
    return;
  }
  el.innerHTML = currentGroup.messages.map(function(m) {
    return '<div class="group-msg"><strong>' + m.from + ':</strong> ' + m.text + ' <span style="color:var(--text-muted);font-size:0.68rem;">' + m.time + '</span></div>';
  }).join('');
}
