import { defineConfig } from '@umijs/max';

export default defineConfig({
  antd: {},
  access: {},
  model: {},
  initialState: {},
  request: {},
  layout: {
    title: 'Image Agent Demo',
  },
  routes: [
    {
      path: '/',
      redirect: '/home',
    },
    {
      name: '图片 Agent',
      path: '/home',
      component: './Home',
    },
  ],
  proxy: {
    '/api': {
      target: 'http://localhost:3000',
      changeOrigin: true,
    },
  },
  npmClient: 'pnpm',
});
