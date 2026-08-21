/**
 * libheif-js не постачає типів для збірки з вбудованим wasm — лише для
 * низькорівневого модуля Emscripten. Оголошуємо мінімум: фабрику модуля.
 * Форма самого модуля описана інтерфейсом LibHeif у index.ts, поруч
 * із поясненням, чому саме ці функції.
 */
declare module 'libheif-js/libheif-wasm/libheif-bundle.mjs' {
  const factory: () => unknown;
  export default factory;
}
