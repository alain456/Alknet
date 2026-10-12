import { lazy, Suspense } from 'react';

export function lazyPage(loader) {
  const Page = lazy(loader);
  function LazyPage(props) {
    return (
      <Suspense fallback={<div className="min-h-[30vh] grid place-items-center text-sm text-ink">Chargement…</div>}>
        <Page {...props} />
      </Suspense>
    );
  }
  return LazyPage;
}
