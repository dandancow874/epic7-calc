export type AppPage = 'calculator' | 'builds';

const PAGE_KEY = 'epic7.tools.page.v1';

export function loadAppPage(): AppPage {
  const page = localStorage.getItem(PAGE_KEY) as AppPage | null;
  return page && ['calculator', 'builds'].includes(page) ? page : 'calculator';
}

export function saveAppPage(page: AppPage) {
  localStorage.setItem(PAGE_KEY, page);
}
