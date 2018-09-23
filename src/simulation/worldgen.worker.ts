import ndarray from 'ndarray';
import Alea from 'alea';
import SimplexNoise from 'simplex-noise';
import fill from 'ndarray-fill';
import ops from 'ndarray-ops';
import { IWorldgenOptions, IWorldgenWorkerOutput } from './simulation';
import {
  ETerrainType,
  EDirection,
  EBiome,
  moistureZoneRanges,
  temperatureZoneRanges,
  biomeRanges
} from './world';
import * as Collections from 'typescript-collections';
import * as Stats from 'simple-statistics';
import { groupBy, mapValues } from 'lodash';


/**
 * Priority Flood algorithm from:
 * https://arxiv.org/pdf/1511.04463v1.pdf
 */

function ndarrayStats(ndarray: ndarray) {
  const data = Array.from(ndarray.data);
  const quantiles = {};
  for (let q = 0; q <= 100; q += 1) {
    quantiles[q] = Stats.quantile(data, q / 100);
  }
  return {
    array: ndarray,
    avg: ops.sum(ndarray) / (ndarray.shape[0] * ndarray.shape[0]),
    max: ops.sup(ndarray),
    min: ops.inf(ndarray),
    quantiles
  };
}

function countUnique(ndarray: ndarray) {
  const data = Array.from(ndarray.data);
  return mapValues(groupBy(data, i => i), i => i.length);
}

const getNeighbors = (x: number, y: number): number[][] => [
  [x - 1, y],
  [x + 1, y],
  [x, y - 1],
  [x, y + 1],
]

const getNeighborsLabelled = (x: number, y: number): number[][] => [
  [x - 1, y, EDirection.LEFT],
  [x + 1, y, EDirection.RIGHT],
  [x, y - 1, EDirection.UP],
  [x, y + 1, EDirection.DOWN],
]

const neighborForDirection = {
  [EDirection.UP]: (x: number, y: number) => [x, y - 1],
  [EDirection.DOWN]: (x: number, y: number) => [x, y + 1],
  [EDirection.LEFT]: (x: number, y: number) => [x - 1, y],
  [EDirection.RIGHT]: (x: number, y: number) =>  [x + 1, y],
}

const oppositeDirections = {
  [EDirection.NONE]: EDirection.NONE,
  [EDirection.UP]: EDirection.DOWN,
  [EDirection.DOWN]: EDirection.UP,
  [EDirection.LEFT]: EDirection.RIGHT,
  [EDirection.RIGHT]: EDirection.LEFT,
}

function isValidCell(x: number, y: number, width: number, height: number): boolean {
  return x >= 0 && y >= 0 && x < width && y < height;
}


function loopGridCircle(x, y, radius) {
  let cells = [];
  for (let cx = x - radius; cx < x + radius; cx++) {
    for (let cy = y - radius; cy < y + radius; cy++) {
      const distance = Math.sqrt(Math.pow(x - cx, 2) + Math.pow(y - cy, 2));
      if (distance <= radius) {
        cells.push([cx, cy]);
      }
    }
  }
  return cells;
}

function isOceanic(cell) {
  return (
    cell === ETerrainType.OCEAN ||
    cell === ETerrainType.COAST
  );
}

function isContinental(cell) {
  return (
    cell === ETerrainType.LAND ||
    cell === ETerrainType.LAKE ||
    cell === ETerrainType.RIVER ||
    cell === ETerrainType.MOUNTAIN
  );
}

//////

function generateHeightmap(options: IWorldgenOptions) {
  const { seed, size: { width, height } } = options;

  const heightmap = ndarray(new Uint8ClampedArray(width * height), [width, height]);
  const rng = new Alea(seed);
  const simplex = new SimplexNoise(rng);
  const noise = (nx, ny) => simplex.noise2D(nx, ny);
  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);
  const maxDistanceToCenter = 2 * Math.sqrt(Math.pow(width, 2) + Math.pow(width, 2));

  fill(heightmap, (x, y) => {
    // use simplex noise to create random terrain
    const nx = x / width - 0.5;
    const ny = y / height - 0.5;
    let value = (
      0.35 * noise(2.50 * nx, 2.50 * ny) +
      0.30 * noise(5.00 * nx, 5.00 * ny) +
      0.20 * noise(10.0 * nx, 10.0 * ny) +
      0.10 * noise(20.0 * nx, 20.0 * ny) +
      0.05 * noise(40.0 * nx, 40.0 * ny)
    );
    value = (value + 1) / 2;

    // decrease the height of cells farther away from the center to create an island
    const d = (2 * Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2)) / maxDistanceToCenter) / 0.5;
    const a = 0;
    const b = 1.8;
    const c = 2.2;
    value = (value + a) * (1 - b * Math.pow(d, c));
    return value * 255;
  });

  return heightmap;
}

function removeDepressions(options: IWorldgenOptions, heightmap: ndarray) {
  const { size: { width, height } } = options;

  // copy heightmap into waterheight
  const waterheight = ndarray(new Uint8ClampedArray(width * height), [width, height]);
  ops.assign(waterheight, heightmap);

  // priority flood to fill lakes
  const open = new Collections.PriorityQueue((a, b) => {
    if (a[2] < b[2]) {
      return 1;
    } else if (a[2] > b[2]) {
      return -1;
    }
    return 0;
  });
  const pit = new Collections.Queue();

  const closed = ndarray(new Uint8ClampedArray(width * height), [width, height]);
  fill(closed, () => 0);

  // add all edges to the open queue
  // set them as "closed"
  // calculate all cell neighbors
  const cellNeighbors = []
  for (let x = 0; x < width; x++) {
    cellNeighbors[x] = [];
    for (let y = 0; y < height; y++) {
      const neighbors = getNeighborsLabelled(x, y).filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < width && ny < height);
      cellNeighbors[x][y] = neighbors;
      const isEdge = neighbors.length != 4;
      if (isEdge) {
        open.add([x, y, heightmap.get(x, y)]);
        closed.set(x, y, 1);
      }
    }
  }
  let lakeCount = 0;
  while(!open.isEmpty() || !pit.isEmpty()) {
    let cell;
    if (!pit.isEmpty()) {
      cell = pit.dequeue();
    } else {
      cell = open.dequeue();
    }
    const [cx, cy] = cell;

    for (const [nx, ny] of cellNeighbors[cx][cy]) {
      if (closed.get(nx, ny) === 1) continue;
      closed.set(nx, ny, 1);
      if (waterheight.get(nx, ny) <= waterheight.get(cx, cy)) {
        lakeCount++;
        waterheight.set(nx, ny, waterheight.get(cx, cy));
        pit.add([nx, ny, waterheight.get(nx, ny)]);
      } else {
        open.add([nx, ny, waterheight.get(nx, ny)]);
      }
    }
  }
  // console.log('lakeCount', lakeCount);

  return { waterheight, cellNeighbors };
}

function determineFlowDirections(options: IWorldgenOptions, waterheight: ndarray<number>) {
  const { size: { width, height } } = options;

  const flowDirections = ndarray(new Uint8ClampedArray(width * height), [width, height]);
  fill(flowDirections, () => EDirection.NONE);

  const open = new Collections.PriorityQueue<number[]>((a, b) => {
    if (a[2] < b[2]) {
      return 1;
    } else if (a[2] > b[2]) {
      return -1;
    }
    return 0;
  });
  const closed = ndarray(new Uint8ClampedArray(width * height), [width, height]);
  fill(closed, () => 0);

  const cellNeighbors = [];
  for (let x = 0; x < width; x++) {
    cellNeighbors[x] = [];
    for (let y = 0; y < height; y++) {
      const allNeighbors = getNeighborsLabelled(x, y);
      const validNeighbors = allNeighbors.filter(([nx, ny]) => isValidCell(nx, ny, width, height));
      const invalidNeighbors = allNeighbors.filter(([nx, ny]) => !isValidCell(nx, ny, width, height));
      cellNeighbors[x][y] = validNeighbors;
      if (invalidNeighbors.length > 0) { // on the edge of the map
        open.add([x, y, waterheight.get(x, y)]);
        closed.set(x, y, 1);
        flowDirections.set(x, y, invalidNeighbors[0][2]);
      }
    }
  }

  while(!open.isEmpty()) {
    const cell = open.dequeue();
    const [cx, cy] = cell;
    for (const [nx, ny, ndir] of cellNeighbors[cx][cy]) {
      if (closed.get(nx, ny) === 1) continue;
      flowDirections.set(nx, ny, oppositeDirections[ndir]);
      closed.set(nx, ny, 1);
      open.add([nx, ny, waterheight.get(nx, ny)]);
    }
  }

  return flowDirections;
}

function decideTerrainTypes(
  options: IWorldgenOptions,
  sealevel: number,
  heightmap: ndarray,
  waterheight: ndarray,
  flowDirections: ndarray,
  cellNeighbors: [number, number, number][][][],
) {
  const { size: { width, height } } = options;

  // calculate ocean cells by flood fill from the top-left of the map
  // cells which are below sea level and touch the edge of the map are ocean cells
  const seenCells = ndarray(new Int16Array(width * height), [width, height]);
  fill(seenCells, () => 0);

  // inland ocean cells should be considered lakes
  // NOTE: assumes top-left cell of the map is an ocean cell
  const isOcean = ndarray(new Int16Array(width * height), [width, height]);
  fill(isOcean, () => 0);
  const q = new Collections.Queue<[number, number]>();
  isOcean.set(0, 0, 1);
  q.add([0, 0]);
  while (!q.isEmpty()) {
    const [cx, cy] = q.dequeue();
    isOcean.set(cx, cy, 1);

    for (const [nx, ny] of cellNeighbors[cx][cy]) {
      if (heightmap.get(nx, ny) <= sealevel && seenCells.get(nx, ny) === 0) {
        seenCells.set(nx, ny, 1);
        q.add([nx, ny]);
      }
    }
  }

  const isLake = ndarray(new Int16Array(width * height), [width, height]);
  fill(isLake, (x, y) => waterheight.get(x, y) > heightmap.get(x, y));

  const isRiver = ndarray(new Int16Array(width * height), [width, height]);
  fill(isRiver, () => 0);

  const upstreamCells = ndarray(new Int16Array(width * height), [width, height]);
  fill(upstreamCells, () => 0);

  // determine coastal cells by finding all land cells with at least one ocean neighbor
  const coastalCells = [];
  const isCoastalCell = ndarray(new Int16Array(width * height), [width, height]);
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      // cell is coastal if it's a land cell next to lake or ocean
      const isCoastal = (
        (isOcean.get(x, y) === 0 && isLake.get(x, y) === 0) &&
        (cellNeighbors[x][y].some(([nx, ny]) => isOcean.get(nx, ny) === 1) ||
         cellNeighbors[x][y].some(([nx, ny]) => isLake.get(nx, ny) === 1))
      );
      if (isCoastal) {
        coastalCells.push([x, y]);
        isCoastalCell.set(x, y, 1);
      } else {
        isCoastalCell.set(x, y, 0);
      }
    }
  }
  // console.log('coastalCells', coastalCells);

  // determine upstream cell count
  function findUpstreamCount(x, y) {
    let count = 0;
    for (const [nx, ny, ndir] of cellNeighbors[x][y]) {
      const neighborFlowDir: EDirection = flowDirections.get(nx, ny);
      const isUpstream = oppositeDirections[neighborFlowDir] === ndir;
      if (isUpstream) {
        count += 1 + findUpstreamCount(nx, ny);
      }
    }
    upstreamCells.set(x, y, upstreamCells.get(x, y) + count);
    return count;
  }

  for (const [x, y] of coastalCells) {
    findUpstreamCount(x, y);
  }

  const data = Array.from(upstreamCells.data).filter(i => i > 0);
  // const upstreamCellsMax = ops.sup(upstreamCells);
  const riverThreshold = Stats.quantile(data, 0.90);
  console.log('riverThreshold', riverThreshold);

  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const upstreamCount = upstreamCells.get(x, y);
      if (upstreamCount > riverThreshold) {
        isRiver.set(x, y, 1);
      }
    }
  }

  const terrainTypes = ndarray(new Int16Array(width * height), [width, height]);
  let oceanCellCount = 0;
  fill(terrainTypes, (x, y) => {
    if (isOcean.get(x, y)) {
      const waterDepth = sealevel - waterheight.get(x, y);
      oceanCellCount++;
      if (waterDepth < 10) {
        return ETerrainType.COAST;
      }
      return ETerrainType.OCEAN;
    }
    if (isLake.get(x, y) === 1) {
      return ETerrainType.LAKE;
    }
    if (isRiver.get(x, y) === 1) {
      return ETerrainType.RIVER;
    }
    return ETerrainType.LAND;
  });
  console.log('Ocean percent', oceanCellCount / (width * height));
  return { terrainTypes, upstreamCells };
}

function decideDrainageBasins(
  options: IWorldgenOptions,
  cellNeighbors: [number, number, number][][][],
  waterheight: ndarray,
  terrainTypes: ndarray,
) {
  const { seed, size: { width, height } } = options;

  const rng = new Alea(seed);
  const open = new Collections.PriorityQueue<number[]>((a, b) => {
    if (a[2] < b[2]) {
      return 1;
    } else if (a[2] > b[2]) {
      return -1;
    }
    return 0;
  });
  const pit = new Collections.Queue();
  const labels = [];

  let currentLabel = 1;

  for (let x = 0; x < width; x++) {
    labels[x] = [];
    for (let y = 0; y < height; y++) {
      labels[x][y] = undefined; // candidate
      const isEdge = getNeighborsLabelled(x, y)
        .some(([nx, ny]) => !isValidCell(nx, ny, width, height));
      if (isEdge) {
        open.add([x, y, waterheight.get(x, y)]);
        labels[x][y] = null; // queued
      }
    }
  }

  while(!open.isEmpty() || !pit.isEmpty()) {
    let cell;
    if (!pit.isEmpty()) {
      cell = pit.dequeue();
    } else {
      cell = open.dequeue();
    }
    const [cx, cy, z] = cell;
    if (labels[cx][cy] === null) {
      labels[cx][cy] = currentLabel;
      currentLabel++;
    }

    for (const [nx, ny] of cellNeighbors[cx][cy]) {
      if (labels[nx][ny] !== undefined) continue;
      labels[nx][ny] = labels[cx][cy];
      if (waterheight.get(nx, ny) <= z) {
        pit.add([nx, ny, z]);
      } else {
        open.add([nx, ny, waterheight.get(nx, ny)]);
      }
    }
  }

  const drainageBasins: {
    [id: number]: {
      color: number,
      cells: [number, number][],
    }
  } = {};
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      if (isOceanic(terrainTypes.get(x, y))) continue;
      const id: number = labels[x][y];
      if (!(id in drainageBasins)) {
        const red: number = Math.round(rng() * 255);
        const green: number = Math.round(rng() * 255);
        const blue: number = Math.round(rng() * 255);
        drainageBasins[id] = {
          color: (red << 16) + (green << 8) + blue,
          cells: [],
        };
      }
      drainageBasins[id].cells.push([x, y]);
    }
  }

  return drainageBasins;
}

/**
 * Decide temperature of each cell
 *
 * Considerations:
 *    - warmer near the equator
 *    - colder near the poles
 *    - colder at higher elevations
 *    - warmer near shallow waters
 */
function decideTemperature(
  options: IWorldgenOptions,
  sealevel: number,
  waterheight: ndarray
): ndarray {
  const { size: { width, height } } = options;
  const AVG_TEMP = 14; // average global temperature in celcius
  const VOLITILITY = 5; // higher number means greater variation
  const MIN_TEMP = -50; // Math.max(AVG_TEMP - VOLITILITY, BASE_TEMP);

  const latitudeRatio = ndarray(new Float32Array(width * height), [width, height]);
  fill(latitudeRatio, (x, y) => {
    let ratio = y / height;
    if (ratio < 0.5) {
      ratio /= 0.5;
    } else {
      ratio = (1 - ratio) / 0.5;
    }
    return ratio;
  });

  const temperature = ndarray(new Int16Array(width * height), [width, height]);
  const maxAltitude = 255 - sealevel;
  fill(temperature, (x, y) => {
    const ratio = latitudeRatio.get(x, y);
    // radiation is a function of latitude only
    const radiation = (Math.abs(MIN_TEMP) + (AVG_TEMP + VOLITILITY)) * ratio + MIN_TEMP;
    // includes heights
    let part2 = 0;
    const altitude = waterheight.get(x, y) - sealevel;
    if (altitude < 0) { // ocean
      // shallow seas are warmer than deep oceans
      part2 = (1 - (Math.abs(altitude) / sealevel)) * 10;
    } else {
      // higher is colder
      // lower is warmer
      part2 = 10 + (altitude / maxAltitude) * -30;
    }
    return radiation + part2;
  });

  return temperature;
}

function generateMoisture(
  options: IWorldgenOptions,
  heightmap: ndarray,
  sealevel: number,
  terrainTypes: ndarray
): ndarray {
  const { seed, size: { width, height } } = options;
  const rng = new Alea(seed);
  const moistureMap = ndarray(new Int16Array(width * height), [width, height]);
  const simplex = new SimplexNoise(rng);
  fill(moistureMap, (x, y) => {
    if (isContinental(terrainTypes.get(x, y))) {
      const nx = x / width - 0.5;
      const ny = y / height - 0.5;
      const moisture = ((simplex.noise2D(3 * nx, 3 * ny) + 1) / 2);
      const inlandRatio = (heightmap.get(x, y) - sealevel) / (255 - sealevel);
      return (moisture * (1 - inlandRatio)) * 500;
    }
    return 0;
  });
  let cells = [];
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      if (terrainTypes.get(x, y) === ETerrainType.RIVER) {
        const inlandRatio = (heightmap.get(x, y) - sealevel) / (255 - sealevel);
        const riverAdd = (1 - inlandRatio) * 15;
        let size = 15 + Math.round(rng() * 10); // 15 to 25
        cells = loopGridCircle(x, y, size);
        for (const [cx, cy] of cells) {
          moistureMap.set(cx, cy, moistureMap.get(cx, cy) + riverAdd);
        }

        size = 5 + Math.round(rng() * 10); // 5 to 15
        cells = loopGridCircle(x, y, size);
        for (const [cx, cy] of cells) {
          moistureMap.set(cx, cy, moistureMap.get(cx, cy) + (riverAdd * 2));
        }

        size = 5 + Math.round(rng() * 5); // 5 to 10
        cells = loopGridCircle(x, y, size);
        for (const [cx, cy] of cells) {
          moistureMap.set(cx, cy, moistureMap.get(cx, cy) + (riverAdd * 3));
        }
      }
    }
  }
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      if (isOceanic(terrainTypes.get(x, y))) {
        moistureMap.set(x, y, 0);
      }
    }
  }

  return moistureMap;
}

function generateBiomes(
  options: IWorldgenOptions,
  temperatures: ndarray,
  moistureMap: ndarray,
  terrainTypes: ndarray,
): ndarray {
  const { size: { width, height } } = options;
  const biomes = ndarray(new Int16Array(width * height), [width, height]);
  fill(biomes, (x, y) => {
    if (
      terrainTypes.get(x, y,) === ETerrainType.OCEAN ||
      terrainTypes.get(x, y,) === ETerrainType.COAST ||
      terrainTypes.get(x, y,) === ETerrainType.LAKE
    ) {
      return EBiome.NONE;
    }
    const moisture = moistureMap.get(x, y) / 10;
    const temperature = temperatures.get(x, y);
    let moistureZone = null;
    for (const [zone, { start, end }] of Object.entries(moistureZoneRanges)) {
      if (moisture >= start && moisture < end) {
        moistureZone = zone;
      }
    }
    let temperatureZone = null;
    for (const [zone, { start, end }] of Object.entries(temperatureZoneRanges)) {
      if (temperature >= start && temperature < end) {
        temperatureZone = zone;
      }
    }
    if (moistureZone === null) {
      throw new Error(`Failed to find biome for moisture: ${moisture}`);
    }
    if (temperatureZone === null) {
      throw new Error(`Failed to find biome for temperature: ${temperature}`);
    }
    return biomeRanges[moistureZone][temperatureZone];
  });

  return biomes;
}

function decideMountains(
  options: IWorldgenOptions,
  terrainTypes: ndarray,
  waterheight: ndarray,
  sealevel: number
) {
  const { size: { width, height } } = options;
  const maxHeight = ops.sup(waterheight);
  const maxAltitude = maxHeight - sealevel;
  const data = Array.from(waterheight.data).map(value => value - sealevel);
  const mountainThreshold = Stats.quantile(data, .99);

  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const altitude = waterheight.get(x, y) - sealevel;
      if (altitude >= mountainThreshold) {
        terrainTypes.set(x, y, ETerrainType.MOUNTAIN);
      }
    }
  }
}

onmessage = function (event: MessageEvent) {
  const options: IWorldgenOptions = event.data;
  const sealevel = options.sealevel;
  console.time('Worldgen');

  console.time('step: generateHeightmap');
  const heightmap = generateHeightmap(options);
  console.timeEnd('step: generateHeightmap');

  console.time('step: removeDepressions');
  const { waterheight, cellNeighbors } = removeDepressions(options, heightmap);
  console.timeEnd('step: removeDepressions');

  console.time('step: determineFlowDirections');
  const flowDirections = determineFlowDirections(options, waterheight);
  console.timeEnd('step: determineFlowDirections');

  console.time('step: decideTerrainTypes');
  let { terrainTypes, upstreamCells } = decideTerrainTypes(options, sealevel, heightmap, waterheight, flowDirections, cellNeighbors);
  console.timeEnd('step: decideTerrainTypes');

  console.time('step: decideMountains');
  decideMountains(options, terrainTypes, waterheight, sealevel);
  console.timeEnd('step: decideMountains');

  console.time('step: decideDrainageBasins');
  const drainageBasins = decideDrainageBasins(options, cellNeighbors, waterheight, terrainTypes);
  console.timeEnd('step: decideDrainageBasins');

  console.time('step: decideTemperature');
  const temperatures = decideTemperature(options, sealevel, waterheight);
  console.timeEnd('step: decideTemperature');

  console.time('step: generateMoisture');
  const moistureMap = generateMoisture(options, heightmap, sealevel, terrainTypes);
  console.timeEnd('step: generateMoisture');

  console.time('step: generateBiomes');
  const biomes = generateBiomes(options, temperatures, moistureMap, terrainTypes);
  console.timeEnd('step: generateBiomes');


  console.log('upstreamCells', ndarrayStats(upstreamCells));
  console.log('moistureMap', ndarrayStats(moistureMap));
  console.log('temperatures', ndarrayStats(temperatures));
  console.log('biomes', countUnique(biomes));
  console.timeEnd('Worldgen');

  const output: IWorldgenWorkerOutput = {
    options,
    sealevel,
    heightmap: heightmap.data,
    flowDirections: flowDirections.data,
    terrainTypes: terrainTypes.data,
    drainageBasins,
    upstreamCells: upstreamCells.data,
    temperatures: temperatures.data,
    moistureMap: moistureMap.data,
    biomes: biomes.data,
  };
  (postMessage as any)(output);
}
