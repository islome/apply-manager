import EmployeesView from '../EmployeesView';

// Reached from the "Company headcount" tile on /employees; deliberately not in the sidebar.
export default function CompanyEmployeesPage() {
  return <EmployeesView mode="company" />;
}
