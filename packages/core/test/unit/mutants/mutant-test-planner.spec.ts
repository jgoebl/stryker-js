import path from 'path';

import sinon from 'sinon';
import { expect } from 'chai';
import { factory, testInjector } from '@stryker-mutator/test-helpers';
import { CompleteDryRunResult } from '@stryker-mutator/api/test-runner';
import { MutantEarlyResultPlan, MutantRunPlan, MutantTestPlan, PlanKind, Mutant, MutantStatus } from '@stryker-mutator/api/core';
import { Reporter } from '@stryker-mutator/api/report';
import { MutationTestResult } from 'mutation-testing-report-schema/api';

import { MutantTestPlanner } from '../../../src/mutants/mutant-test-planner.js';
import { coreTokens } from '../../../src/di/index.js';
import { Sandbox } from '../../../src/sandbox/index.js';
import { Project } from '../../../src/fs/index.js';
import { FileSystemTestDouble } from '../../helpers/file-system-test-double.js';
import { createMutant } from '../../helpers/producers.js';

const TIME_OVERHEAD_MS = 501;

describe(MutantTestPlanner.name, () => {
  let reporterMock: sinon.SinonStubbedInstance<Required<Reporter>>;
  let sandboxMock: sinon.SinonStubbedInstance<Sandbox>;
  let fileSystemTestDouble: FileSystemTestDouble;

  beforeEach(() => {
    reporterMock = factory.reporter();
    sandboxMock = sinon.createStubInstance(Sandbox);
    sandboxMock.sandboxFileFor.returns('sandbox/foo.js');
    fileSystemTestDouble = new FileSystemTestDouble();
  });

  function act(
    dryRunResult: CompleteDryRunResult,
    mutants: Mutant[],
    project = new Project(fileSystemTestDouble, fileSystemTestDouble.toFileDescriptions())
  ) {
    return testInjector.injector
      .provideValue(coreTokens.reporter, reporterMock)
      .provideValue(coreTokens.dryRunResult, dryRunResult)
      .provideValue(coreTokens.mutants, mutants)
      .provideValue(coreTokens.sandbox, sandboxMock)
      .provideValue(coreTokens.project, project)
      .provideValue(coreTokens.timeOverheadMS, TIME_OVERHEAD_MS)
      .injectClass(MutantTestPlanner)
      .makePlan(mutants);
  }

  it('should make an early result plan for an ignored mutant', async () => {
    const mutant = factory.mutant({ id: '2', status: MutantStatus.Ignored, statusReason: 'foo should ignore' });
    const dryRunResult = factory.completeDryRunResult({ mutantCoverage: { static: {}, perTest: { '1': { 2: 2 } } } });

    // Act
    const result = await act(dryRunResult, [mutant]);

    // Assert
    const expected: MutantEarlyResultPlan[] = [
      { plan: PlanKind.EarlyResult, mutant: { ...mutant, static: false, status: MutantStatus.Ignored, coveredBy: undefined } },
    ];
    expect(result).deep.eq(expected);
  });

  it('should make a plan with an empty test filter for a mutant without coverage', async () => {
    // Arrange
    const mutant = factory.mutant({ id: '3' });
    const dryRunResult = factory.completeDryRunResult({ mutantCoverage: { static: {}, perTest: { '1': { 2: 2 } } } });

    // Act
    const [result] = await act(dryRunResult, [mutant]);

    // Assert
    assertIsRunPlan(result);
    expect(result.mutant.coveredBy).lengthOf(0);
    expect(result.runOptions.testFilter).lengthOf(0);
    expect(result.mutant.static).false;
  });

  it('should provide the sandboxFileName', async () => {
    // Arrange
    const mutant = factory.mutant({ id: '3', fileName: 'file.js' });
    const dryRunResult = factory.completeDryRunResult({ mutantCoverage: { static: {}, perTest: { '1': { 2: 2 } } } });

    // Act
    const [result] = await act(dryRunResult, [mutant]);

    // Assert
    assertIsRunPlan(result);
    expect(result.runOptions.sandboxFileName).eq('sandbox/foo.js');
    expect(sandboxMock.sandboxFileFor).calledWith('file.js');
  });

  it('should pass disableBail in the runOptions', async () => {
    const mutant = factory.mutant({ id: '3', fileName: 'file.js' });
    const dryRunResult = factory.completeDryRunResult({ mutantCoverage: { static: {}, perTest: { '1': { 2: 2 } } } });
    testInjector.options.disableBail = true;

    // Act
    const [result] = await act(dryRunResult, [mutant]);

    // Assert
    assertIsRunPlan(result);
    expect(result.runOptions.disableBail).true;
  });

  it('should report onMutationTestingPlanReady', async () => {
    // Arrange
    const mutants = [
      factory.mutant({
        id: '1',
        fileName: 'foo.js',
        mutatorName: 'fooMutator',
        replacement: '<=',
        location: { start: { line: 0, column: 0 }, end: { line: 0, column: 1 } },
      }),
      factory.mutant({
        id: '2',
        fileName: 'bar.js',
        mutatorName: 'barMutator',
        replacement: '{}',
        location: { start: { line: 0, column: 2 }, end: { line: 0, column: 3 } },
      }),
    ];
    const dryRunResult = factory.completeDryRunResult({
      tests: [factory.successTestResult({ timeSpentMs: 20 }), factory.successTestResult({ timeSpentMs: 22 })],
      mutantCoverage: undefined,
    });

    // Act
    const mutantPlans = await act(dryRunResult, mutants);

    // Assert
    sinon.assert.calledOnceWithExactly(reporterMock.onMutationTestingPlanReady, { mutantPlans });
  });

  describe('coverage', () => {
    describe('without mutant coverage data', () => {
      it('should disable the test filter', async () => {
        // Arrange
        const mutant1 = factory.mutant({ id: '1' });
        const mutant2 = factory.mutant({ id: '2' });
        const mutants = [mutant1, mutant2];
        const dryRunResult = factory.completeDryRunResult({ mutantCoverage: undefined });

        // Act
        const [plan1, plan2] = await act(dryRunResult, mutants);

        // Assert
        assertIsRunPlan(plan1);
        assertIsRunPlan(plan2);
        expect(plan1.runOptions.testFilter).undefined;
        expect(plan1.mutant.coveredBy).undefined;
        expect(plan1.mutant.static).undefined;
        expect(plan2.runOptions.testFilter).undefined;
        expect(plan2.mutant.coveredBy).undefined;
        expect(plan2.mutant.static).undefined;
      });

      it('should disable the hitLimit', async () => {
        // Arrange
        const mutants = [factory.mutant({ id: '1' })];
        const dryRunResult = factory.completeDryRunResult({ mutantCoverage: undefined });

        // Act
        const [result] = await act(dryRunResult, mutants);

        // Assert
        assertIsRunPlan(result);
        expect(result.runOptions.hitLimit).undefined;
      });

      it('should calculate timeout and net time using the sum of all tests', async () => {
        // Arrange
        const mutant1 = factory.mutant({ id: '1' });
        const mutants = [mutant1];
        const dryRunResult = factory.completeDryRunResult({
          tests: [factory.successTestResult({ timeSpentMs: 20 }), factory.successTestResult({ timeSpentMs: 22 })],
          mutantCoverage: undefined,
        });

        // Act
        const [result] = await act(dryRunResult, mutants);

        // Assert
        assertIsRunPlan(result);
        expect(result.runOptions.timeout).eq(calculateTimeout(42));
        expect(result.netTime).eq(42);
      });
    });

    describe('with static coverage', () => {
      it('should ignore when ignoreStatic is enabled', async () => {
        // Arrange
        testInjector.options.ignoreStatic = true;
        const mutant = factory.mutant({ id: '1' });
        const mutants = [mutant];
        const dryRunResult = factory.completeDryRunResult({
          tests: [factory.successTestResult({ id: 'spec1', timeSpentMs: 0 })],
          mutantCoverage: { static: { 1: 1 }, perTest: {} },
        });

        // Act
        const result = await act(dryRunResult, mutants);

        // Assert
        const expected: MutantTestPlan[] = [
          {
            plan: PlanKind.EarlyResult,
            mutant: {
              ...mutant,
              status: MutantStatus.Ignored,
              statusReason: 'Static mutant (and "ignoreStatic" was enabled)',
              static: true,
              coveredBy: [],
            },
          },
        ];
        expect(result).deep.eq(expected);
      });

      it('should disable test filtering, set reload environment and activate mutant statically when ignoreStatic is disabled', async () => {
        // Arrange
        testInjector.options.ignoreStatic = false;
        const mutants = [factory.mutant({ id: '1' })];
        const dryRunResult = factory.completeDryRunResult({
          tests: [factory.successTestResult({ id: 'spec1', timeSpentMs: 0 })],
          mutantCoverage: { static: { 1: 1 }, perTest: {} },
        });

        // Act
        const [result] = await act(dryRunResult, mutants);

        // Assert
        assertIsRunPlan(result);
        expect(result.mutant.coveredBy).lengthOf(0);
        expect(result.mutant.static).true;
        expect(result.runOptions.reloadEnvironment).true;
        expect(result.runOptions.testFilter).undefined;
        expect(result.runOptions.mutantActivation).eq('static');
      });

      it('should set activeMutant on the runOptions', async () => {
        // Arrange
        const mutants = [Object.freeze(factory.mutant({ id: '1' }))];
        const dryRunResult = factory.completeDryRunResult({ tests: [factory.successTestResult({ id: 'spec1', timeSpentMs: 0 })] });

        // Act
        const [result] = await act(dryRunResult, mutants);

        // Assert
        assertIsRunPlan(result);
        expect(result.runOptions.activeMutant).deep.eq(mutants[0]);
      });

      it('should calculate the hitLimit based on total hits (perTest and static)', async () => {
        // Arrange
        const mutant = factory.mutant({ id: '1' });
        const mutants = [mutant];
        const dryRunResult = factory.completeDryRunResult({
          tests: [factory.successTestResult({ id: 'spec1', timeSpentMs: 0 })],
          mutantCoverage: { static: { 1: 1 }, perTest: { 1: { 1: 2, 2: 100 }, 2: { 2: 100 }, 3: { 1: 3 } } },
        });

        // Act
        const [result] = await act(dryRunResult, mutants);

        // Assert
        assertIsRunPlan(result);
        expect(result.runOptions.hitLimit).deep.eq(600);
      });

      it('should calculate timeout and net time using the sum of all tests', async () => {
        // Arrange
        const mutant = factory.mutant({ id: '1' });
        const mutants = [mutant];
        const dryRunResult = factory.completeDryRunResult({
          tests: [factory.successTestResult({ id: 'spec1', timeSpentMs: 20 }), factory.successTestResult({ id: 'spec1', timeSpentMs: 22 })],
          mutantCoverage: { static: { 1: 1 }, perTest: {} },
        });

        // Act
        const [result] = await act(dryRunResult, mutants);

        // Assert
        assertIsRunPlan(result);
        expect(result.runOptions.timeout).eq(calculateTimeout(42));
        expect(result.netTime).eq(42);
      });
    });

    describe('with hybrid coverage', () => {
      it('should set the testFilter, coveredBy, static and runtime mutant activation when ignoreStatic is enabled', async () => {
        // Arrange
        testInjector.options.ignoreStatic = true;
        const mutants = [factory.mutant({ id: '1' })];
        const dryRunResult = factory.completeDryRunResult({
          tests: [factory.successTestResult({ id: 'spec1', timeSpentMs: 10 })],
          mutantCoverage: { static: { 1: 1 }, perTest: { spec1: { 1: 1 } } },
        });

        // Act
        const [result] = await act(dryRunResult, mutants);

        // Assert
        assertIsRunPlan(result);
        const { mutant, runOptions } = result;
        expect(mutant.coveredBy).deep.eq(['spec1']);
        expect(mutant.static).deep.eq(true);
        expect(runOptions.testFilter).deep.eq(['spec1']);
        expect(result.runOptions.mutantActivation).eq('runtime');
      });

      it('should disable test filtering and statically activate the mutant, yet still set coveredBy and static when ignoreStatic is false', async () => {
        // Arrange
        testInjector.options.ignoreStatic = false;
        const mutants = [factory.mutant({ id: '1' })];
        const dryRunResult = factory.completeDryRunResult({
          tests: [factory.successTestResult({ id: 'spec1', timeSpentMs: 10 }), factory.successTestResult({ id: 'spec2', timeSpentMs: 20 })],
          mutantCoverage: { static: { 1: 1 }, perTest: { spec1: { 1: 1 } } },
        });

        // Act
        const [result] = await act(dryRunResult, mutants);

        // Assert
        assertIsRunPlan(result);
        const { mutant, runOptions } = result;
        expect(mutant.coveredBy).deep.eq(['spec1']);
        expect(mutant.static).deep.eq(true);
        expect(runOptions.testFilter).deep.eq(undefined);
        expect(result.runOptions.mutantActivation).eq('static');
      });
    });

    describe('with perTest coverage', () => {
      it('should enable test filtering with runtime mutant activation for covered tests', async () => {
        // Arrange
        const mutants = [factory.mutant({ id: '1' }), factory.mutant({ id: '2' })];
        const dryRunResult = factory.completeDryRunResult({
          tests: [factory.successTestResult({ id: 'spec1', timeSpentMs: 0 }), factory.successTestResult({ id: 'spec2', timeSpentMs: 0 })],
          mutantCoverage: { static: { 1: 0 }, perTest: { spec1: { 1: 1 }, spec2: { 1: 0, 2: 1 } } },
        });

        // Act
        const [plan1, plan2] = await act(dryRunResult, mutants);

        // Assert
        assertIsRunPlan(plan1);
        assertIsRunPlan(plan2);
        const { runOptions: runOptions1, mutant: mutant1 } = plan1;
        const { runOptions: runOptions2, mutant: mutant2 } = plan2;
        expect(runOptions1.testFilter).deep.eq(['spec1']);
        expect(runOptions1.mutantActivation).eq('runtime');
        expect(mutant1.coveredBy).deep.eq(['spec1']);
        expect(mutant1.static).false;
        expect(runOptions2.testFilter).deep.eq(['spec2']);
        expect(runOptions2.mutantActivation).eq('runtime');
        expect(mutant2.coveredBy).deep.eq(['spec2']);
        expect(mutant2.static).false;
      });

      it('should calculate timeout and net time using the sum of covered tests', async () => {
        // Arrange
        const mutants = [factory.mutant({ id: '1' }), factory.mutant({ id: '2' })];
        const dryRunResult = factory.completeDryRunResult({
          tests: [
            factory.successTestResult({ id: 'spec1', timeSpentMs: 20 }),
            factory.successTestResult({ id: 'spec2', timeSpentMs: 10 }),
            factory.successTestResult({ id: 'spec3', timeSpentMs: 22 }),
          ],
          mutantCoverage: { static: { 1: 0 }, perTest: { spec1: { 1: 1 }, spec2: { 1: 0, 2: 1 }, spec3: { 1: 2 } } },
        });

        // Act
        const [plan1, plan2] = await act(dryRunResult, mutants);

        // Assert
        assertIsRunPlan(plan1);
        assertIsRunPlan(plan2);
        expect(plan1.netTime).eq(42); // spec1 + spec3
        expect(plan2.netTime).eq(10); // spec2
        expect(plan1.runOptions.timeout).eq(calculateTimeout(42)); // spec1 + spec3
        expect(plan2.runOptions.timeout).eq(calculateTimeout(10)); // spec2
      });

      it('should allow for non-existing tests (#2485)', async () => {
        // Arrange
        const mutant1 = factory.mutant({ id: '1' });
        const mutant2 = factory.mutant({ id: '2' });
        const mutants = [mutant1, mutant2];
        const dryRunResult = factory.completeDryRunResult({
          tests: [factory.successTestResult({ id: 'spec1', timeSpentMs: 20 })], // test result for spec2 is missing
          mutantCoverage: { static: {}, perTest: { spec1: { 1: 1 }, spec2: { 1: 0, 2: 1 } } },
        });

        // Act
        const actualMatches = await act(dryRunResult, mutants);

        // Assert
        expect(actualMatches.find(({ mutant }) => mutant.id === '1')?.mutant.coveredBy).deep.eq(['spec1']);
        expect(actualMatches.find(({ mutant }) => mutant.id === '2')?.mutant.coveredBy).lengthOf(0);
        expect(testInjector.logger.warn).calledWith(
          'Found test with id "spec2" in coverage data, but not in the test results of the dry run. Not taking coverage data for this test into account.'
        );
      });
    });
  });

  describe.only('incrementalDiff', () => {
    const srcAdd = 'src/add.js';
    const srcMultiply = 'src/multiply.js';
    const testAdd = 'test/add.spec.js';
    const testMultiply = 'test/multiply.spec.js';
    let incrementalReport: MutationTestResult;
    let mutants: Mutant[];
    let project: Project;
    let dryRunResult: CompleteDryRunResult;

    beforeEach(() => {
      incrementalReport = factory.mutationTestReportSchemaMutationTestResult({
        files: {
          [srcAdd]: factory.mutationTestReportSchemaFileResult({
            mutants: [
              factory.mutationTestReportSchemaMutantResult({
                id: '1',
                coveredBy: ['1'],
                killedBy: ['1'],
                replacement: '-',
                mutatorName: 'min-replacement',
                status: MutantStatus.Killed,
                location: { start: { line: 3, column: 25 }, end: { line: 3, column: 26 } },
              }),
            ],
            source: `
            export function add(a, b) {
              return a + b;
            }            
            `,
          }),
          [srcMultiply]: factory.mutationTestReportSchemaFileResult({
            mutants: [
              factory.mutationTestReportSchemaMutantResult({
                id: '2',
                coveredBy: ['2'],
                killedBy: ['2'],
                replacement: '/',
                mutatorName: 'divide-replacement',
                status: MutantStatus.Killed,
                location: { start: { line: 3, column: 25 }, end: { line: 3, column: 26 } },
              }),
            ],
            source: `
            export function multiply(a, b) {
              return a * b;
            }`,
          }),
        },
        testFiles: {
          [testAdd]: factory.mutationTestReportSchemaTestFile({
            source: `
            import { expect } from 'chai';
            import { add } from '../src/add.js';

            describe('add' () => {
              it('should result in 42 for 2 and 40', () => {
                expect(add(40, 2)).eq(42);
              });
            });
            `,
            tests: [
              factory.mutationTestReportSchemaTestDefinition({
                id: '1',
                name: 'add should result in 42 for 2 and 40',
                location: { start: { line: 6, column: 14 } },
              }),
            ],
          }),
          [testMultiply]: factory.mutationTestReportSchemaTestFile({
            source: `
            import { expect } from 'chai';
            import { multiply } from '../src/multiply.js';

            describe('multiply' () => {
              it('should result in 42 for 21 and 2', () => {
                expect(multiply(21, 2)).eq(42);
              });
            });
            `,
            tests: [
              factory.mutationTestReportSchemaTestDefinition({
                id: '2',
                name: 'multiply should result in 42 for 21 and 2',
                location: { start: { line: 6, column: 14 } },
              }),
            ],
          }),
        },
      });
      fileSystemTestDouble.files[srcAdd] = incrementalReport.files[srcAdd].source;
      fileSystemTestDouble.files[srcMultiply] = incrementalReport.files[srcMultiply].source;
      fileSystemTestDouble.files[testAdd] = incrementalReport.testFiles![testAdd].source!;
      fileSystemTestDouble.files[testMultiply] = incrementalReport.testFiles![testMultiply].source!;
      project = new Project(fileSystemTestDouble, fileSystemTestDouble.toFileDescriptions(), incrementalReport);
      mutants = [
        createMutant({
          id: '1',
          replacement: '-',
          mutatorName: 'min-replacement',
          location: { start: { line: 3, column: 25 }, end: { line: 3, column: 26 } },
        }),
        createMutant({
          id: '2',
          replacement: '/',
          mutatorName: 'divide-replacement',
          status: MutantStatus.Killed,
          location: { start: { line: 3, column: 25 }, end: { line: 3, column: 26 } },
        }),
      ];
      dryRunResult = factory.completeDryRunResult({
        tests: [
          factory.testResult({
            id: '1',
            name: 'add should result in 42 for 2 and 40',
            fileName: path.resolve(testAdd),
          }),
          factory.testResult({
            id: '2',
            name: 'multiply should result in 42 for 21 and 2',
            fileName: path.resolve(testMultiply),
          }),
        ],
      });
    });

    it('should reuse all results if there is no difference', async () => {
      const plans = await act(dryRunResult, mutants, project);
      const expectedPlans: MutantEarlyResultPlan[] = [
        factory.mutantEarlyResultPlan({
          mutant: {
            ...incrementalReport.files[srcAdd].mutants[0],
            fileName: mutants[0].fileName,
            replacement: mutants[0].replacement,
          },
        }),
        factory.mutantEarlyResultPlan({
          mutant: {
            ...incrementalReport.files[srcMultiply].mutants[0],
            fileName: mutants[1].fileName,
            replacement: mutants[1].replacement,
          },
        }),
      ];
      expect(plans).deep.eq(expectedPlans);
    });
  });

  describe('static mutants warning', () => {
    function arrangeStaticWarning() {
      const mutants = [
        factory.mutant({ id: '1' }),
        factory.mutant({ id: '2' }),
        factory.mutant({ id: '3' }),
        factory.mutant({ id: '4' }), // static
        factory.mutant({ id: '8' }),
        factory.mutant({ id: '9' }),
        factory.mutant({ id: '10' }),
      ];
      const dryRunResult = factory.completeDryRunResult({
        tests: [
          factory.successTestResult({ id: 'spec1', timeSpentMs: 10 }),
          factory.successTestResult({ id: 'spec2', timeSpentMs: 10 }),
          factory.successTestResult({ id: 'spec3', timeSpentMs: 10 }),
          factory.successTestResult({ id: 'spec4', timeSpentMs: 10 }),
        ],
        mutantCoverage: { static: { 4: 1, 5: 1, 6: 1, 7: 1 }, perTest: { spec1: { 1: 1 }, spec2: { 2: 1, 10: 1 }, spec3: { 3: 1, 8: 1, 9: 1 } } },
      });
      return { mutants, dryRunResult };
    }

    it('should warn when the estimated time to run all static mutants exceeds 40% and the performance impact of a static mutant is estimated to be twice that of other mutants', async () => {
      // Arrange
      testInjector.options.ignoreStatic = false;
      const { mutants, dryRunResult } = arrangeStaticWarning();

      // Act
      await act(dryRunResult, mutants);

      // Assert
      expect(testInjector.logger.warn)
        .calledWithMatch('Detected 1 static mutants (14% of total) that are estimated to take 40% of the time running the tests!')
        .and.calledWithMatch('(disable "warnings.slow" to ignore this warning)');
    });

    it('should not warn when ignore static is enabled', async () => {
      // Arrange
      testInjector.options.ignoreStatic = true;
      const { mutants, dryRunResult } = arrangeStaticWarning();

      // Act
      await act(dryRunResult, mutants);

      // Assert
      expect(testInjector.logger.warn).not.called;
    });

    it('should not warn when "warning.slow" is disabled', async () => {
      // Arrange
      testInjector.options.ignoreStatic = false;
      testInjector.options.warnings = factory.warningOptions({ slow: false });
      const { mutants, dryRunResult } = arrangeStaticWarning();

      // Act
      await act(dryRunResult, mutants);

      // Assert
      expect(testInjector.logger.warn).not.called;
    });

    it('should not warn when all static mutants is not estimated to exceed 40%', async () => {
      // Arrange
      const mutants = [
        factory.mutant({ id: '1' }),
        factory.mutant({ id: '2' }),
        factory.mutant({ id: '3' }),
        factory.mutant({ id: '4' }), // static
        factory.mutant({ id: '8' }),
        factory.mutant({ id: '9' }),
        factory.mutant({ id: '10' }),
      ];
      const dryRunResult = factory.completeDryRunResult({
        tests: [
          factory.successTestResult({ id: 'spec1', timeSpentMs: 10 }),
          factory.successTestResult({ id: 'spec2', timeSpentMs: 10 }),
          factory.successTestResult({ id: 'spec3', timeSpentMs: 10 }),
          factory.successTestResult({ id: 'spec4', timeSpentMs: 9 }),
        ],
        mutantCoverage: { static: { 4: 1, 5: 1, 6: 1, 7: 1 }, perTest: { spec1: { 1: 1 }, spec2: { 2: 1, 10: 1 }, spec3: { 3: 1, 8: 1, 9: 1 } } },
      });

      // Act
      await act(dryRunResult, mutants);

      // Assert
      expect(testInjector.logger.warn).not.called;
    });

    it('should not warn when the performance impact of a static mutant is estimated to be twice that of other mutants', async () => {
      // Arrange
      const mutants = [
        factory.mutant({ id: '1' }),
        factory.mutant({ id: '2' }),
        factory.mutant({ id: '3' }),
        factory.mutant({ id: '4' }), // static
        factory.mutant({ id: '5' }), // static
        factory.mutant({ id: '6' }), // static
        factory.mutant({ id: '7' }), // static
        factory.mutant({ id: '8' }),
        factory.mutant({ id: '9' }),
        factory.mutant({ id: '10' }),
      ];
      const dryRunResult = factory.completeDryRunResult({
        tests: [
          factory.successTestResult({ id: 'spec1', timeSpentMs: 10 }),
          factory.successTestResult({ id: 'spec2', timeSpentMs: 10 }),
          factory.successTestResult({ id: 'spec3', timeSpentMs: 10 }),
          factory.successTestResult({ id: 'spec4', timeSpentMs: 9 }),
        ],
        mutantCoverage: { static: { 4: 1, 5: 1, 6: 1, 7: 1 }, perTest: { spec1: { 1: 1 }, spec2: { 2: 1, 10: 1 }, spec3: { 3: 1, 8: 1, 9: 1 } } },
      });

      // Act
      await act(dryRunResult, mutants);

      // Assert
      expect(testInjector.logger.warn).not.called;
    });
  });
});

function assertIsRunPlan(plan: MutantTestPlan): asserts plan is MutantRunPlan {
  expect(plan.plan).eq(PlanKind.Run);
}
function calculateTimeout(netTime: number): number {
  return testInjector.options.timeoutMS + testInjector.options.timeoutFactor * netTime + TIME_OVERHEAD_MS;
}
