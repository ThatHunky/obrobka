<script lang="ts">
  import type { Metadata } from '@obrobka/metadata';
  import type { Dict } from '../lib/i18n.js';

  const { meta, t }: { meta: Metadata | null; t: Dict } = $props();

  const tagCount = $derived(meta === null ? 0 : Object.keys(meta.tags).length);
  const shown = $derived.by(() => {
    if (meta === null) return [] as { key: string; label: string; value: string }[];
    const rows: { key: string; label: string; value: string }[] = [];

    const camera = [meta.camera?.make, meta.camera?.model, meta.camera?.lens]
      .filter((x) => x !== undefined).join(' · ');
    if (camera !== '') rows.push({ key: 'camera', label: t.exif.camera, value: camera });

    if (meta.shot?.takenAt !== undefined) {
      // Дата вже нормалізована в ISO; показуємо в місцевому вигляді читача.
      const d = new Date(meta.shot.takenAt);
      rows.push({
        key: 'taken', label: t.exif.taken,
        value: Number.isNaN(d.getTime()) ? meta.shot.takenAt : d.toLocaleString(),
      });
    }

    const settings = [
      meta.shot?.exposureTime !== undefined && meta.shot.exposureTime > 0
        ? `1/${Math.round(1 / meta.shot.exposureTime)} s` : undefined,
      meta.shot?.fNumber !== undefined ? `f/${meta.shot.fNumber}` : undefined,
      meta.shot?.iso !== undefined ? `ISO ${meta.shot.iso}` : undefined,
      meta.shot?.focalLength !== undefined ? `${meta.shot.focalLength} mm` : undefined,
    ].filter((x) => x !== undefined).join(' · ');
    if (settings !== '') rows.push({ key: 'settings', label: t.exif.settings, value: settings });

    if (meta.software !== undefined) {
      rows.push({ key: 'software', label: t.exif.software, value: meta.software });
    }
    // Орієнтацію показуємо лише коли вона щось міняє — одиниця не новина.
    if (meta.orientation !== undefined && meta.orientation !== 1) {
      rows.push({
        key: 'orientation', label: t.exif.orientation,
        value: `${meta.orientation} — ${t.exif.orientationApplied}`,
      });
    }
    return rows;
  });

  /** Скільки теґів лишилось поза таблицею — щоб не вдавати, що показано все. */
  const hidden = $derived(Math.max(0, tagCount - shown.length));
</script>

{#if meta !== null && tagCount > 0}
  <section class="exif" data-testid="exif-panel">
    <h3>{t.exif.title}</h3>

    {#if meta.gps !== undefined}
      <p class="gps" data-testid="exif-gps">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" />
        </svg>
        <span>
          <strong>{t.exif.gpsWarning}</strong>
          <code>{meta.gps.latitude.toFixed(5)}, {meta.gps.longitude.toFixed(5)}</code>
          <a
            href={`https://www.openstreetmap.org/?mlat=${meta.gps.latitude}&mlon=${meta.gps.longitude}#map=15/${meta.gps.latitude}/${meta.gps.longitude}`}
            target="_blank"
            rel="noreferrer noopener"
          >{t.exif.map}</a>
        </span>
      </p>
    {/if}

    {#if shown.length > 0}
      <dl>
        {#each shown as row (row.key)}
          <dt>{row.label}</dt>
          <dd data-testid={`exif-${row.key}`}>{row.value}</dd>
        {/each}
      </dl>
    {/if}

    <p class="clean">
      {t.exif.cleanResult}
      {#if hidden > 0}<em>({t.exif.more(hidden)})</em>{/if}
    </p>
  </section>
{/if}

<style>
  .exif {
    border: 1px solid var(--line);
    border-radius: var(--r-md);
    background: var(--bg-raised);
    padding: 0.85rem 1rem;
  }
  h3 {
    margin: 0 0 0.6rem;
    font-size: 0.78rem; font-weight: 600;
    letter-spacing: 0.04em; text-transform: uppercase;
    color: var(--fg-muted);
  }

  /* Координати — найчутливіше з усього, тож вони не в загальному списку */
  .gps {
    display: flex; gap: 0.5rem; align-items: flex-start;
    margin: 0 0 0.7rem;
    padding: 0.6rem 0.7rem;
    border-radius: var(--r-sm);
    background: color-mix(in oklab, var(--gold-600) 10%, transparent);
    border: 1px solid color-mix(in oklab, var(--gold-600) 32%, transparent);
    font-size: 0.82rem; line-height: 1.5;
  }
  .gps svg { flex: none; margin-top: 0.15rem; color: var(--gold-600); }
  .gps strong { display: block; font-weight: 600; }
  .gps code { font-family: var(--font-mono); font-size: 0.78rem; color: var(--fg-muted); }
  .gps a { margin-inline-start: 0.4rem; color: var(--accent); }

  dl {
    display: grid; grid-template-columns: auto 1fr;
    gap: 0.25rem 0.9rem; margin: 0;
    font-size: 0.82rem;
  }
  dt { color: var(--fg-faint); }
  dd { margin: 0; color: var(--fg); }

  .clean {
    margin: 0.7rem 0 0;
    font-size: 0.76rem; line-height: 1.5;
    color: var(--fg-faint);
  }
  .clean em { font-style: normal; opacity: 0.75; }
</style>
