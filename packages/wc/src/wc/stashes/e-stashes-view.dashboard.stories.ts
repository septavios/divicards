import { html, TemplateResult } from 'lit';
import './e-stashes-view';
import { MockStashLoader } from './data.js';

export default {
    title: 'Elements/stashes/stashes-view/Dashboard'
};

export const Dashboard = {
    render(): TemplateResult {
        return html`<e-stashes-view .stashLoader=${new MockStashLoader()}></e-stashes-view>`;
    }
};
