import type { Metadata } from 'next';
import { connection } from 'next/server';
import { phoneCodesOn } from '@/lib/otp';
import LoginForm from './LoginForm';
import LoginIntro from './LoginIntro';
import LoginShowcase from './LoginShowcase';

export const metadata: Metadata = { title: 'HR login' };
// rendered per request so HR_PHONE_CODES is read at runtime, not baked in at build time
export const instant = false;

export default async function LoginPage() {
  await connection();
  const phoneCodes = phoneCodesOn();
  return (
    <main className="flex min-h-screen bg-white">
      {/* Left: photo panel (laptop and up) */}
      <LoginShowcase />

      {/* Right: the form, no card */}
      <section data-login-panel className="relative flex min-h-screen w-full flex-col px-6 py-6 sm:px-10 lg:w-1/2">
        <LoginIntro />
        <div className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-[360px] animate-fade-up motion-reduce:animate-none">
            <LoginForm phoneCodes={phoneCodes} />
          </div>
        </div>
      </section>
    </main>
  );
}
