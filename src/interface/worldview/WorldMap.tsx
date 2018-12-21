import React from 'react';
import * as PIXI from 'pixi.js';
import { IWorldCell } from '../../simulation/worldTypes';
import World from "../../simulation/World";
import { EMapMode, MapModeMap } from './mapModes';
import WorldRenderer from './WorldRenderer';


export interface IViewOptions {
  showFlowArrows: boolean;
  mapMode: EMapMode;
  drawCoastline: boolean;
  drawGrid: boolean;
  showCursor: boolean;
}

export interface IWorldMapProps {
  world: World,
  viewOptions: IViewOptions;
  mapModes: MapModeMap;
  selectedCell: IWorldCell | null;
  onCellClick: (cell: IWorldCell) => void;
}

export class WorldMap extends React.Component<IWorldMapProps> {
  root: React.RefObject<HTMLDivElement>;
  arrowTexture: PIXI.Texture;
  renderer: WorldRenderer;

  constructor(props) {
    super(props);
    this.root = React.createRef();
  }

  componentDidMount() {
    this.renderer = new WorldRenderer({
      world: this.props.world,
      element: this.root.current,
      mapModes: this.props.mapModes,
      eventCallbacks: {
        onCellClick: this.props.onCellClick,
      }
    });
    console.log(this.renderer);

    // add pixi to the DOM
    this.root.current.appendChild(this.renderer.app.view);

    // directly manipulate the PIXI objects when state changes
    this.updateView(this.props);
  }

  shouldComponentUpdate(nextProps) {
    if (nextProps.selectedCell !== this.props.selectedCell) {
      console.log('select', nextProps.selectedCell);
      this.selectCell(nextProps.selectedCell);
    }
    if (nextProps.world != this.props.world) {
      console.log('update WorldViewer', this.props.world);
      this.renderer = new WorldRenderer({
        world: nextProps.world,
        element: this.root.current,
        mapModes: this.props.mapModes,
        eventCallbacks: {
          onCellClick: this.props.onCellClick,
        }
      });
      this.updateView(this.props);
    }
    this.updateView(nextProps);
    return false;
  }

  updateView(props: IWorldMapProps) {
    this.renderer.onStateChange(props);
  }

  componentWillUnmount() {
    this.renderer.destroy();
  }

  selectCell(cell: IWorldCell) {
    if (cell === null) {
      this.renderer.worldUI.children.selectedCursor.alpha = 0;
    } else {
      this.renderer.worldUI.children.selectedCursor.alpha = 1;
      this.renderer.worldUI.children.selectedCursor.position.set(
        cell.x * this.renderer.options.cellWidth,
        cell.y * this.renderer.options.cellHeight,
      );
    }
  }

  render() {
    return <div id="worldviewer" ref={this.root} />;
  }
}
