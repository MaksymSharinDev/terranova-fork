export enum EGameEvent {
  INIT = 'INIT',
  LOADED = 'LOADED',
  DATE = 'DATE',
  STATE_CHANGE = 'STATE_CHANGE',
  PLAY = 'PLAY',
  PAUSE = 'PAUSE',
  FASTER = 'FASTER',
  SLOWER = 'SLOWER',

  NEW_REGION = 'NEW_REGION',
  NEW_POP = 'NEW_POP',
}

export interface IGameWorkerEventData {
  type: string;
  id?: number;
  payload?: any;
}


export type EventHandler = (params: any) => void;
