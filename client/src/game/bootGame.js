import Phaser from 'phaser';
import { GameScene } from './GameScene.js';

export function createGame() {
  const game = new Phaser.Game({
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
  });
  game.scene.add('GameScene', GameScene, false);
  return game;
}
