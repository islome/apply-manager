import type { Dict } from '../types';

const uz = {
  'shell.nav.home': 'Bosh sahifa',
  'shell.nav.vacancies': 'Vakansiyalar',
  'shell.nav.applicants': 'Arizalar',
  'shell.nav.employees': 'Xodimlar',
  'shell.nav.analytics': 'Tahlil',
  'shell.nav.close': 'Navigatsiyani yopish',
  'shell.sidebar.close': 'Yon panelni yopish',
  'shell.sidebar.open': 'Yon panelni ochish',
  'shell.companyProfile': 'Kompaniya profili',
  'shell.completeProfile': "Profilni to'ldiring",
  'shell.profileShort': 'Profil',
  'shell.logout': 'Chiqish',
  'shell.loggingOut': 'Chiqilmoqda…',
  'shell.logoutError': "Chiqib bo'lmadi. Ulanishni tekshirib, qayta urinib ko'ring.",
  'shell.menu': 'Menyu',
  'shell.countError': "Arizalar sonini yuklab bo'lmadi",
  'shell.countLabel': '{n} ta ariza',
  'shell.settings': 'Sozlamalar',
} as const;

const en: Dict<typeof uz> = {
  'shell.nav.home': 'Home',
  'shell.nav.vacancies': 'Vacancies',
  'shell.nav.applicants': 'Applicants',
  'shell.nav.employees': 'Employees',
  'shell.nav.analytics': 'Analytics',
  'shell.nav.close': 'Close navigation',
  'shell.sidebar.close': 'Close sidebar',
  'shell.sidebar.open': 'Open sidebar',
  'shell.companyProfile': 'Company profile',
  'shell.completeProfile': 'Complete your profile',
  'shell.profileShort': 'Profile',
  'shell.logout': 'Log out',
  'shell.loggingOut': 'Logging out…',
  'shell.logoutError': 'Could not log out. Check your connection and try again.',
  'shell.menu': 'Menu',
  'shell.countError': 'Could not load the applicant count',
  'shell.countLabel': '{n} applications',
  'shell.settings': 'Settings',
};

const ru: Dict<typeof uz> = {
  'shell.nav.home': 'Главная',
  'shell.nav.vacancies': 'Вакансии',
  'shell.nav.applicants': 'Заявки',
  'shell.nav.employees': 'Сотрудники',
  'shell.nav.analytics': 'Аналитика',
  'shell.nav.close': 'Закрыть навигацию',
  'shell.sidebar.close': 'Закрыть боковую панель',
  'shell.sidebar.open': 'Открыть боковую панель',
  'shell.companyProfile': 'Профиль компании',
  'shell.completeProfile': 'Заполните профиль',
  'shell.profileShort': 'Профиль',
  'shell.logout': 'Выйти',
  'shell.loggingOut': 'Выход…',
  'shell.logoutError': 'Не удалось выйти. Проверьте соединение и повторите попытку.',
  'shell.menu': 'Меню',
  'shell.countError': 'Не удалось загрузить количество заявок',
  'shell.countLabel': 'Заявок: {n}',
  'shell.settings': 'Настройки',
};

const messages = { uz, en, ru };
export default messages;
