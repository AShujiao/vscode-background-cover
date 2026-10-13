import { createApp } from 'vue';
import App from './App.vue';
// Element Plus 组件与样式由 unplugin-vue-components 按需引入（见 vite.config.ts）。
// 暗色主题的 CSS 变量需要全局加载，按需引入不会包含它。
import 'element-plus/theme-chalk/dark/css-vars.css';
import './styles/element-overrides.scss';
import './styles/base.scss';

createApp(App).mount('#app');
