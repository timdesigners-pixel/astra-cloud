import './stiller/index.css';
import './kabuk/menu.css';
import './ozellikler/ortak.css';
import { kapiyiBaslat } from './kapi/gate';
import { kabuguBaslat } from './kabuk/kabuk';

document.body.classList.add('g-locked');
kapiyiBaslat();
kabuguBaslat();
