import { useEffect, useMemo, useState } from 'react';
import {
  Users, BookOpen, TrendingUp, Plus, Search, Download, Pencil, Trash2,
  GraduationCap, LogOut, CheckCircle2, UserPlus, ClipboardList, Award,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Student, Course, Grade } from '@/types';
import { GRADE_POINTS, gpaFromGrades, ALL_GRADES, GradeLetter } from '@/types';
import { Modal } from './Modal';
import type { User } from '@/types';

interface Props {
  user: User;
  onLogout: () => void;
  isDark: boolean;
  onToggleDark: () => void;
}

type Tab = 'overview' | 'directory' | 'forms';

export function AdminDashboard({ user, onLogout, isDark, onToggleDark }: Props) {
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('overview');

  // directory filters
  const [query, setQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');

  // modals
  const [addStudentOpen, setAddStudentOpen] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [gradeOpen, setGradeOpen] = useState(false);
  const [editStudent, setEditStudent] = useState<Student | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    const [s, c, g] = await Promise.all([
      supabase.from('students').select('*').order('student_id'),
      supabase.from('courses').select('*').order('course_id'),
      supabase.from('grades').select('*'),
    ]);
    setStudents(s.data ?? []);
    setCourses(c.data ?? []);
    setGrades(g.data ?? []);
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }

  const departments = useMemo(() => {
    const set = new Set(students.map((s) => s.department));
    return ['all', ...Array.from(set).sort()];
  }, [students]);

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const matchesDept = deptFilter === 'all' || s.department === deptFilter;
      const q = query.trim().toLowerCase();
      const matchesQuery = !q || s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q) || s.student_id.toLowerCase().includes(q);
      return matchesDept && matchesQuery;
    });
  }, [students, deptFilter, query]);

  // Aggregate per-student GPA for metrics
  const avgGpa = useMemo(() => {
    const byStudent = new Map<string, { grade: string; course?: Course }[]>();
    for (const g of grades) {
      const course = courses.find((c) => c.course_id === g.course_id);
      const arr = byStudent.get(g.student_id) ?? [];
      arr.push({ grade: g.grade, course });
      byStudent.set(g.student_id, arr);
    }
    const gpas: number[] = [];
    byStudent.forEach((arr) => gpas.push(gpaFromGrades(arr)));
    if (gpas.length === 0) return 0;
    return Math.round((gpas.reduce((a, b) => a + b, 0) / gpas.length) * 100) / 100;
  }, [grades, courses]);

  function exportCsv() {
    const header = ['StudentID', 'Name', 'Email', 'Department', 'EnrollmentDate'];
    const rows = filteredStudents.map((s) => [s.student_id, s.name, s.email, s.department, s.enrollment_date]);
    const csv = [header, ...rows].map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `students_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('CSV report downloaded.');
  }

  async function deleteStudent(student: Student) {
    if (!confirm(`Delete ${student.name}? This also removes their grades and login account.`)) return;
    await supabase.from('grades').delete().eq('student_id', student.student_id);
    await supabase.from('users').delete().eq('student_id', student.student_id);
    const { error } = await supabase.from('students').delete().eq('student_id', student.student_id);
    if (error) { showToast('Could not delete student.'); return; }
    showToast(`${student.name} deleted.`);
    loadAll();
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Header user={user} onLogout={onLogout} isDark={isDark} onToggleDark={onToggleDark} />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
          {([
            ['overview', 'Overview', TrendingUp],
            ['directory', 'Student Directory', Users],
            ['forms', 'Manage Records', ClipboardList],
          ] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                tab === key
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center text-slate-400">Loading records…</div>
        ) : (
          <>
            {tab === 'overview' && (
              <Overview students={students} courses={courses} avgGpa={avgGpa} grades={grades} />
            )}
            {tab === 'directory' && (
              <Directory
                students={filteredStudents}
                query={query} setQuery={setQuery}
                departments={departments} deptFilter={deptFilter} setDeptFilter={setDeptFilter}
                onExport={exportCsv}
                onEdit={(s) => { setEditStudent(s); setAddStudentOpen(true); }}
                onDelete={deleteStudent}
                onAdd={() => { setEditStudent(null); setAddStudentOpen(true); }}
                grades={grades}
              />
            )}
            {tab === 'forms' && (
              <FormsHub
                students={students} courses={courses}
                onOpenAdd={() => { setEditStudent(null); setAddStudentOpen(true); }}
                onOpenEnroll={() => setEnrollOpen(true)}
                onOpenGrade={() => setGradeOpen(true)}
              />
            )}
          </>
        )}
      </main>

      <AddStudentModal
        open={addStudentOpen}
        onClose={() => setAddStudentOpen(false)}
        editing={editStudent}
        onSaved={() => { setAddStudentOpen(false); loadAll(); showToast(editStudent ? 'Student updated.' : 'Student added.'); }}
      />
      <EnrollModal
        open={enrollOpen}
        onClose={() => setEnrollOpen(false)}
        students={students} courses={courses} grades={grades}
        onSaved={() => { setEnrollOpen(false); loadAll(); showToast('Student enrolled.'); }}
      />
      <GradeModal
        open={gradeOpen}
        onClose={() => setGradeOpen(false)}
        students={students} courses={courses} grades={grades}
        onSaved={() => { setGradeOpen(false); loadAll(); showToast('Grade saved.'); }}
      />

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-xl dark:bg-slate-700 animate-slide-up">
          <CheckCircle2 className="h-4 w-4 text-green-400" />
          {toast}
        </div>
      )}
    </div>
  );
}

/* ---------- Header ---------- */
function Header({ user, onLogout, isDark, onToggleDark }: { user: User; onLogout: () => void; isDark: boolean; onToggleDark: () => void; }) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">UniPortal · Admin</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{user.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleDark}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            {isDark ? 'Light' : 'Dark'} mode
          </button>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-red-50 hover:text-red-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-red-950/40 dark:hover:text-red-400"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}

/* ---------- Overview ---------- */
function Overview({ students, courses, avgGpa, grades }: { students: Student[]; courses: Course[]; avgGpa: number; grades: Grade[]; }) {
  const cards = [
    { label: 'Total Students', value: students.length, icon: Users, color: 'blue' },
    { label: 'Total Courses', value: courses.length, icon: BookOpen, color: 'emerald' },
    { label: 'Average GPA', value: avgGpa.toFixed(2), icon: TrendingUp, color: 'amber' },
    { label: 'Grades Recorded', value: grades.length, icon: Award, color: 'violet' },
  ];
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400',
    violet: 'bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-400',
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className={`mb-3 flex h-11 w-11 items-center justify-center rounded-xl ${colorMap[c.color]}`}>
              <c.icon className="h-6 w-6" />
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">{c.value}</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">Students by Department</h3>
          <DeptBar students={students} />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">Recent Students</h3>
          <div className="space-y-2">
            {students.slice(-5).reverse().map((s) => (
              <div key={s.student_id} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{s.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{s.student_id} · {s.department}</p>
                </div>
                <span className="text-xs text-slate-400">{s.enrollment_date}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DeptBar({ students }: { students: Student[] }) {
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    students.forEach((s) => m.set(s.department, (m.get(s.department) ?? 0) + 1));
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [students]);
  const max = Math.max(1, ...counts.map((c) => c[1]));
  const palette = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-violet-500', 'bg-rose-500', 'bg-cyan-500'];
  return (
    <div className="space-y-3">
      {counts.map(([dept, n], i) => (
        <div key={dept}>
          <div className="mb-1 flex justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-medium text-slate-700 dark:text-slate-300">{dept}</span>
            <span>{n}</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800">
            <div className={`h-2.5 rounded-full ${palette[i % palette.length]} transition-all`} style={{ width: `${(n / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Directory ---------- */
function Directory({
  students, query, setQuery, departments, deptFilter, setDeptFilter,
  onExport, onEdit, onDelete, onAdd, grades,
}: {
  students: Student[]; query: string; setQuery: (v: string) => void;
  departments: string[]; deptFilter: string; setDeptFilter: (v: string) => void;
  onExport: () => void; onEdit: (s: Student) => void; onDelete: (s: Student) => void;
  onAdd: () => void; grades: Grade[];
}) {
  const deptClass = (dept: string) => {
    const map: Record<string, string> = {
      'Computer Science': 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300',
      'Mathematics': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
      'Electrical Engineering': 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
    };
    return map[dept] ?? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
  };

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, email, or ID…"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          >
            {departments.map((d) => (
              <option key={d} value={d}>{d === 'all' ? 'All Departments' : d}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={onAdd} className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700">
            <Plus className="h-4 w-4" /> Add Student
          </button>
          <button onClick={onExport} className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-semibold">ID</th>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Department</th>
                <th className="px-4 py-3 font-semibold">Enrolled</th>
                <th className="px-4 py-3 font-semibold">Grades</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {students.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">No students match your filters.</td></tr>
              ) : students.map((s) => {
                const count = grades.filter((g) => g.student_id === s.student_id).length;
                return (
                  <tr key={s.student_id} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">{s.student_id}</td>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{s.name}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{s.email}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${deptClass(s.department)}`}>{s.department}</span></td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{s.enrollment_date}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{count}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => onEdit(s)} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/40" aria-label="Edit">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => onDelete(s)} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40" aria-label="Delete">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ---------- Forms hub ---------- */
function FormsHub({ students, courses, onOpenAdd, onOpenEnroll, onOpenGrade }: {
  students: Student[]; courses: Course[];
  onOpenAdd: () => void; onOpenEnroll: () => void; onOpenGrade: () => void;
}) {
  const cards = [
    { title: 'Add New Student', desc: 'Create a student record with name, email, department and enrollment date.', icon: UserPlus, action: onOpenAdd, btn: 'Add Student' },
    { title: 'Enroll Student in Course', desc: 'Register a student into a course for the current semester.', icon: BookOpen, action: onOpenEnroll, btn: 'Enroll' },
    { title: 'Assign / Edit Grades', desc: 'Record or update a letter grade for a student in a specific course.', icon: Award, action: onOpenGrade, btn: 'Manage Grades' },
  ];
  return (
    <div className="animate-fade-in grid gap-4 md:grid-cols-3">
      {cards.map((c) => (
        <div key={c.title} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
            <c.icon className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">{c.title}</h3>
          <p className="mt-2 flex-1 text-sm text-slate-500 dark:text-slate-400">{c.desc}</p>
          <button onClick={c.action} className="mt-4 w-full rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700">
            {c.btn}
          </button>
        </div>
      ))}
    </div>
  );
}

/* ---------- Add / Edit Student Modal ---------- */
function AddStudentModal({ open, onClose, editing, onSaved }: {
  open: boolean; onClose: () => void; editing: Student | null; onSaved: () => void;
}) {
  const [form, setForm] = useState({ student_id: '', name: '', email: '', department: '', enrollment_date: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setError('');
      setForm(editing
        ? { student_id: editing.student_id, name: editing.name, email: editing.email, department: editing.department, enrollment_date: editing.enrollment_date }
        : { student_id: '', name: '', email: '', department: 'Computer Science', enrollment_date: new Date().toISOString().slice(0, 10) });
    }
  }, [open, editing]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError('');
    const payload = {
      student_id: form.student_id.trim().toUpperCase(),
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      department: form.department.trim(),
      enrollment_date: form.enrollment_date,
    };
    if (editing) {
      const { error } = await supabase.from('students').update(payload).eq('student_id', editing.student_id);
      setSaving(false);
      if (error) { setError(error.message); return; }
      onSaved();
    } else {
      const { error } = await supabase.from('students').insert(payload);
      if (error) { setSaving(false); setError(error.message); return; }
      // also create a login account for the new student
      await supabase.from('users').insert({
        email: payload.email, password: 'student123', role: 'student',
        name: payload.name, student_id: payload.student_id,
      });
      setSaving(false);
      onSaved();
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Student' : 'Add New Student'}>
      <form onSubmit={save} className="space-y-4">
        <Field label="Student ID" disabled={!!editing}>
          <input value={form.student_id} disabled={!!editing} onChange={(e) => setForm({ ...form, student_id: e.target.value })} required
            className="input" placeholder="S1006" />
        </Field>
        <Field label="Full Name">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="input" placeholder="Jane Doe" />
        </Field>
        <Field label="Email">
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required className="input" placeholder="jane@university.edu" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Department">
            <input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} required className="input" placeholder="Computer Science" />
          </Field>
          <Field label="Enrollment Date">
            <input type="date" value={form.enrollment_date} onChange={(e) => setForm({ ...form, enrollment_date: e.target.value })} required className="input" />
          </Field>
        </div>
        {!editing && (
          <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
            A student login account is auto-created with password <span className="font-mono font-semibold">student123</span>.
          </p>
        )}
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200">Cancel</button>
          <button type="submit" disabled={saving} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Student'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------- Enroll Modal ---------- */
function EnrollModal({ open, onClose, students, courses, grades, onSaved }: {
  open: boolean; onClose: () => void; students: Student[]; courses: Course[]; grades: Grade[]; onSaved: () => void;
}) {
  const [studentId, setStudentId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [semester, setSemester] = useState('2026-2027');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) { setError(''); setStudentId(students[0]?.student_id ?? ''); setCourseId(courses[0]?.course_id ?? ''); setSemester('2026-2027'); } }, [open, students, courses]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError('');
    // Enrolling = inserting a grade row with a placeholder? No — enrollment is presence in grades for the semester.
    // We insert a grade row with grade 'F' as "in progress"? Better: require a grade. We'll insert with a default and let Grade modal edit.
    // To keep it clean, enrollment creates a grade row with grade 'F' meaning not-yet-graded; admin assigns real grade later.
    const existing = grades.find((g) => g.student_id === studentId && g.course_id === courseId && g.semester === semester);
    if (existing) { setSaving(false); setError('This student is already enrolled in that course for the selected semester.'); return; }
    const { error } = await supabase.from('grades').insert({ student_id: studentId, course_id: courseId, semester, grade: 'F' });
    setSaving(false);
    if (error) { setError(error.message); return; }
    onSaved();
  }

  return (
    <Modal open={open} onClose={onClose} title="Enroll Student in Course">
      <form onSubmit={save} className="space-y-4">
        <Field label="Student">
          <select value={studentId} onChange={(e) => setStudentId(e.target.value)} className="input" required>
            {students.map((s) => <option key={s.student_id} value={s.student_id}>{s.name} ({s.student_id})</option>)}
          </select>
        </Field>
        <Field label="Course">
          <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className="input" required>
            {courses.map((c) => <option key={c.course_id} value={c.course_id}>{c.course_name} — {c.credits} cr</option>)}
          </select>
        </Field>
        <Field label="Semester">
          <input value={semester} onChange={(e) => setSemester(e.target.value)} className="input" required />
        </Field>
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          The student is enrolled with a placeholder grade. Use "Manage Grades" to assign the real letter grade.
        </p>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200">Cancel</button>
          <button type="submit" disabled={saving} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
            {saving ? 'Enrolling…' : 'Enroll'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------- Grade Modal ---------- */
function GradeModal({ open, onClose, students, courses, grades, onSaved }: {
  open: boolean; onClose: () => void; students: Student[]; courses: Course[]; grades: Grade[]; onSaved: () => void;
}) {
  const [studentId, setStudentId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [semester, setSemester] = useState('2026-2027');
  const [gradeVal, setGradeVal] = useState<GradeLetter>('A');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setError(''); setStudentId(students[0]?.student_id ?? ''); setCourseId(courses[0]?.course_id ?? '');
      setSemester('2026-2027'); setGradeVal('A');
    }
  }, [open, students, courses]);

  // When student+course+semester selected, prefill existing grade
  useEffect(() => {
    if (!open) return;
    const existing = grades.find((g) => g.student_id === studentId && g.course_id === courseId && g.semester === semester);
    if (existing) setGradeVal(existing.grade);
  }, [studentId, courseId, semester, grades, open]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError('');
    const existing = grades.find((g) => g.student_id === studentId && g.course_id === courseId && g.semester === semester);
    if (existing) {
      const { error } = await supabase.from('grades').update({ grade: gradeVal }).eq('id', existing.id);
      setSaving(false);
      if (error) { setError(error.message); return; }
      onSaved();
    } else {
      const { error } = await supabase.from('grades').insert({ student_id: studentId, course_id: courseId, semester, grade: gradeVal });
      setSaving(false);
      if (error) { setError(error.message); return; }
      onSaved();
    }
  }

  const letterColors: Record<string, string> = {
    'O': 'border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    'A+': 'border-green-500 bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300',
    'A': 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
    'B+': 'border-cyan-500 bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300',
    'B': 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    'C': 'border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300',
    'D': 'border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
    'F': 'border-red-500 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300',
  };

  return (
    <Modal open={open} onClose={onClose} title="Assign / Edit Grade">
      <form onSubmit={save} className="space-y-4">
        <Field label="Student">
          <select value={studentId} onChange={(e) => setStudentId(e.target.value)} className="input" required>
            {students.map((s) => <option key={s.student_id} value={s.student_id}>{s.name} ({s.student_id})</option>)}
          </select>
        </Field>
        <Field label="Course">
          <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className="input" required>
            {courses.map((c) => <option key={c.course_id} value={c.course_id}>{c.course_name}</option>)}
          </select>
        </Field>
        <Field label="Semester">
          <input value={semester} onChange={(e) => setSemester(e.target.value)} className="input" required />
        </Field>
        <Field label="Grade">
          <div className="flex flex-wrap gap-2">
            {ALL_GRADES.map((l) => (
              <button type="button" key={l} onClick={() => setGradeVal(l)}
                className={`flex-1 rounded-xl border-2 px-2 py-2.5 text-sm font-bold transition ${gradeVal === l ? letterColors[l] : 'border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400'}`}>
                {l}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            10-point scale — O: 10, A+: 9, A: 8, B+: 7, B: 6, C: 5, D: 4, F: 0
          </p>
        </Field>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200">Cancel</button>
          <button type="submit" disabled={saving} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
            {saving ? 'Saving…' : 'Save Grade'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------- small helpers ---------- */
function Field({ label, children, disabled }: { label: string; children: React.ReactNode; disabled?: boolean }) {
  return (
    <label className={`block ${disabled ? 'opacity-60' : ''}`}>
      <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
      {children}
    </label>
  );
}
