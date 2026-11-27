import React, { useState } from 'react';
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { CurriculumBlueprint } from './EditorialIllustration';

interface AuthGateProps {
  isSigningIn: boolean;
  authError: string | null;
  onGoogleSignIn: () => void;
  onContinueGuestSample: () => void;
}

export const AuthGate: React.FC<AuthGateProps> = ({
  isSigningIn,
  authError,
  onGoogleSignIn,
  onContinueGuestSample,
}) => {
  const [authMode, setAuthMode] = useState<'signup' | 'login'>('signup');

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-16">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Left Column: Safe Sign Up & Log In Card */}
        <div className="lg:col-span-7 space-y-8">
          <div className="space-y-3">
            <p className="text-sm font-medium text-[#0284C7] dark:text-sky-400">
              Verified Student Accounts · Cloud-Synced Learning Paths
            </p>
            <h1 className="font-display text-3xl sm:text-4xl lg:text-[42px] font-semibold tracking-tight text-[#0F172A] dark:text-slate-100 leading-[1.12]">
              Your AI study companion for every class, board, and subject.
            </h1>
            <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
              Create your private student account to unlock syllabus-aligned notes, short notes,
              study shortcuts, visual diagrams, PDF maker, aptitude & previous year papers, weekly
              timetables, and 10-minute motivation classes.
            </p>
          </div>

          <section
            aria-label="Safe student signup and login"
            className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl p-6 sm:p-8 space-y-6 max-w-xl"
          >
            {/* Interactive Sign Up / Log In Mode Tabs */}
            <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => setAuthMode('signup')}
                aria-pressed={authMode === 'signup'}
                className={`py-2 text-sm font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  authMode === 'signup'
                    ? 'bg-white dark:bg-slate-700 text-[#0F172A] dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-slate-200'
                }`}
              >
                Create Student Account
              </button>
              <button
                type="button"
                onClick={() => setAuthMode('login')}
                aria-pressed={authMode === 'login'}
                className={`py-2 text-sm font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  authMode === 'login'
                    ? 'bg-white dark:bg-slate-700 text-[#0F172A] dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-slate-200'
                }`}
              >
                Student Log In
              </button>
            </div>

            <div className="space-y-2">
              <h2 className="font-display text-2xl font-semibold text-[#0F172A] dark:text-slate-100">
                {authMode === 'signup'
                  ? 'Start your personalized study profile'
                  : 'Welcome back to your study desk'}
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {authMode === 'signup'
                  ? 'Sign up safely with Google in one click, then choose your Class, Syllabus Board (CBSE, ICSE, State Board, IB, IGCSE), and Subjects.'
                  : 'Log in with your verified Google account to restore your saved syllabus paths, study timetable, quizzes, and AI tutor threads.'}
              </p>
            </div>

            {authError && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 dark:border-red-800/80 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-800 dark:text-red-300 flex items-start gap-2.5"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" aria-hidden="true" />
                <span>{authError}</span>
              </div>
            )}

            <div className="space-y-3">
              <button
                type="button"
                onClick={onGoogleSignIn}
                disabled={isSigningIn}
                className="w-full inline-flex items-center justify-center gap-3 px-5 py-3 text-sm font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
              >
                {isSigningIn ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    Verifying with Google...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                    {authMode === 'signup'
                      ? 'Sign Up Safely with Google'
                      : 'Log In Safely with Google'}
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onContinueGuestSample}
                disabled={isSigningIn}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-[#0F172A] dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                Try Sample Workspace (Aarav · Class 10 CBSE)
              </button>
            </div>

            {/* Security Guarantees (Plain Language, Zero Slop) */}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-5 space-y-2.5">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">How your student account stays safe</p>
              <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#059669] dark:text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>Verified Google OAuth sign-in — no raw passwords stored or exposed.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#059669] dark:text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>Private per-student database isolation — only your verified account can read or edit your study paths.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#059669] dark:text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>Automatic cloud sync across devices for your syllabus, notes, timetable, and quiz mastery.</span>
                </li>
              </ul>
            </div>
          </section>
        </div>

        {/* Right Column: Live Curriculum Preview */}
        <div className="lg:col-span-5 lg:sticky lg:top-24">
          <CurriculumBlueprint
            classLevel="Class 10"
            syllabus="CBSE"
            selectedSubjects={['Mathematics', 'Physics', 'World History']}
            dailyMinutes={45}
          />
        </div>
      </div>
    </main>
  );
};
