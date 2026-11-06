import type { Metadata } from 'next';
import LoginForm from './LoginForm';
import LoginIntro from './LoginIntro';

export const metadata: Metadata = { title: 'HR login' };

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 px-4">
      <div className="w-full max-w-[400px] rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
        <LoginIntro />
        <LoginForm />
      </div>
    </main>
  );
}
