import React, { Component } from 'react';
import { Simulation } from '../../simulation';
import World from '../../simulation/world';
import { RouteComponentProps } from 'react-router'
import {
  Spinner, NavbarGroup, Alignment, NavbarHeading, NavbarDivider
} from '@blueprintjs/core';
import { WorldViewerContainer } from '../components/WorldViewerContainer';
import BackButton from '../components/BackButton';


export class LoadWorldView extends Component<RouteComponentProps<{
  saveName: string
}>, { world?: World }> {
  simulation: Simulation;

  state = {
    world: null,
  }

  constructor(props) {
    super(props);

    this.simulation = new Simulation();
    this.load();
  }

  async load() {
    const { saveName } = this.props.match.params;
    const world = await this.simulation.loadWorld(saveName);
    console.log('World loaded', world);
    this.setState({ world });
  }



  render() {
    if (this.state.world === null) {
      return <Spinner/>;
    }
    return (
      <WorldViewerContainer
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
