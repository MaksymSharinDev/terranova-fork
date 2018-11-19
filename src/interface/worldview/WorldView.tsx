import React, { Component } from 'react';
import { WorldGenerator, worldStore } from '../../simulation';
import World from "../../simulation/World";
import { RouteComponentProps } from 'react-router'
import {
  Spinner, NavbarGroup, Alignment, NavbarHeading, NavbarDivider
} from '@blueprintjs/core';
import WorldViewer from './WorldViewer';
import BackButton from '../components/BackButton';


export class WorldView extends Component<RouteComponentProps<{
  saveName: string
}>, { world?: World }> {
  worldgen: WorldGenerator;

  state = {
    world: null,
  }

  constructor(props) {
    super(props);

    this.worldgen = new WorldGenerator();
    this.load();
  }

  async load() {
    const { saveName } = this.props.match.params;
    const world: World = await worldStore.load(saveName);
    console.log('World loaded', world);
    this.setState({ world });
  }

  render() {
    if (this.state.world === null) {
      return <Spinner/>;
    }
    return (
      <WorldViewer
        renderControls={() => [
          <NavbarGroup align={Alignment.LEFT}>
            <BackButton />
            <NavbarDivider />
            <NavbarHeading>World Viewer</NavbarHeading>
          </NavbarGroup>
        ]}
        world={this.state.world}
        isLoading={this.state.world === null}
      />
    );
  }
}