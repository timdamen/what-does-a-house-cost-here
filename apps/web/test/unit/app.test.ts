import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';

import App from '../../app/app.vue';

describe('app shell', () => {
  it('renders the placeholder page', async () => {
    const wrapper = await mountSuspended(App, { route: '/' });

    expect(wrapper.text()).toContain('What does a house cost here?');
  });
});
