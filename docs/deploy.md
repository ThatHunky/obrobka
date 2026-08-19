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

## Обмеження, про які треба пам'ятати

**Cloudflare Pages не приймає файли понад 25 MiB.** Зараз найбільший
ассет — 3,4 МБ (`avif_enc_mt.wasm`), запас великий.

Але моделі з M2 у ліміт не влізуть:

| Модель | Вага | Куди |
|---|---|---|
| MODNet uint8 | 6,3 МБ | Pages |
| Swin2SR ×2 uint8 | 5,3 МБ | Pages |
| ormbg int8 | 42,3 МБ | **R2** |
| BiRefNet_lite fp16 | 109,2 МБ | **R2** |

Для них знадобиться R2-бакет на `models.obrobka.dobrovolskyi.com.ua`
з `Cross-Origin-Resource-Policy: cross-origin` — без цього заголовка
завантаження заблокує COEP. Ключі R2 вже є в тому самому env-файлі.

## Версії, зафіксовані навмисно

`pnpm` 11 відхиляє пакети, опубліковані менш ніж добу тому. Екосистема
Astro випустила 7.2.4 того ж дня, тож `pnpm-workspace.yaml` фіксує
`astro: 7.2.3` і `satteri: 0.10.1` — найсвіжіші версії, які вже
відлежались. Знімати це закріплення варто свідомо, а не автоматично.
