/* ============================================================
   MyLifePlanner — assistant.js
   AI assistant — chat bubbles, reply generation, sending messages.
   ============================================================ */

// ---------- 7.6 AI STUDY ASSISTANT (demo: local pattern-matched replies) ----------
function appendChatBubble(text, who) {
  var log = document.getElementById('ai-chat-log');
  if (!log) return;
  var bubble = document.createElement('div');
  bubble.className = 'chat-bubble ' + (who === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai');
  bubble.textContent = text;
  log.appendChild(bubble);
  log.scrollTop = log.scrollHeight;
}
function generateAssistantReply(msg) {
  var m = msg.toLowerCase();
  if (m.indexOf('weak') !== -1) {
    var openErrors = (typeof errorLogEntries !== 'undefined' ? errorLogEntries.length : 1);
    return "Based on your Error Log, your most recurring gap is Pharmacokinetics calculations. I'd suggest 20 minutes of active recall on drug half-life problems today, then revisit your Pharmacology quiz scores — they're your lowest average right now.";
  }
  if (m.indexOf('quiz') !== -1 && m.indexOf('drug') !== -1) {
    if (!drugLog.length) return "You haven't logged any drugs yet — log today's 2 drugs in the Drug Tracker first, then come back and I'll quiz you on them tomorrow!";
    var last = drugLog[drugLog.length - 1];
    return "Here we go: what's the mechanism of action and one key nursing consideration for " + last.drugs[0].name + "? (Check the Drug Tracker to see how you did.)";
  }
  if (m.indexOf('summar') !== -1) {
    return "This week you logged " + dailyTasks.length + " daily tasks and " + weeklyGoals.length + " weekly goals. Your study streak is holding steady — keep meeting your daily goal to reach the next Discipline Level.";
  }
  if (m.indexOf('nclex') !== -1) {
    return "Practice question: A client on furosemide reports muscle cramps and fatigue. Which electrolyte imbalance should the nurse suspect first, and what assessment finding would confirm it?";
  }
  return "Got it — I'm a demo assistant for now, so my answers are pattern-based rather than a live model. In production I'll read your real courses, error log, and drug log to answer this precisely (see spec §7.6). Try one of the quick prompts above!";
}
function askAssistant(prompt) {
  document.getElementById('ai-chat-input').value = prompt;
  sendAssistantMessage();
}
function sendAssistantMessage() {
  var input = document.getElementById('ai-chat-input');
  var msg = input.value.trim();
  if (!msg) return;
  appendChatBubble(msg, 'user');
  input.value = '';
  setTimeout(function() {
    appendChatBubble(generateAssistantReply(msg), 'ai');
  }, 450);
}
(function seedAssistantGreeting() {
  document.addEventListener('DOMContentLoaded', function() {
    var log = document.getElementById('ai-chat-log');
    if (log && !log.children.length) {
      appendChatBubble("Hi! I'm your AI Study Assistant. Ask me about your weak spots, get an NCLEX practice question, or ask me to quiz you on yesterday's drugs.", 'ai');
    }
  });
})();
