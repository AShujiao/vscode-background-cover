import { createApp } from 'vue';
import App from './App.vue';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import 'element-plus/theme-chalk/dark/css-vars.css';
import * as ElIcons from '@element-plus/icons-vue';
import './styles/element-overrides.scss';
import './styles/base.scss';

const app = createApp(App);
app.use(ElementPlus);
// Register all icons so templates can use <component :is="ElIconName" />
for (const [name, comp] of Object.entries(ElIcons)) {
    app.component(name, comp as any);
}
app.mount('#app');
