import { StrykerOptions } from '@stryker-mutator/api/core';

import Preset from './preset';
import PresetConfiguration from './preset-configuration';

const guideUrl = 'https://stryker-mutator.io/docs/stryker/guides/react';

/**
 * More information can be found in the Stryker handbook:
 * https://stryker-mutator.io/docs/stryker/guides/react
 */
export class ReactPreset implements Preset {
  public readonly name = 'create-react-app';
  private readonly dependencies = ['@stryker-mutator/jest-runner'];

  private readonly config: Partial<StrykerOptions> = {
    testRunner: 'jest',
    reporters: ['progress', 'clear-text', 'html'],
    coverageAnalysis: 'off',
    jest: {
      projectType: 'create-react-app',
    },
  };

  public async createConfig(): Promise<PresetConfiguration> {
    return { config: this.config, guideUrl, dependencies: this.dependencies };
  }
}
