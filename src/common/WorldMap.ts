import { IWorldRegionView } from '../simulation/WorldRegion';
import World from "../simulation/World";
import Array2D from "../utils/Array2D";
import { Subject, ReplaySubject } from 'rxjs';


export class WorldMap {
  world: World;
  regionMap: Map<string, IWorldRegionView>;
  cellRegionMap: Array2D<string>;
  cellRegionUpdate$: Array2D<ReplaySubject<string>>;

  constructor(world: World) {
    this.world = world;
    this.regionMap = new Map();
    this.cellRegionMap = new Array2D(this.world.size.width, this.world.size.height);
    this.cellRegionUpdate$ = new Array2D(
      this.world.size.width,
      this.world.size.height,
      (x, y) => new ReplaySubject<string>(),
    );
  }

  addRegion(region: IWorldRegionView) {
    this.regionMap.set(region.name, region);

    for (const cell of region.cells) {
      this.cellRegionMap.set(cell.x, cell.y, region.name);
      this.cellRegionUpdate$.get(cell.x, cell.y).next(region.name)
    }
  }
}
