/**
 * `true` once the browser has painted the server-rendered shell: two animation frames after the
 * first client component mounts (the first frame may still be the one hydration lands in). On
 * the server it is always `true`, so SSR never waits on it.
 *
 * The area requests and the map chunk start only after this flips. The shell's largest text is
 * painted from the server HTML, and anything requested before that paint joins its critical path
 * as far as Lighthouse's simulated throttling is concerned (ticket 13): with the 230 kB map chunk
 * or the `/api/*` responses in that path the deep link's LCP reads 2.8 s instead of 2.4 s. One
 * or two frames of delay cost the visitor nothing noticeable and keep first paint first.
 */
export function useAfterFirstPaint(): Ref<boolean> {
  const painted = useState('after-first-paint', () => import.meta.server);

  if (import.meta.client && !painted.value) {
    onMounted(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          painted.value = true;
        });
      });
    });
  }

  return painted;
}
