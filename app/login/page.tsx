import type { Metadata } from 'next';
import LoginForm from './LoginForm';

export const metadata: Metadata = { title: 'HR login' };

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 px-4">
      <div className="w-full max-w-[400px] rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-5 text-lg font-bold tracking-tight text-slate-900">JobBor</div>
        <h1 className="text-[22px] font-bold tracking-tight text-slate-900">HR account</h1>
        <p className="mb-6 mt-1 text-slate-500">
          Sign in or create an account to manage vacancies and candidates.
        </p>
        <LoginForm />
      </div>
    </main>
  );
}
