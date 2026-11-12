import type { ReactNode } from 'react';
import type { Manifest } from '../src/manifest/types';
import { SNAPSHOT_MANIFEST } from '../src/manifest/snapshot';
import { createRenderRegistry } from '../src/nodes/views';
import battery from './assets/battery.svg';
import cellular from './assets/cellular.svg';
import close from './assets/close.svg';
import locationIcon from './assets/location.svg';
import menuDots from './assets/menu-dots.svg';
import paperclip from './assets/paperclip.svg';
import soundwave from './assets/soundwave.svg';
import sparkle from './assets/sparkle.svg';
import wifi from './assets/wifi.svg';

export const WEB_FONTS: Manifest['font'] = {
  default: { regular: 'DM Sans', medium: 'DM Sans', semibold: 'DM Sans', bold: 'DM Sans', black: 'DM Sans' },
  geist: { regular: 'Geist', semibold: 'Geist' },
  inter: { semibold: 'Inter' },
};
export const manifest: Manifest = { ...SNAPSHOT_MANIFEST, font: WEB_FONTS };
export const registry = createRenderRegistry();

export const WIDTHS = [320, 360, 412];
export const BACKGROUNDS = { white: '#FFFFFF', screen: SNAPSHOT_MANIFEST.color.screen! };

export type Frame = 'chat' | 'plain';

export function ChatFrame({ width, prompt, background, children }: { width: number; prompt: string; background: string; children: ReactNode }) {
  return (
    <div className="phone" style={{ width: width + 40, background }}>
      <div className="statusbar">
        <span className="clock">9:41</span>
        <span className="levels">
          <img src={cellular} alt="" />
          <img src={wifi} alt="" />
          <img src={battery} alt="" />
        </span>
      </div>
      <div className="chatHeader">
        <span className="round">
          <img src={close} alt="Close" />
        </span>
        <span className="round">
          <img src={menuDots} alt="More" />
        </span>
      </div>
      <div className="chatBody">
        <div className="bubble">{prompt}</div>
        <div className="reply">
          <div className="myra">
            <span className="myraText">Myra</span>
            <img className="myraStar" src={sparkle} alt="" />
          </div>
          {children}
        </div>
      </div>
      <div className="composer">
        <div className="composerCard">
          <div className="placeholder">
            <span className="caret">|</span>Ask me anything
          </div>
          <div className="composerRow">
            <div className="composerLeft">
              <span className="chip iconChip">
                <img src={paperclip} alt="Attach" />
              </span>
              <span className="chip modeChip">
                <img src={locationIcon} alt="" />
                myItinerary Mode
              </span>
            </div>
            <span className="speak">
              <img src={soundwave} alt="" />
              <span className="speakText">Speak</span>
            </span>
          </div>
        </div>
        <div className="homeIndicator" />
      </div>
    </div>
  );
}

