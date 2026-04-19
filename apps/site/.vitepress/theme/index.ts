import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';

import ReactIsland from './components/ReactIsland.vue';
import './custom.css';

const theme: Theme = {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('ReactIsland', ReactIsland);
  },
};

export default theme;
