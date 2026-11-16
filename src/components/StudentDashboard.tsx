import { useEffect, useMemo, useState } from 'react';
import {
  GraduationCap, LogOut, Mail, Building2, CalendarDays, IdCard,
  BookOpen, Award, TrendingUp, Trash2, CheckCircle2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { User, Student, Course, Grade, GradeWithCourse } from '@/types';
import { GRADE_POINTS, gpaFromGrades, MAX_GPA } from '@/types';
import type { User as AuthUser } from '@/types';

interface Props {
  user: AuthUser;
  onLogout: () => void;
  isDark: boolean;
  onToggleDark: () => void;
}

export function StudentDashboard({ user, onLogout, isDark, onToggleDark }: Props) {
  const [student, setStudent] = useState<Student | null>(null);
  const [grades, setGrades] = useState<GradeWithCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  async function load() {
    if (!user.student_id) { setLoading(false); return; }
    const [s, g] = await Promise.all([
      supabase.from('students').select('*').eq('student_id', user.student_id).maybeSingle(),
      supabase.from('grades').select('*, course:courses(*)').eq('student_id', user.student_id),
    ]);
    setStudent(s.data as Student | null);
    setGrades((g.data as unknown as GradeWithCourse[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 2600); }

  const currentSemester = useMemo(() => {
    // pick the most common semester among the student's grades
    const counts = new Map<string, number>();
    grades.forEach((g) => counts.set(g.semester, (counts.get(g.semester) ?? 0) + 1));
    if (counts.size === 0) return 'Fall 2026';
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0][0];
  }, [grades]);

  const semesterGrades = useMemo(() => grades.filter((g) => g.semester === currentSemester), [grades, currentSemester]);
  const cumGpa = useMemo(() => gpaFromGrades(grades), [grades]);
  const semesterGpa = useMemo(() => gpaFromGrades(semesterGrades), [semesterGrades]);
  const totalCredits = useMemo(() => grades.reduce((sum, g) => sum + (g.course?.credits ?? 0), 0), [grades]);

  async function dropCourse(grade: GradeWithCourse) {
    if (!confirm(`Drop ${grade.course.course_name} for ${currentSemester}?`)) return;
    const { error } = await supabase.from('grades').delete().eq('id', grade.id);
    if (error) { showToast('Could not drop course.'); return; }
    showToast(`${grade.course.course_name} dropped.`);
    load();
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-400 dark:bg-slate-950">Loading…</div>;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">UniPortal · Student</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{student?.name ?? user.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onToggleDark} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700">
              {isDark ? 'Light' : 'Dark'} mode
            </button>
            <button onClick={onLogout} className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-red-50 hover:text-red-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-red-950/40 dark:hover:text-red-400">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="animate-fade-in space-y-6">
          {/* Profile + GPA */}
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
              <div className="flex items-start gap-5">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 text-xl font-bold text-white">
                  {student?.name?.split(' ').map((n) => n[0]).slice(0, 2).join('') ?? '?'}
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">{student?.name}</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{student?.department}</p>
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <InfoRow icon={IdCard} label="Student ID" value={student?.student_id ?? '—'} />
                    <InfoRow icon={Mail} label="Email" value={student?.email ?? '—'} />
                    <InfoRow icon={Building2} label="Department" value={student?.department ?? '—'} />
                    <InfoRow icon={CalendarDays} label="Enrolled" value={student?.enrollment_date ?? '—'} />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <GpaCard label="Cumulative GPA" value={cumGpa} accent="blue" />
              <div className="grid grid-cols-2 gap-4">
                <MiniStat label="Credits" value={String(totalCredits)} icon={BookOpen} />
                <MiniStat label="Courses" value={String(grades.length)} icon={Award} />
              </div>
            </div>
          </div>

          {/* Semester GPA banner */}
          <div className="flex flex-col gap-3 rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-5 dark:border-blue-900 dark:from-blue-950/40 dark:to-indigo-950/40 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Current Semester — {currentSemester}</p>
              <p className="text-xs text-blue-600/70 dark:text-blue-400/70">Semester GPA based on {semesterGrades.length} course(s)</p>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-blue-700 dark:text-blue-300">{semesterGpa.toFixed(2)}</span>
              <span className="text-sm text-blue-600/70 dark:text-blue-400/70">/ {MAX_GPA.toFixed(2)}</span>
            </div>
          </div>

          {/* Courses table */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Registered Courses — {currentSemester}</h3>
              <span className="text-xs text-slate-500 dark:text-slate-400">{semesterGrades.length} course(s)</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Course ID</th>
                    <th className="px-5 py-3 font-semibold">Course Name</th>
                    <th className="px-5 py-3 font-semibold">Instructor</th>
                    <th className="px-5 py-3 font-semibold">Credits</th>
                    <th className="px-5 py-3 font-semibold">Grade</th>
                    <th className="px-5 py-3 font-semibold">Points</th>
                    <th className="px-5 py-3 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {semesterGrades.length === 0 ? (
                    <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-400">No courses registered for {currentSemester}.</td></tr>
                  ) : semesterGrades.map((g) => (
                    <tr key={g.id} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-5 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">{g.course_id}</td>
                      <td className="px-5 py-3 font-medium text-slate-900 dark:text-white">{g.course.course_name}</td>
                      <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{g.course.instructor}</td>
                      <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{g.course.credits}</td>
                      <td className="px-5 py-3"><GradeBadge grade={g.grade} /></td>
                      <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{GRADE_POINTS[g.grade].toFixed(1)}</td>
                      <td className="px-5 py-3 text-right">
                        <button onClick={() => dropCourse(g)} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40" aria-label="Drop course">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* GPA breakdown */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">GPA Calculation Breakdown</h3>
            <div className="space-y-2">
              {grades.length === 0 ? (
                <p className="text-sm text-slate-400">No grades recorded yet.</p>
              ) : grades.map((g) => (
                <div key={g.id} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <span className="text-slate-700 dark:text-slate-200">{g.course.course_name} <span className="text-slate-400">({g.semester})</span></span>
                  <span className="font-medium text-slate-600 dark:text-slate-300">
                    {GRADE_POINTS[g.grade].toFixed(1)} × {g.course.credits} cr = <span className="font-semibold text-slate-900 dark:text-white">{(GRADE_POINTS[g.grade] * g.course.credits).toFixed(1)}</span>
                  </span>
                </div>
              ))}
              <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3 dark:border-slate-700">
                <span className="font-semibold text-slate-900 dark:text-white">Cumulative GPA</span>
                <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{cumGpa.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-xl dark:bg-slate-700 animate-slide-up">
          <CheckCircle2 className="h-4 w-4 text-green-400" />
          {toast}
        </div>
      )}
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-sm font-medium text-slate-900 dark:text-white">{value}</p>
      </div>
    </div>
  );
}

function GpaCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  const pct = Math.min(100, (value / MAX_GPA) * 100);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-2 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</p>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-4xl font-bold text-slate-900 dark:text-white">{value.toFixed(2)}</span>
        <span className="text-sm text-slate-400">/ {MAX_GPA.toFixed(2)}</span>
      </div>
      <div className="mt-3 h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800">
        <div className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function MiniStat({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <Icon className="mb-2 h-5 w-5 text-slate-400" />
      <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}

function GradeBadge({ grade }: { grade: string }) {
  const map: Record<string, string> = {
    'O': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
    'A+': 'bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300',
    'A': 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300',
    'B+': 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300',
    'B': 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
    'C': 'bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300',
    'D': 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300',
    'F': 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300',
  };
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${map[grade] ?? 'bg-slate-100 text-slate-700'}`}>{grade}</span>;
}
