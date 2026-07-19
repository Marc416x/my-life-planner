"use client";

import { useState } from "react";
import { GraduationCap, CalendarDays, Dumbbell, PenLine, ClipboardList, BookOpen } from "lucide-react";

const cardTitle: React.CSSProperties = { display: "flex", alignItems: "center", gap: "0.45rem" };
const row: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, marginBottom: 2 };

const courses = [
  { name: "Pharmacology", code: "NUR301", credits: 4, prof: "Dr. Martinez", sem: "Spring 2026", diff: "Hard", diffColor: "var(--terracotta)", grade: "82%", assignments: 3, top: "var(--terracotta)", nameColor: "var(--terracotta)" },
  { name: "Fundamentals of Nursing", code: "NUR201", credits: 3, prof: "Prof. Johnson", sem: "Spring 2026", diff: "Medium", diffColor: "var(--ochre)", grade: "91%", assignments: 2, top: "var(--olive)", nameColor: "var(--olive-dark)" },
  { name: "Clinical Lab Sciences", code: "NUR310", credits: 3, prof: "Dr. Williams", sem: "Spring 2026", diff: "Medium", diffColor: "var(--ochre)", grade: "88%", assignments: 1, top: "var(--forest)", nameColor: "var(--forest)" },
  { name: "Anatomy & Physiology", code: "NUR101", credits: 4, prof: "Prof. Davis", sem: "Spring 2026", diff: "Easy", diffColor: "var(--olive)", grade: "95%", assignments: 1, top: "var(--ochre)", nameColor: "#7A5A10" },
];

type Book = { title: string; author: string; course: string; status: string };

export default function CoursesPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [course, setCourse] = useState("Pharmacology");
  const [status, setStatus] = useState("required");

  const addBook = () => {
    if (!title.trim()) return;
    setBooks([...books, { title: title.trim(), author: author.trim(), course, status }]);
    setTitle("");
    setAuthor("");
  };

  return (
    <div className="page active">
      <div className="page-header">
        <h1>Courses</h1>
        <p>Manage your nursing subjects</p>
      </div>

      <div className="form-section">
        <h3>Add New Course</h3>
        <div className="input-row three">
          <div className="field-group"><div className="field-label">Course Name</div><input className="field-input" placeholder="e.g., Pharmacology" /></div>
          <div className="field-group"><div className="field-label">Course Code</div><input className="field-input" placeholder="e.g., NUR301" /></div>
          <div className="field-group"><div className="field-label">Credits</div><input className="field-input" type="number" placeholder="3" /></div>
        </div>
        <div className="input-row three">
          <div className="field-group"><div className="field-label">Professor Name</div><input className="field-input" placeholder="Dr. Smith" /></div>
          <div className="field-group"><div className="field-label">Semester</div><select className="field-select"><option>Spring 2026</option><option>Fall 2026</option></select></div>
          <div className="field-group"><div className="field-label">Difficulty</div><select className="field-select"><option>Easy</option><option>Medium</option><option>Hard</option></select></div>
        </div>
        <div className="input-row three">
          <div className="field-group"><div className="field-label">Exam Dates</div><input className="field-input" type="date" /></div>
          <div className="field-group"><div className="field-label">Class Start Time</div><input className="field-input" type="time" defaultValue="09:00" /></div>
          <div className="field-group"><div className="field-label">Class End Time</div><input className="field-input" type="time" defaultValue="10:30" /></div>
        </div>
        <div className="input-row">
          <div className="field-group"><div className="field-label">Clinical Days</div><select className="field-select"><option>Monday/Wednesday</option><option>Tuesday/Thursday</option><option>Friday</option><option>Not Applicable</option></select></div>
          <div className="field-group"><div className="field-label">Room / Location</div><input className="field-input" placeholder="e.g., Room 201 or Online" /></div>
        </div>
        <button className="btn-add">+ Add Course</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {courses.map((c) => (
          <div
            key={c.code}
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "1.25rem", borderTop: `3px solid ${c.top}` }}
          >
            <div style={{ fontWeight: 600, fontSize: "0.95rem", color: c.nameColor, fontFamily: "var(--font-caveat), cursive", marginBottom: 4 }}>{c.name}</div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{c.code} · {c.credits} credits</div>
            <div className="wave-decoration" />
            <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
              <div style={row}><GraduationCap size={14} /> Professor: <strong>{c.prof}</strong></div>
              <div style={row}><CalendarDays size={14} /> Semester: <strong>{c.sem}</strong></div>
              <div style={row}><Dumbbell size={14} /> Difficulty: <strong style={{ color: c.diffColor }}>{c.diff}</strong></div>
              <div style={row}><PenLine size={14} /> Current Grade: <strong style={{ color: "var(--olive)" }}>{c.grade}</strong></div>
              <div style={row}><ClipboardList size={14} /> Assignments: <strong>{c.assignments}</strong></div>
            </div>
          </div>
        ))}
      </div>

      {/* ACADEMIC BOOKS */}
      <div className="form-section" style={{ marginTop: "1.5rem" }}>
        <h3 style={cardTitle}><BookOpen size={18} /> Academic Book Library</h3>
        <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: "1rem", fontStyle: "italic" }}>
          Add required and recommended books for your nursing courses
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3" style={{ alignItems: "end", marginBottom: "0.75rem" }}>
          <div className="field-group"><div className="field-label">Book Title</div><input className="field-input" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addBook(); }} placeholder="e.g., Nursing Pharmacology" style={{ fontSize: "0.82rem", padding: "0.45rem" }} /></div>
          <div className="field-group"><div className="field-label">Author</div><input className="field-input" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Author name" style={{ fontSize: "0.82rem", padding: "0.45rem" }} /></div>
          <div className="field-group"><div className="field-label">Course</div>
            <select className="field-select" value={course} onChange={(e) => setCourse(e.target.value)} style={{ fontSize: "0.82rem", padding: "0.45rem" }}>
              <option>Pharmacology</option><option>Fundamentals</option><option>Clinical Lab</option><option>Anatomy</option><option>General</option>
            </select>
          </div>
          <div className="field-group"><div className="field-label">Status</div>
            <select className="field-select" value={status} onChange={(e) => setStatus(e.target.value)} style={{ fontSize: "0.82rem", padding: "0.45rem" }}>
              <option value="required">Required</option>
              <option value="recommended">Recommended</option>
              <option value="reading">Currently Reading</option>
              <option value="done">Completed</option>
            </select>
          </div>
        </div>
        <button className="btn-add" onClick={addBook} style={{ padding: "0.5rem 0.75rem", fontSize: "0.82rem" }}>+ Add Book</button>

        {books.length ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: "0.75rem", marginTop: "1rem" }}>
            {books.map((b, i) => (
              <div key={i} className="card" style={{ padding: "0.85rem" }}>
                <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{b.title}</div>
                {b.author && <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{b.author}</div>}
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 4 }}>{b.course} · {b.status}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", textAlign: "center", padding: "1.5rem", fontStyle: "italic" }}>
            No books added yet. Add your required textbooks above.
          </div>
        )}
      </div>
    </div>
  );
}
