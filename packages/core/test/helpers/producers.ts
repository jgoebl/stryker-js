import { CpuInfo } from 'os';
import type { Dirent } from 'fs';

import { ClearTextReporterOptions } from '@stryker-mutator/api/core';
import { Logger } from 'log4js';
import sinon from 'sinon';
import { ReplaySubject } from 'rxjs';
import { TestRunner } from '@stryker-mutator/api/test-runner';
import { I } from '@stryker-mutator/util';

import { Pool, ConcurrencyTokenProvider } from '../../src/concurrent/index.js';
import { CheckerFacade } from '../../src/checker/index.js';
import { FileSystem } from '../../src/fs/file-system.js';
import { TSConfig } from '../../src/sandbox/ts-config-preprocessor.js';

export type Mutable<T> = {
  -readonly [K in keyof T]: T[K];
};

export type Mock<T> = Mutable<sinon.SinonStubbedInstance<T>>;

export function mock<T>(constructorFn: sinon.StubbableType<T>): Mock<T> {
  return sinon.createStubInstance(constructorFn);
}

export function createFileSystemMock(): sinon.SinonStubbedInstance<FileSystem> {
  return {
    copyFile: sinon.stub(),
    readFile: sinon.stub(),
    dispose: sinon.stub(),
    mkdir: sinon.stub(),
    writeFile: sinon.stub(),
    readdir: sinon.stub(),
  } as sinon.SinonStubbedInstance<FileSystem>;
}

/**
 * Use this factory method to create deep test data
 * */
function factoryMethod<T>(defaultsFactory: () => T) {
  return (overrides?: Partial<T>) => Object.assign({}, defaultsFactory(), overrides);
}

export const createClearTextReporterOptions = factoryMethod<ClearTextReporterOptions>(() => ({
  allowColor: true,
  logTests: true,
  maxTestsToLog: 3,
}));

export type ConcurrencyTokenProviderMock = sinon.SinonStubbedInstance<I<ConcurrencyTokenProvider>> & {
  testRunnerToken$: ReplaySubject<number>;
  checkerToken$: ReplaySubject<number>;
};

export function createConcurrencyTokenProviderMock(): ConcurrencyTokenProviderMock {
  return {
    checkerToken$: new ReplaySubject(),
    testRunnerToken$: new ReplaySubject(),
    dispose: sinon.stub(),
    freeCheckers: sinon.stub(),
  };
}

export function createTestRunnerPoolMock(): sinon.SinonStubbedInstance<I<Pool<TestRunner>>> {
  return {
    dispose: sinon.stub(),
    init: sinon.stub(),
    schedule: sinon.stub<any>(),
  };
}

export function createCheckerPoolMock(): sinon.SinonStubbedInstance<I<Pool<I<CheckerFacade>>>> {
  return {
    dispose: sinon.stub(),
    init: sinon.stub(),
    schedule: sinon.stub<any>(),
  };
}

export const logger = (): sinon.SinonStubbedInstance<Logger> => {
  return {
    category: 'foo-category',
    _log: sinon.stub(),
    addContext: sinon.stub(),
    clearContext: sinon.stub(),
    debug: sinon.stub(),
    error: sinon.stub(),
    fatal: sinon.stub(),
    info: sinon.stub(),
    isDebugEnabled: sinon.stub(),
    isErrorEnabled: sinon.stub(),
    isFatalEnabled: sinon.stub(),
    isInfoEnabled: sinon.stub(),
    isLevelEnabled: sinon.stub(),
    isTraceEnabled: sinon.stub(),
    isWarnEnabled: sinon.stub(),
    level: 'level',
    log: sinon.stub(),
    mark: sinon.stub(),
    removeContext: sinon.stub(),
    setParseCallStackFunction: sinon.stub(),
    trace: sinon.stub(),
    warn: sinon.stub(),
  } as sinon.SinonStubbedInstance<Logger>;
};

export function createCpuInfo(overrides?: Partial<CpuInfo>): CpuInfo {
  return {
    model: 'x86',
    speed: 20000,
    times: {
      user: 0,
      nice: 0,
      sys: 0,
      idle: 0,
      irq: 0,
    },
    ...overrides,
  };
}

export function serializeTSConfig(content: TSConfig): string {
  return JSON.stringify(content, null, 2);
}

interface CreateDirentOptions {
  name: string;
  isDirectory: boolean;
}
export function createDirent(overrides?: Partial<CreateDirentOptions>): Dirent {
  const { name, isDirectory } = {
    name: 'foo',
    isDirectory: true,
    ...overrides,
  };
  const dummy = () => true;
  return {
    isBlockDevice: dummy,
    isCharacterDevice: dummy,
    isDirectory: () => isDirectory,
    isFIFO: dummy,
    isFile: () => !isDirectory,
    isSocket: dummy,
    isSymbolicLink: dummy,
    name,
  };
}
