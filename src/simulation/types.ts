import ndarray from 'ndarray';


export interface IWorldMapGenOptions {
  seed: string | number,
  sealevel: number,
  size: {
    width: number,
    height: number,
  },
  worldShape: EWorldShape,
  worldShapePower: number,
  riverThreshold: number,
  temperature: {
    min: number,
    max: number,
  }
  elevationCoolingAmount: number,
  depressionFillPercent: number, // 0 to 1
}

export interface ICellHeightMapOptions {
  // offset in world coordinates relative to origin of world map
  offset: {
    x: number;
    y: number;
  };

  // size of local map in local coordinates
  size: {
    width: number,
    height: number,
  };
}

export enum EWorldShape {
  FREEFORM = 'freeform',
  CIRCLE = 'circle',
  RECTANGLE = 'rectangle',
}

export interface IWorldWorkerOutput {
  options: IWorldMapGenOptions,
  sealevel: number,
  heightmap: ndarray.Data<number>,
  riverMap: ndarray.Data<number>,
  terrainMap: ndarray.Data<number>,
  flowDirections: ndarray.Data<number>,
  cellTypes: ndarray.Data<number>,
  cellFeatures: ndarray.Data<number>,
  drainageBasins: {
    [id: number]: {
      color: number,
      cells: [number, number][],
    }
  },
  upstreamCells: ndarray.Data<number>;
  temperatures: ndarray.Data<number>;
  moistureMap: ndarray.Data<number>;
  moistureZones: ndarray.Data<number>;
  temperatureZones: ndarray.Data<number>;
  biomes: ndarray.Data<number>;
  terrainRoughness: ndarray.Data<number>;
}

export interface ITerrainWorkerOutput {
  heightmap: ndarray.Data<number>;
}
