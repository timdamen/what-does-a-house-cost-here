import type { GeocodeSearchResult } from '@house-cost/domain';
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime';
import { describe, expect, it, vi } from 'vitest';

import PlaceSearch from '../../app/components/PlaceSearch.vue';

const RESPONSE: GeocodeSearchResult = {
  data: [
    {
      label: 'Amsterdam, Netherlands',
      location: { lat: 52.372759, lng: 4.893604 },
      countryCode: 'NL',
    },
    {
      label: 'Amstelveen, Netherlands',
      location: { lat: 52.3114, lng: 4.8701 },
      countryCode: 'NL',
    },
  ],
  provenance: { source: 'fixture', fetchedAt: '2026-09-17T00:00:00.000Z' },
};

const seen: string[] = [];
registerEndpoint('/api/geocode', (event) => {
  const q = new URL(event.node.req.url ?? '', 'http://localhost').searchParams.get('q') ?? '';
  seen.push(q);
  return q === 'nowhere' ? { data: [], provenance: RESPONSE.provenance } : RESPONSE;
});

async function mountSearch() {
  const wrapper = await mountSuspended(PlaceSearch, {
    route: '/',
    props: { debounceMs: 0 },
  });
  const input = wrapper.find('input[role="combobox"]');
  return { wrapper, input };
}

describe('PlaceSearch', () => {
  it('renders results from the geocode endpoint after typing', async () => {
    const { wrapper, input } = await mountSearch();

    await input.setValue('Amst');

    await vi.waitFor(() => {
      expect(wrapper.findAll('[role="option"]')).toHaveLength(2);
    });
    expect(seen).toContain('Amst');
    expect(wrapper.text()).toContain('Amsterdam, Netherlands');
    expect(input.attributes('aria-expanded')).toBe('true');
    expect(wrapper.find('[role="option"][aria-selected="true"]').text()).toContain('Amsterdam');
  });

  it('writes the rounded Location to the URL when a result is clicked', async () => {
    const { wrapper, input } = await mountSearch();
    const router = useRouter();

    await input.setValue('Amst');
    await vi.waitFor(() => {
      expect(wrapper.findAll('[role="option"]')).toHaveLength(2);
    });

    await wrapper.findAll('[role="option"]')[0]!.trigger('click');

    await vi.waitFor(() => {
      expect(router.currentRoute.value.query).toEqual({ lat: '52.3728', lng: '4.8936' });
    });
    expect(wrapper.emitted('select')?.[0]?.[0]).toMatchObject({ label: 'Amsterdam, Netherlands' });
    expect((input.element as HTMLInputElement).value).toBe('Amsterdam, Netherlands');
    expect(input.attributes('aria-expanded')).toBe('false');
  });

  it('is keyboard operable: arrows move, Enter selects', async () => {
    const { wrapper, input } = await mountSearch();
    const router = useRouter();

    await input.setValue('Amst');
    await vi.waitFor(() => {
      expect(wrapper.findAll('[role="option"]')).toHaveLength(2);
    });

    await input.trigger('keydown', { key: 'ArrowDown' });
    expect(wrapper.find('[role="option"][aria-selected="true"]').text()).toContain('Amstelveen');
    expect(input.attributes('aria-activedescendant')).toBe(
      wrapper.find('[role="option"][aria-selected="true"]').attributes('id'),
    );

    await input.trigger('keydown', { key: 'Enter' });

    await vi.waitFor(() => {
      expect(router.currentRoute.value.query).toEqual({ lat: '52.3114', lng: '4.8701' });
    });
  });

  it('tells the visitor when nothing matches', async () => {
    const { wrapper, input } = await mountSearch();

    await input.setValue('nowhere');

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('No places found');
    });
    expect(wrapper.findAll('[role="option"]')).toHaveLength(0);
  });
});
