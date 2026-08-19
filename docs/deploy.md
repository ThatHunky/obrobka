# Деплой

Продакшн: **https://obrobka.dobrovolskyi.com.ua**

## Як влаштовано

```
obrobka.dobrovolskyi.com.ua   CNAME → obrobka-5gq.pages.dev   (proxied)
```

Cloudflare Pages, проєкт `obrobka`, продакшн-гілка `main`.
VPS із Caddy не задіяний — він далі обслуговує ботів.

## Викотити нову версію

```bash
set -a; . ~/.config/cloudflare/env; set +a
pnpm --filter @obrobka/web build
pnpm exec wrangler pages deploy apps/web/dist \
  --project-name obrobka --branch main --commit-dirty=true
```

Токен і `CLOUDFLARE_ACCOUNT_ID` лежать у `~/.config/cloudflare/env` (права 600).

## Перевірити після викочування

```bash
curl -sI https://obrobka.dobrovolskyi.com.ua/ | grep -i cross-origin
```

Очікується рівно два рядки:

```
cross-origin-opener-policy: same-origin
cross-origin-embedder-policy: credentialless
```

Без них сторінка не буде `crossOriginIsolated`, і WASM-треди не запрацюють.
Заголовки задаються файлом `apps/web/public/_headers`; `astro preview`
їх **не** застосовує — це фіча Cloudflare Pages.

Повний прогін проти живого сайту:

```bash
pnpm exec playwright test --config playwright.prod.config.ts
```

## Моделі на R2

Живуть на `models.obrobka.dobrovolskyi.com.ua`, бакет `obrobka-models`.

| Модель | Вага | Ліцензія |
|---|---|---|
| `u2netp.onnx` | 4,4 МБ | Apache-2.0 |
| `modnet.onnx` | 6,3 МБ | Apache-2.0 |
| `isnet-general.onnx` | 84,1 МБ | MIT |

Публікація:

```bash
set -a; . ~/.config/cloudflare/env; set +a
./scripts/publish-models.sh
```

**`--remote` обов'язковий.** Wrangler 4 за замовчуванням пише `r2 object put`
у локальну симуляцію (miniflare), і справжній бакет лишається порожнім —
без жодної помилки. Скрипт це враховує.

Перевірка заголовків:

```bash
curl -sI https://models.obrobka.dobrovolskyi.com.ua/u2netp.onnx \
  | grep -iE 'cross-origin-resource|access-control|cache-control'
```

Очікується `cross-origin-resource-policy: cross-origin` — **без нього наш
власний COEP заблокує завантаження моделей**. Заголовок додається не
бакетом, а Transform Rule на зоні `dobrovolskyi.com.ua`.

## Обмеження, про які треба пам'ятати

**Cloudflare Pages не приймає файли понад 25 MiB.** Найбільший ассет
сайту — 3,4 МБ (`avif_enc_mt.wasm`). Моделі лежать на R2 саме тому, що
`isnet-general` у цей ліміт не влазить.

**BiRefNet_lite не використовується.** При 1024×1024 його вбив OOM-кілер
на машині з 4,2 ГБ вільної пам'яті; у вкладці зі стелею wasm32 шансів
менше. Повертатись до нього варто лише з WebGPU, де ваги лягають
у пам'ять відеокарти.

## Версії, зафіксовані навмисно

`pnpm` 11 відхиляє пакети, опубліковані менш ніж добу тому. Екосистема
Astro випустила 7.2.4 того ж дня, тож `pnpm-workspace.yaml` фіксує
`astro: 7.2.3` і `satteri: 0.10.1` — найсвіжіші версії, які вже
відлежались. Знімати це закріплення варто свідомо, а не автоматично.
