import { useState } from 'react';
import { GraduationCap, LogIn, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { User } from '@/types';

interface Props {
  onLogin: (user: User) => void;
}

export function LoginScreen({ onLogin }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data, error: qErr } = await supabase
        .from('users')
        .select('*')
        .eq('email', email.trim().toLowerCase())
        .eq('password', password)
        .maybeSingle();
      if (qErr) throw qErr;
      if (!data) {
        setError('Invalid email or password. Try one of the demo accounts below.');
        setLoading(false);
        return;
      }
      onLogin(data as User);
    } catch (err) {
      setError('Could not reach the login service. Please try again.');
      setLoading(false);
    }
  }

  function quickFill(em: string, pw: string) {
    setEmail(em);
    setPassword(pw);
    setError('');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-800/90 md:grid md:grid-cols-2">
          {/* Hero side */}
          <div className="relative hidden flex-col justify-between bg-gradient-to-br from-blue-600 to-blue-800 p-10 text-white md:flex">
            <div>
              <div className="mb-8 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
                  <GraduationCap className="h-7 w-7" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold">UniPortal</h1>
                  <p className="text-sm text-blue-100">Student Database Management System</p>
                </div>
              </div>
              <h2 className="mb-3 text-3xl font-bold leading-tight">Manage students, courses & grades in one place.</h2>
              <p className="text-blue-100">
                A complete dashboard for administrators and students — track enrollment, assign grades, and calculate GPA automatically.
              </p>
            </div>
            <div className="space-y-3 text-sm text-blue-100">
              <div className="rounded-xl bg-white/10 p-4 backdrop-blur">
                <p className="mb-1 font-semibold text-white">Admin demo</p>
                <p>admin@university.edu · admin123</p>
              </div>
              <div className="rounded-xl bg-white/10 p-4 backdrop-blur">
                <p className="mb-1 font-semibold text-white">Student demo</p>
                <p>rahul.sharma@college.edu · student123</p>
              </div>
            </div>
          </div>

          {/* Form side */}
          <div className="p-8 sm:p-10">
            <div className="mb-8 flex items-center gap-3 md:hidden">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
                <GraduationCap className="h-6 w-6" />
              </div>
              <h1 className="text-lg font-semibold text-slate-900 dark:text-white">UniPortal</h1>
            </div>

            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Welcome back</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Sign in to access your dashboard.</p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  placeholder="you@university.edu"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Password</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pr-11 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                  >
                    {showPw ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
              >
                <LogIn className="h-5 w-5" />
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/50">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Quick demo logins</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => quickFill('admin@university.edu', 'admin123')}
                  className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-blue-50 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  Admin
                </button>
                <button
                  onClick={() => quickFill('rahul.sharma@college.edu', 'student123')}
                  className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-blue-50 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  Student (Rahul)
                </button>
                <button
                  onClick={() => quickFill('priya.nair@college.edu', 'student123')}
                  className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-blue-50 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  Student (Priya)
                </button>
                <button
                  onClick={() => quickFill('amit.verma@college.edu', 'student123')}
                  className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-blue-50 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  Student (Amit)
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
