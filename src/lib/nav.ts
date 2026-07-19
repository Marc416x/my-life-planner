import {
  Home,
  Calendar,
  Library,
  CalendarDays,
  ClipboardList,
  FileText,
  HelpCircle,
  GraduationCap,
  Stethoscope,
  Timer,
  Flame,
  CircleX,
  Pin,
  BarChart3,
  Star,
  ClipboardCheck,
  Pill,
  Bot,
  Users,
  BookOpen,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  pro?: boolean;
};

export type NavSection = {
  label: string;
  items: NavItem[];
};

// Mirrors the original prototype's grouped sidebar. Every destination has a
// route (placeholders for now) so nothing 404s. Emojis → Lucide icons.
export const navSections: NavSection[] = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", href: "/", icon: Home },
      { label: "Calendar", href: "/calendar", icon: Calendar },
    ],
  },
  {
    label: "Academic",
    items: [
      { label: "Courses", href: "/courses", icon: Library },
      { label: "Class Schedule", href: "/schedule", icon: CalendarDays },
      { label: "Assignments", href: "/assignments", icon: ClipboardList },
      { label: "Exams", href: "/exams", icon: FileText },
      { label: "Quizzes", href: "/quizzes", icon: HelpCircle },
      { label: "Grades", href: "/grades", icon: GraduationCap },
      { label: "Clinicals", href: "/clinicals", icon: Stethoscope },
    ],
  },
  {
    label: "Study",
    items: [
      { label: "Study Sessions", href: "/study", icon: Timer },
      { label: "Study Streaks", href: "/streaks", icon: Flame },
      { label: "Error Log", href: "/errorlog", icon: CircleX },
    ],
  },
  {
    label: "Wellbeing",
    items: [
      { label: "Trackers", href: "/trackers", icon: Pin },
      { label: "Progress Metrics", href: "/progress", icon: BarChart3 },
      { label: "Long Term Vision", href: "/vision", icon: Star },
    ],
  },
  {
    label: "Premium",
    items: [
      { label: "NCLEX Tracker", href: "/nclex", icon: ClipboardCheck, pro: true },
      { label: "Drug Tracker", href: "/drugs", icon: Pill, pro: true },
      { label: "AI Study Assistant", href: "/ai-assistant", icon: Bot, pro: true },
    ],
  },
  {
    label: "Community",
    items: [
      { label: "Study Groups", href: "/groups", icon: Users, pro: true },
      { label: "Resource Hub", href: "/resources", icon: BookOpen },
    ],
  },
  {
    label: "Account",
    items: [{ label: "Settings", href: "/settings", icon: Settings }],
  },
];
