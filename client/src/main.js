import Phaser from 'phaser';
import './styles/main.css';
import { App } from './ui/App.js';
import { GameScene } from './game/GameScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game-root',
  backgroundColor: '#060918',
  transparent: false,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: window.innerWidth,
    height: window.innerHeight
  },
  render: {
    antialias: true,
    pixelArt: false,
    roundPixels: true,
    powerPreference: 'high-performance'
  },
  input: {
    activePointers: 3,
    keyboard: true,
    mouse: true,
    touch: true
  },
  scene: []
};

const game = new Phaser.Game(config);
game.scene.add('GameScene', GameScene, false);

const app = new App(game);

if (import.meta.env.DEV) {
  window.tagGame = { game, app };
}
