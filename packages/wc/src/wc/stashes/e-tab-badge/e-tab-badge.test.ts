import { fixture, expect, html } from '@open-wc/testing';
import sinon from 'sinon';
import { TabBadgeElement } from './e-tab-badge.js';
import { TabClickEvent } from './events.js';
import './e-tab-badge';

describe('e-tab-badge', () => {
	let el: TabBadgeElement;

	beforeEach(async () => {
    el = await fixture(html`<e-tab-badge></e-tab-badge>`);
    // Provide a minimal tab so the component renders correctly
    el.tab = { id: 'Test id', name: 'Heist', type: 'Unknown' as any, index: 1, metadata: { colour: 'ffffff' } } as any;
    await el.updateComplete;
	});

	it('should render a component', () => {
		expect(el).to.exist;
	});

  it('should emit tab click with tab payload', async () => {
    const clickSpy = sinon.spy();
    el.addEventListener('stashes__tab-click', clickSpy);
    const btn = el.shadowRoot?.querySelector('button.tab-badge-as-button') as HTMLButtonElement;
    btn.click();
    await el.updateComplete;

    expect(clickSpy).to.have.been.calledOnce;
    const evt = clickSpy.args[0][0] as TabClickEvent;
    expect((evt as any).$tab?.id).to.equal('Test id');
    expect((evt as any).$tab?.name).to.equal('Heist');
  });
});
