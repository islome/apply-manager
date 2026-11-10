import type { Metadata } from 'next';
import LoginForm from './LoginForm';
import LoginIntro from './LoginIntro';
import LoginShowcase from './LoginShowcase';

export const metadata: Metadata = { title: 'HR login' };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen bg-white">
      {/* Left: photo panel (laptop and up) */}
      <LoginShowcase />

      {/* Right: the form, no card */}
      <section className="relative flex min-h-screen w-full flex-col px-6 py-6 sm:px-10 lg:w-1/2">
        <LoginIntro />
        <div className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-[360px] animate-fade-up motion-reduce:animate-none">
            <LoginForm />
          </div>
        </div>
      </section>
    </main>
  );
}
