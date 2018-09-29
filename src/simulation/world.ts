import ndarray from 'ndarray';
import { IWorldgenWorkerOutput } from './simulation';
import { mapValues } from 'lodash';


export enum ETerrainType {
  OCEAN,
  LAND,
  RIVER,
  LAKE,
  COAST,
  MOUNTAIN,
}

export const terrainTypeLabels = {
  [ETerrainType.OCEAN]: 'Ocean',
  [ETerrainType.LAND]: 'Land',
  [ETerrainType.RIVER]: 'River',
  [ETerrainType.LAKE]: 'Lake',
  [ETerrainType.COAST]: 'Coastal water',
  [ETerrainType.MOUNTAIN]: 'Mountain',
}

export enum EBiome {
  NONE,
  GLACIAL,
  TUNDRA,
  BOREAL_FOREST,
  SHRUBLAND,
  GRASSLAND,
  SAVANNA,
  DESERT,
  TEMPERATE_FOREST,
  TEMPERATE_RAINFOREST,
  TROPICAL_FOREST,
  TROPICAL_RAINFOREST
}

export enum EMoistureZone {
  BARREN,
  ARID,
  SEMIARID,
  SEMIWET,
  WET,
}

export enum ETemperatureZone {
  ARCTIC,
  SUBARCTIC,
  TEMPERATE,
  SUBTROPICAL,
  TROPICAL,
}

export const biomeTitles = {
  [EBiome.NONE]: 'None',
  [EBiome.GLACIAL]: 'Glacial',
  [EBiome.TUNDRA]: 'Tundra',
  [EBiome.BOREAL_FOREST]: 'Boreal Forest',
  [EBiome.SHRUBLAND]: 'Scrubland',
  [EBiome.GRASSLAND]: 'Grassland',
  [EBiome.SAVANNA]: 'Savanna',
  [EBiome.DESERT]: 'Desert',
  [EBiome.TEMPERATE_FOREST]: 'Temperate Forest',
  [EBiome.TEMPERATE_RAINFOREST]: 'Temperate Rainforest',
  [EBiome.TROPICAL_FOREST]: 'Tropical Forest',
  [EBiome.TROPICAL_RAINFOREST]: 'Tropical Rainforest'
}

export const biomeLabelColors = {
  [EBiome.NONE]: 0x4783A0,
  [EBiome.GLACIAL]: 0xFFFFFF,
  [EBiome.TUNDRA]: 0x96D1C3,
  [EBiome.BOREAL_FOREST]: 0x006259,
  [EBiome.SHRUBLAND]: 0xB26A47,
  [EBiome.GRASSLAND]: 0xF6EB64,
  [EBiome.SAVANNA]: 0xC7C349,
  [EBiome.DESERT]: 0x8B4D32,
  [EBiome.TEMPERATE_FOREST]: 0x92D847,
  [EBiome.TEMPERATE_RAINFOREST]: 0x6B842A,
  [EBiome.TROPICAL_FOREST]: 0x097309,
  [EBiome.TROPICAL_RAINFOREST]: 0x005100
}

export const climateColors = {
  ocean: {
    deep: 0x3A52BB,
    coast: 0x4E6AE6,
  },
  biomes: {
    [EBiome.NONE]: 0x000000,
    [EBiome.GLACIAL]: 0xFFFFFF,
    [EBiome.TUNDRA]: 0x75805B,
    [EBiome.BOREAL_FOREST]: 0x42562F,
    [EBiome.SHRUBLAND]: 0xD7CC9E,
    [EBiome.GRASSLAND]: 0xADB981,
    [EBiome.SAVANNA]: 0xC9CD7C,
    [EBiome.DESERT]: 0xE1CA9E,
    [EBiome.TEMPERATE_FOREST]: 0x648C48,
    [EBiome.TEMPERATE_RAINFOREST]: 0x425D27,
    [EBiome.TROPICAL_FOREST]: 0x648C48,
    [EBiome.TROPICAL_RAINFOREST]: 0x426D18,
  },
}

export const moistureZoneRanges = {
  [EMoistureZone.BARREN]: { start: 0, end: 25 },
  [EMoistureZone.ARID]: { start: 25, end: 50 },
  [EMoistureZone.SEMIARID]: { start: 50, end: 100 },
  [EMoistureZone.SEMIWET]: { start: 100, end: 200 },
  [EMoistureZone.WET]: { start: 200, end: Infinity },
}

export const temperatureZoneRanges = {
  [ETemperatureZone.ARCTIC]: { start: -Infinity, end: -10 },
  [ETemperatureZone.SUBARCTIC]: { start: -10, end: 2 },
  [ETemperatureZone.TEMPERATE]: { start: 2, end: 15 },
  [ETemperatureZone.SUBTROPICAL]: { start: 15, end: 20 },
  [ETemperatureZone.TROPICAL]: { start: 20, end: Infinity },
}

// mapping between moisture zones and temperatures which returns biome
export const biomeRanges = {
  [EMoistureZone.BARREN]: {
    [ETemperatureZone.ARCTIC]: EBiome.TUNDRA,
    [ETemperatureZone.SUBARCTIC]: EBiome.TUNDRA,
    [ETemperatureZone.TEMPERATE]: EBiome.GRASSLAND,
    [ETemperatureZone.SUBTROPICAL]: EBiome.GRASSLAND,
    [ETemperatureZone.TROPICAL]: EBiome.DESERT,
  },
  [EMoistureZone.ARID]: {
    [ETemperatureZone.ARCTIC]: EBiome.TUNDRA,
    [ETemperatureZone.SUBARCTIC]: EBiome.TUNDRA,
    [ETemperatureZone.TEMPERATE]: EBiome.SHRUBLAND,
    [ETemperatureZone.SUBTROPICAL]: EBiome.SAVANNA,
    [ETemperatureZone.TROPICAL]: EBiome.DESERT,
  },
  [EMoistureZone.SEMIARID]: {
    [ETemperatureZone.ARCTIC]: EBiome.GLACIAL,
    [ETemperatureZone.SUBARCTIC]: EBiome.BOREAL_FOREST,
    [ETemperatureZone.TEMPERATE]: EBiome.TEMPERATE_FOREST,
    [ETemperatureZone.SUBTROPICAL]: EBiome.SHRUBLAND,
    [ETemperatureZone.TROPICAL]: EBiome.SAVANNA,
  },
  [EMoistureZone.SEMIWET]: {
    [ETemperatureZone.ARCTIC]: EBiome.GLACIAL,
    [ETemperatureZone.SUBARCTIC]: EBiome.BOREAL_FOREST,
    [ETemperatureZone.TEMPERATE]: EBiome.TEMPERATE_FOREST,
    [ETemperatureZone.SUBTROPICAL]: EBiome.TEMPERATE_FOREST,
    [ETemperatureZone.TROPICAL]: EBiome.TROPICAL_FOREST,
  },
  [EMoistureZone.WET]: {
    [ETemperatureZone.ARCTIC]: EBiome.GLACIAL,
    [ETemperatureZone.SUBARCTIC]: EBiome.BOREAL_FOREST,
    [ETemperatureZone.TEMPERATE]: EBiome.TEMPERATE_RAINFOREST,
    [ETemperatureZone.SUBTROPICAL]: EBiome.TEMPERATE_RAINFOREST,
    [ETemperatureZone.TROPICAL]: EBiome.TROPICAL_RAINFOREST,
  },
}

export enum EDirection {
  NONE,
  UP,
  DOWN,
  LEFT,
  RIGHT,
}

export const directionLabels = {
  [EDirection.NONE]: 'None',
  [EDirection.UP]: 'Up',
  [EDirection.DOWN]: 'Down',
  [EDirection.LEFT]: 'Left',
  [EDirection.RIGHT]: 'Right',
}

export class Cell {
  world: World;
  x: number;
  y: number;
  height: number;
  terrainType: ETerrainType;
  flowDir: EDirection;
  drainageBasin?: DrainageBasin;
  temperature: number;
  upstreamCount: number;
  isLand: boolean;
  moisture: number;
  biome: EBiome;

  constructor(
    world: World,
    {
      x,
      y,
      terrainType,
      height,
      flowDir,
      temperature,
      upstreamCount,
      moisture,
      biome,
    }: {
      x: number,
      y: number,
      height: number,
      terrainType: ETerrainType,
      flowDir: EDirection,
      temperature: number,
      upstreamCount: number,
      moisture: number,
      biome: EBiome,
    }
  ) {
    this.world = world;
    this.x = x;
    this.y = y;
    this.height = height;
    this.terrainType = terrainType;
    this.isLand = terrainType !== ETerrainType.OCEAN && terrainType !== ETerrainType.COAST;
    this.flowDir = flowDir;
    this.temperature = temperature;
    this.upstreamCount = upstreamCount;
    this.moisture = moisture;
    this.biome = biome;
  }
}

export class DrainageBasin {
  id: number;
  color: number;
  cells: Cell[];

  constructor(id: number, color, cells: Cell[]) {
    this.id = id;
    this.color = color;
    this.cells = cells;
    for (const cell of cells) {
      cell.drainageBasin = this;
    }
  }
}

interface IWorldStats {
  biomePercents: Record<EBiome, number>;
}

export default class World {
  grid: Cell[][];
  cells: Set<Cell>;
  size: {
    width: number;
    height: number;
  };
  sealevel: number;
  drainageBasins: DrainageBasin[];
  params: IWorldgenWorkerOutput;
  stats: IWorldStats;

  constructor(params: IWorldgenWorkerOutput) {
    this.params = params;
    this.grid = [];
    this.cells = new Set();
    this.size = params.options.size;
    this.sealevel = params.sealevel;
    const heightmap = ndarray(params.heightmap, [this.size.width, this.size.height]);
    const terrainTypes = ndarray(params.terrainTypes, [this.size.width, this.size.height]);
    const flowDirections = ndarray(params.flowDirections, [this.size.width, this.size.height]);
    const temperatures = ndarray(params.temperatures, [this.size.width, this.size.height]);
    const upstreamCells = ndarray(params.upstreamCells, [this.size.width, this.size.height]);
    const moistureMap = ndarray(params.moistureMap, [this.size.width, this.size.height]);
    const biomes = ndarray(params.biomes, [this.size.width, this.size.height]);
    for (let x = 0; x < this.size.width; x++) {
      this.grid[x] = [];
      for (let y = 0; y < this.size.height; y++) {
        const cell: Cell = new Cell(this, {
          x, y,
          height: heightmap.get(x, y),
          flowDir: flowDirections.get(x, y) as EDirection,
          terrainType: terrainTypes.get(x, y) as ETerrainType,
          temperature: temperatures.get(x, y),
          upstreamCount: upstreamCells.get(x, y),
          moisture: moistureMap.get(x, y),
          biome: biomes.get(x, y),
        });
        this.cells.add(cell);
        this.grid[x][y] = cell;
      }
    }
    this.drainageBasins = [];
    for (const [id, { color, cells }] of Object.entries(params.drainageBasins)) {
      this.drainageBasins.push(
        new DrainageBasin(parseInt(id, 10), color, cells.map(([x, y]) => this.grid[x][y])
      ));
    };

    // make stats
    const biomeCounts: any = {};
    let landCount = 0;
    for (const cell of this.cells) {
      if (cell.biome !== EBiome.NONE) {
        landCount++;
        if (cell.biome in biomeCounts) {
          biomeCounts[cell.biome]++;
        } else {
          biomeCounts[cell.biome] = 1;
        }
      }
    }
    const biomePercents = mapValues(biomeCounts, i => i / landCount) as Record<EBiome, number>;
    this.stats = { biomePercents };
  }

  get cellCount() {
    return this.size.width * this.size.height;
  }

  getCell(x: number, y: number): Cell | null {
    if (x < 0 || y < 0 || x >= this.size.width || y >= this.size.height) {
      return null;
    }
    return this.grid[x][y];
  }

}
