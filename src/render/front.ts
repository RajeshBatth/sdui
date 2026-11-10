import { createContext } from 'react';

export interface FrontState {
  frontId: string;
  isFront: boolean;
}
export const FrontContext = createContext<FrontState | null>(null);
