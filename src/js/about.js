import './main.js';
import '../css/pages.css';
import { mountScene } from './scene/mount.js';

mountScene(document.querySelector('[data-scene]'), 'still');
