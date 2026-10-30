import type { Metadata } from 'next';
import ApplicantsBoard from '@/components/applicants/ApplicantsBoard';

export const metadata: Metadata = { title: 'Job Appliers' };

// Render <ApplicantsBoard /> inside your DashboardShell if the route lives under it.
export default function ApplicantsPage() {
  return <ApplicantsBoard />;
}
