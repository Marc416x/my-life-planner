/* ============================================================
   MyLifePlanner — state.js
   State & constants — every shared global lives here. Loads first so all other modules can read them.
   ============================================================ */

let userData = { name: 'Student', gender: 'female', palette: 0, year: 'Year 1', streak: 0, level: 1 };
let currentStep = 0;
let timerInterval = null;
let timerSeconds = 0;
let timerRunning = false;
let selectedMethod = 45;
let sleepVal = 7.5;
let waterVal = 6;
let currentMonth = new Date(); currentMonth.setDate(1);

// ===== FULL PALETTE DEFINITIONS =====
const PALETTES = [
  { name:'Earthy Boho',     p1:'#C4704A',p1l:'#F2E0D5',p1d:'#8B4A2F', p2:'#6B7C4A',p2l:'#E8EDD8',p2d:'#3D4A25', p3:'#C49A3A',p3l:'#F5EDD0', p4:'#2D5A3D',p4l:'#D5E8DC', p5:'#A0624A', bg:'#FAF6EF',bgc:'#FFFCF7',bgs:'#F0E8DC', tp:'#2D1F14',ts:'#5A3E2B',tm:'#8B6B4A', border:'rgba(180,120,80,0.15)',borderS:'rgba(180,120,80,0.3)'},
  { name:'Soft Bloom',      p1:'#C87898',p1l:'#F8E8EE',p1d:'#9A4060', p2:'#7878B8',p2l:'#E8E8F8',p2d:'#404080', p3:'#88A888',p3l:'#E0F0E0', p4:'#5898B8',p4l:'#D8EEF8', p5:'#98A0B0', bg:'#FDF8FC',bgc:'#FFFAFF',bgs:'#F0E8F4', tp:'#2A1A2E',ts:'#5A3A5A',tm:'#907090', border:'rgba(160,100,160,0.15)',borderS:'rgba(160,100,160,0.3)'},
  { name:'High Contrast',   p1:'#C49A3A',p1l:'#F5EDD0',p1d:'#8A6A10', p2:'#4A4A6A',p2l:'#E0E0F0',p2d:'#2A2A4A', p3:'#B0B8C0',p3l:'#F0F4F8', p4:'#2D2D2D',p4l:'#F0F0F0', p5:'#808080', bg:'#FAFAFA',bgc:'#FFFFFF',bgs:'#F0F0F0', tp:'#1A1A1A',ts:'#3A3A3A',tm:'#707070', border:'rgba(0,0,0,0.12)',borderS:'rgba(0,0,0,0.25)'},
  { name:'Desert Dusk',     p1:'#C4704A',p1l:'#F2E0D5',p1d:'#8B4A2F', p2:'#3A4890',p2l:'#D8DCF8',p2d:'#202870', p3:'#6888A8',p3l:'#D8E4F0', p4:'#8B5A3A',p4l:'#F0E0D0', p5:'#B09878', bg:'#FAF6EF',bgc:'#FFFCF7',bgs:'#F0ECE4', tp:'#2D1F14',ts:'#5A3E2B',tm:'#8B6B4A', border:'rgba(180,120,80,0.15)',borderS:'rgba(180,120,80,0.3)'},
  { name:'Autumn Fire',     p1:'#C85820',p1l:'#FAE0D0',p1d:'#8A3010', p2:'#8B2020',p2l:'#F8D8D8',p2d:'#5A1010', p3:'#B07040',p3l:'#F8ECD8', p4:'#B08020',p4l:'#F8F0D0', p5:'#D09060', bg:'#FFF8F4',bgc:'#FFFCFA',bgs:'#F8EDE4', tp:'#2A1008',ts:'#5A2808',tm:'#9A5028', border:'rgba(200,88,32,0.15)',borderS:'rgba(200,88,32,0.3)'},
  { name:'Sage Mist',       p1:'#6A8A68',p1l:'#E0EEE0',p1d:'#3A5A38', p2:'#787878',p2l:'#ECECEC',p2d:'#484848', p3:'#A89880',p3l:'#F0EAE0', p4:'#5A7A58',p4l:'#D8ECD8', p5:'#989890', bg:'#F8FAF8',bgc:'#FBFDFB',bgs:'#EDF2ED', tp:'#202820',ts:'#404840',tm:'#708070', border:'rgba(100,140,100,0.15)',borderS:'rgba(100,140,100,0.3)'},
  { name:'Mystic Garden',   p1:'#6A4A9A',p1l:'#EAD8FA',p1d:'#3A2070', p2:'#8A68A8',p2l:'#EEE8F8',p2d:'#5A3880', p3:'#C8A0C0',p3l:'#F8E8F8', p4:'#6A9A6A',p4l:'#D8F0D8', p5:'#A890C0', bg:'#FAF8FF',bgc:'#FDFAFF',bgs:'#F0E8FA', tp:'#1E1030',ts:'#4A2870',tm:'#8860A0', border:'rgba(120,80,180,0.15)',borderS:'rgba(120,80,180,0.3)'},
  { name:'Ocean Scholar',   p1:'#2E6B8A',p1l:'#D0E8F4',p1d:'#0A3A5A', p2:'#4A9B9B',p2l:'#D0F0F0',p2d:'#206868', p3:'#C49A3A',p3l:'#F5EDD0', p4:'#1A3A5C',p4l:'#C8D8F0', p5:'#5A8098', bg:'#F4F8FC',bgc:'#F8FBFF',bgs:'#E8F0F8', tp:'#0A1E30',ts:'#1A3A50',tm:'#4A6A80', border:'rgba(46,107,138,0.15)',borderS:'rgba(46,107,138,0.3)'},
  { name:'Rose & Earth',    p1:'#A03038',p1l:'#F8D8DC',p1d:'#6A1820', p2:'#C4704A',p2l:'#F2E0D5',p2d:'#8B4A2F', p3:'#D4956A',p3l:'#FAE8D8', p4:'#4A7A4A',p4l:'#D8F0D8', p5:'#B06858', bg:'#FFF8F6',bgc:'#FFFCFB',bgs:'#F8ECE8', tp:'#28100A',ts:'#582010',tm:'#985040', border:'rgba(160,48,56,0.15)',borderS:'rgba(160,48,56,0.3)'},
  { name:'Forest Healer',   p1:'#3A6A4A',p1l:'#D0E8D8',p1d:'#1A3A28', p2:'#5A9A6A',p2l:'#D8F0E0',p2d:'#2A6038', p3:'#C49A3A',p3l:'#F5EDD0', p4:'#2D4A3A',p4l:'#C8DCD0', p5:'#7AAA7A', bg:'#F4FAF6',bgc:'#F8FDF9',bgs:'#E4F0E8', tp:'#0A1E10',ts:'#1A3820',tm:'#4A7050', border:'rgba(58,106,74,0.15)',borderS:'rgba(58,106,74,0.3)'},
  { name:'Warm Copper',     p1:'#C4704A',p1l:'#F2E0D5',p1d:'#8B4A2F', p2:'#E8A878',p2l:'#FDF0E8',p2d:'#B87848', p3:'#F0D0A0',p3l:'#FDF8E8', p4:'#D4784A',p4l:'#F8E0D0', p5:'#A86040', bg:'#FFF8F2',bgc:'#FFFCF8',bgs:'#F8EDE0', tp:'#2A1208',ts:'#602808',tm:'#A05028', border:'rgba(196,112,74,0.18)',borderS:'rgba(196,112,74,0.35)'},
  { name:'Midnight Study',  p1:'#6A68B0',p1l:'#E0E0F8',p1d:'#3A3880', p2:'#8880C8',p2l:'#E8E4FF',p2d:'#5048A0', p3:'#B0A8E0',p3l:'#F0EEFF', p4:'#3A3A5C',p4l:'#D0D0F0', p5:'#9898C8', bg:'#F8F8FF',bgc:'#FAFAFF',bgs:'#EEEEFF', tp:'#181828',ts:'#383860',tm:'#7878A0', border:'rgba(100,96,176,0.15)',borderS:'rgba(100,96,176,0.3)'},
  { name:'Steel & Blood',   p1:'#C0202A',p1l:'#F5D0D2',p1d:'#8A0810', p2:'#2A2E38',p2l:'#D4D6DC',p2d:'#12141A', p3:'#4E6070',p3l:'#D8E2E8',p3d:'#28404E', p4:'#8A9AAA',p4l:'#EAF0F5', p5:'#D04858', bg:'#F4F5F7',bgc:'#FAFBFC',bgs:'#E2E5EA', tp:'#12141A',ts:'#2A2E38',tm:'#60707E', border:'rgba(42,46,56,0.15)',borderS:'rgba(42,46,56,0.35)'},
  { name:'Carbon & Cobalt', p1:'#1A50C8',p1l:'#D0DCF8',p1d:'#0A2880', p2:'#1E1E28',p2l:'#D0D0D8',p2d:'#0A0A14', p3:'#2E8060',p3l:'#C8EAE0',p3d:'#165038', p4:'#505870',p4l:'#D8DAE4', p5:'#3068D8', bg:'#F2F4F8',bgc:'#F8F9FC',bgs:'#E0E4EE', tp:'#0E0E18',ts:'#262636',tm:'#52566A', border:'rgba(26,80,200,0.15)',borderS:'rgba(26,80,200,0.3)'},
  { name:'Gunmetal & Amber',p1:'#D48010',p1l:'#FAF0D0',p1d:'#8A5000', p2:'#303030',p2l:'#D8D8D8',p2d:'#181818', p3:'#585858',p3l:'#E8E8E8', p4:'#A86800',p4l:'#F8EAC8', p5:'#E89828', bg:'#F6F4F0',bgc:'#FDFCFA',bgs:'#ECEAE4', tp:'#181818',ts:'#303030',tm:'#686868', border:'rgba(48,48,48,0.14)',borderS:'rgba(48,48,48,0.3)'},
  { name:'Navy Ops',        p1:'#0E5C9A',p1l:'#C8DFF5',p1d:'#053060', p2:'#102040',p2l:'#C8D0DC',p2d:'#060E1E', p3:'#C88010',p3l:'#FAF0D0',p3d:'#8A5400', p4:'#1E4060',p4l:'#C8D8E8', p5:'#1878C0', bg:'#F0F4F8',bgc:'#F8FAFC',bgs:'#DDE6EF', tp:'#060E1E',ts:'#102040',tm:'#3A5268', border:'rgba(14,92,154,0.15)',borderS:'rgba(14,92,154,0.32)'},
  { name:'Obsidian & Jade', p1:'#0E8A68',p1l:'#C0EAE0',p1d:'#065038', p2:'#181C20',p2l:'#D0D2D4',p2d:'#080A0C', p3:'#2A5C48',p3l:'#C8DCD8', p4:'#3C8070',p4l:'#C8E0DC', p5:'#10A878', bg:'#F2F6F4',bgc:'#F8FCFA',bgs:'#DDE8E4', tp:'#0A0E0C',ts:'#1A2820',tm:'#4A6058', border:'rgba(14,138,104,0.14)',borderS:'rgba(14,138,104,0.3)'},
];

// ========== STATE ==========
let calendarTasks = {};
let dailyTasks = [];
let weeklyGoals = [];
let monthlyBooks = [];
let acadBooks = [];
let careerGoalCounter = 10;
let scheduleBlocks = [
  {day:'Monday', start:'9:00 AM', end:'10:30 AM', subject:'NUR301 Pharmacology', type:'sch-lecture'},
  {day:'Tuesday', start:'11:00 AM', end:'12:30 PM', subject:'NUR310 Clinical Lab', type:'sch-clinical'},
  {day:'Wednesday', start:'9:00 AM', end:'10:30 AM', subject:'NUR301 Pharmacology', type:'sch-lecture'},
  {day:'Wednesday', start:'11:00 AM', end:'12:00 PM', subject:'NUR310 Lab', type:'sch-lab'},
  {day:'Thursday', start:'2:00 PM', end:'3:00 PM', subject:'Study Session — Library', type:'sch-study'},
  {day:'Friday', start:'10:00 AM', end:'11:30 AM', subject:'NUR201 Fundamentals', type:'sch-lecture'}
];
let currentDay = new Date();
let currentWeekOffset = 0;
let clinicalVal = 24;
let goalsDone = 0;
let customVal = 0;
let profileData = {dailyGoal:3, weeklyGoal:21, sleepGoal:8, waterGoal:8};

// ========== DAY MODAL ==========
let currentDayModal = null;
const statusColors = {
  required: {bg:'var(--terracotta-light)', color:'var(--terracotta-dark)', icon:'📌'},
  recommended: {bg:'var(--ochre-light)', color:'#7A5A10', icon:'⭐'},
  reading: {bg:'rgba(107,124,74,0.15)', color:'var(--olive-dark)', icon:'📑'},
  done: {bg:'var(--forest-light)', color:'var(--forest)', icon:'✅'}
};

let customTrackerVal = 0;
// ========== PREMIUM GATE ==========
var isPremium = false;
var subscriptionPlan = null; // 'monthly' | 'yearly'
// ========== NCLEX SESSION LOGGING ==========
var nclexSessions = [];
var nclexCatNames = { safe:'Safe Care & Environment', health:'Health Promotion', psycho:'Psychosocial Integrity', physio:'Physiological Integrity' };

// ========== DRUG TRACKER ==========
var drugLog = [];
var drugStreakCount = 0;

// ========== COLOUR MODE (light / white / dark) ==========
var MODES = ['mode-light', 'mode-white', 'mode-dark'];
var MODE_ICONS = {'mode-light':'☀️', 'mode-white':'⬜', 'mode-dark':'🌙'};
var MODE_LABELS = {'mode-light':'Light', 'mode-white':'White', 'mode-dark':'Dark'};
var currentMode = 'mode-light';

// ---------- 7.10 STUDY GROUPS (demo: localStorage-backed, single-device) ----------
var currentGroup = null;
// Course Grade / GPA is NEVER shown to peer groups. practiceGrade is opt-in (shareGrade).
var mockGroupMembers = [
  { name: 'You', practiceGrade: null, shareGrade: true, streak: 0, isUser: true },
  { name: 'Amara K.', practiceGrade: 74, shareGrade: true, streak: 12 },
  { name: 'Priya S.', practiceGrade: 88, shareGrade: true, streak: 21 },
  { name: 'Jordan M.', practiceGrade: null, shareGrade: false, streak: 5 }
];
// Cross-group leaderboard — peer groups only, visible app-wide with member names (per design).
// Institutional cohorts never appear here; they're private to their school's admin dashboard.
var otherPeerGroups = [
  { name: 'NUR201 Night Owls', members: ['Chidi O.', 'Fatima R.', 'Lena T.'], streak: 34, avgPracticeGrade: 81, streakMode: 'threshold' },
  { name: 'Pharm Warriors', members: ['Sam K.', 'Divya N.'], streak: 18, avgPracticeGrade: 69, streakMode: 'strict' },
  { name: 'Clinical Crew', members: ['Marcus B.', 'Aiko S.', 'Noor H.', 'Théo L.'], streak: 9, avgPracticeGrade: 76, streakMode: 'threshold' }
];
// ---------- 7.5 NOTIFICATIONS (push / email / in-app per type) ----------
var notifTypes = [
  { key: 'drug_reminder', label: '💊 Daily drug reminder' },
  { key: 'streak_warning', label: '🔥 Streak-at-risk warning' },
  { key: 'assignment_due', label: '📋 Assignment due soon' },
  { key: 'weekly_reflection', label: '📝 Weekly reflection prompt' }
];
var notifPrefs = {}; // { drug_reminder: {push:true, email:false, in_app:true}, ... }
// ---------- 7.7 LANGUAGE (EN/FR — mechanism demo, key strings translated) ----------
var i18nDict = {
  en: {
    'settings-title': 'Settings', 'settings-sub': 'Personalise your experience',
    'nav-overview': 'Overview', 'nav-academic': 'Academic', 'nav-study': 'Study',
    'nav-wellbeing': 'Wellbeing', 'nav-premium': 'Premium ✨', 'nav-community': 'Community', 'nav-account': 'Account',
    'dash-tagline': 'Nursing Academic OS'
  },
  fr: {
    'settings-title': 'Paramètres', 'settings-sub': 'Personnalisez votre expérience',
    'nav-overview': 'Aperçu', 'nav-academic': 'Académique', 'nav-study': 'Étude',
    'nav-wellbeing': 'Bien-être', 'nav-premium': 'Premium ✨', 'nav-community': 'Communauté', 'nav-account': 'Compte',
    'dash-tagline': 'Système Académique Infirmier'
  }
};
var currentLang = 'en';
// ---------- 7.3 GPA CALCULATION (credit-weighted, weight%-weighted, unweighted) ----------
var sampleCourses = [
  { name: 'Pharmacology', credits: 4, gradePct: 82, weightPct: 30 },
  { name: 'Fundamentals of Nursing', credits: 3, gradePct: 91, weightPct: 35 },
  { name: 'Clinical Lab Sciences', credits: 3, gradePct: 88, weightPct: 25 },
  { name: 'Anatomy & Physiology', credits: 4, gradePct: 95, weightPct: 10 }
];
