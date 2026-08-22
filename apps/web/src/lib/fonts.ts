/*
 * Згенеровано scripts/fetch-fonts.mjs — правити тут немає сенсу.
 */

/**
 * Шрифти, які підвантажуються наперед.
 *
 * Лише Inter і лише дві підмножини — латиниця й кирилиця. Це основний
 * текст, від якого залежить перший показ. Заголовковий Unbounded важчий
 * і потрібен для кількох рядків, тож він іде звичайним шляхом зі swap:
 * підвантажувати наперед усе означало б змагатися самому із собою
 * за смугу.
 */
export const FONT_PRELOAD: readonly string[] = [
  "/fonts/inter-v20-UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7.woff2",
  "/fonts/inter-v20-UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa0ZL7SUc.woff2"
];
