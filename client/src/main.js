import './styles/main.css';
import { App } from './ui/App.js';

const app = new App();

if (import.meta.env.DEV) {
  window.tagGame = { app };
}
