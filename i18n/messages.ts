// All UI texts. One file per area under ./messages, merged here.
// Add a key: put it in the right group file in uz, en AND ru (tsc fails if one is missing).
import common from './messages/common';
import shell from './messages/shell';
import login from './messages/login';
import dashboard from './messages/dashboard';
import vacancies from './messages/vacancies';
import settings from './messages/settings';
import applicants from './messages/applicants';
import employees from './messages/employees';
import analytics from './messages/analytics';

export const messages = {
  uz: { ...common.uz, ...shell.uz, ...login.uz, ...dashboard.uz, ...vacancies.uz, ...settings.uz, ...applicants.uz, ...employees.uz, ...analytics.uz },
  en: { ...common.en, ...shell.en, ...login.en, ...dashboard.en, ...vacancies.en, ...settings.en, ...applicants.en, ...employees.en, ...analytics.en },
  ru: { ...common.ru, ...shell.ru, ...login.ru, ...dashboard.ru, ...vacancies.ru, ...settings.ru, ...applicants.ru, ...employees.ru, ...analytics.ru },
};

export type MessageKey = keyof (typeof messages)['uz'];
