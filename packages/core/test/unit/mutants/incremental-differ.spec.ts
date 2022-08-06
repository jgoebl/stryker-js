import { Mutant, MutantStatus, schema } from '@stryker-mutator/api/core';
import { TestResult } from '@stryker-mutator/api/test-runner';
import { factory, testInjector } from '@stryker-mutator/test-helpers';
import { expect } from 'chai';
import { Location, MutationTestResult } from 'mutation-testing-report-schema/api';

import { IncrementalDiffer } from '../../../src/mutants/index.js';
import { createMutant } from '../../helpers/producers.js';

// Keep this files here for the indenting
const srcAddContent = `export function add(a, b) {
  return a + b;
}            
`;
const srcMultiplyContent = `export function multiply(a, b) {
  return a * b;
}`;
const testAddContent = `import { expect } from 'chai';
import { add } from '../src/add.js';

describe('add' () => {
  it('should result in 42 for 2 and 40', () => {
    expect(add(40, 2)).eq(42);
  });
});
`;
const testAddContentTwoTests = `import { expect } from 'chai';
import { add } from '../src/add.js';

describe('add' () => {
  it('should result in 42 for 2 and 40', () => {
    expect(add(40, 2)).eq(42);
  });
  it('should result in 42 for 45 and -3', () => {
    expect(add(45, -3)).eq(42);
  });
});
`;
const testAddContentWithTestGeneration = `import { expect } from 'chai';
import { add } from '../src/add.js';

describe('add' () => {
  for(const [a, b, answer] of [[40, 2, 42], [45, -3, 42]]) {
    it(\`should result in \${answer} for \${a} and \${b}\`, () => {
      expect(add(a, b)).eq(answer);
    });
  }
  it('should have name "add"', () => {
    expect(add.name).eq('add');
  });
});
`;

const testAddContentWithTestGenerationUpdated = `import { expect } from 'chai';
import { add } from '../src/add.js';

describe('add' () => {
  for(const [a, b, answer] of [[40, 2, 42], [45, -3, 42]]) {
    it(\`should result in \${answer} for \${a} and \${b}\`, () => {
      expect(add(a, b)).eq(answer);
    });
  }
  it('should have name "add"', () => {
    // Add a comment as change
    expect(add.name).eq('add');
  });
});
`;
const testAddContentTwoTestsUpdated = `import { expect } from 'chai';
import { add } from '../src/add.js';

describe('add' () => {
  it('should result in 42 for 2 and 40', () => {
    expect(add(40, 2)).eq(42);
  });
  it('should result in 42 for 46 and -4', () => {
    expect(add(46, -4)).eq(42);
  });
});
`;
const testMultiplyContent = `import { expect } from 'chai';
import { multiply } from '../src/multiply.js';

describe('multiply' () => {
  it('should result in 42 for 21 and 2', () => {
    expect(multiply(21, 2)).eq(42);
  });
});
`;

const srcAdd = 'src/add.js';
const srcMultiply = 'src/multiply.js';
const testAdd = 'test/add.spec.js';
const testMultiply = 'test/multiply.spec.js';

describe.only(IncrementalDiffer.name, () => {
  describe('mutant changes', () => {
    it('should copy status, statusReason, testsCompleted, killedBy and coveredBy if nothing changed', () => {
      // Arrange
      const currentFiles = new Map([[srcAdd, srcAddContent]]);
      const mutants = [createMinReplacementMutant()];
      const incrementalReport = createMinReplacementIncrementalReport();
      const sut = new IncrementalDiffer(incrementalReport, currentFiles, testInjector.logger);

      // Act
      const actualDiff = sut.diff(mutants, createAddTestCoverage(mutants));

      // Assert
      const expectedMutants = [
        createMutant({
          id: '2',
          fileName: srcAdd,
          replacement: '-',
          mutatorName: 'min-replacement',
          location: loc(1, 11, 1, 12),
          status: MutantStatus.Killed,
          statusReason: 'Killed by first test',
          testsCompleted: 2,
          killedBy: ['1'],
          coveredBy: ['1'],
        }),
      ];
      expect(actualDiff).deep.eq(expectedMutants);
    });

    it("should identify that a mutant hasn't changed if lines got added above", () => {
      // Arrange
      const currentFiles = new Map([[srcAdd, `import path from 'path';\n\n${srcAddContent}`]]);
      const mutants = [createMinReplacementMutant({ location: loc(3, 11, 3, 12) })];
      const incrementalReport = createMinReplacementIncrementalReport();
      const sut = new IncrementalDiffer(incrementalReport, currentFiles, testInjector.logger);

      // Act
      const actualDiff = sut.diff(mutants, createAddTestCoverage(mutants));

      // Assert
      expect(actualDiff[0].status).eq(MutantStatus.Killed);
    });

    it("should identify that a mutant hasn't changed if characters got added before", () => {
      // Arrange
      const comment = '/*text-added*/';
      const currentFiles = new Map([
        [
          srcAdd,
          srcAddContent
            .split('\n')
            .map((line, nr) => (nr === 1 ? `${comment}${line}` : line))
            .join('\n'),
        ],
      ]);
      const mutants = [createMinReplacementMutant({ location: loc(1, 11 + comment.length, 1, 12 + comment.length) })];
      const incrementalReport = createMinReplacementIncrementalReport();
      const sut = new IncrementalDiffer(incrementalReport, currentFiles, testInjector.logger);

      // Act
      const actualDiff = sut.diff(mutants, createAddTestCoverage(mutants));

      // Assert
      expect(actualDiff[0].status).eq(MutantStatus.Killed);
    });

    it("should identify that a mutant hasn't changed if lines got removed above", () => {
      // Arrange
      const currentFiles = new Map([[srcAdd, srcAddContent]]);
      const mutants = [createMinReplacementMutant()];
      const incrementalReport = createMinReplacementIncrementalReport({
        files: {
          [srcAdd]: factory.mutationTestReportSchemaFileResult({
            mutants: [createMinReplacementMutantResult({ location: loc(3, 11, 3, 12) })],
            source: `import path from "path"

          ${srcAddContent}`,
          }),
        },
      });
      const sut = new IncrementalDiffer(incrementalReport, currentFiles, testInjector.logger);

      // Act
      const actualDiff = sut.diff(mutants, createAddTestCoverage(mutants));

      // Assert
      expect(actualDiff[0].status).eq(MutantStatus.Killed);
    });

    it("should identify that a mutant hasn't changed if characters got removed before", () => {
      // Arrange
      const comment = '/*text-removed*/';
      const currentFiles = new Map([[srcAdd, srcAddContent]]);
      const mutants = [createMinReplacementMutant()];
      const incrementalReport = createMinReplacementIncrementalReport({
        files: {
          [srcAdd]: factory.mutationTestReportSchemaFileResult({
            mutants: [createMinReplacementMutantResult({ location: loc(1, 11 + comment.length, 1, 12 + comment.length) })],
            source: srcAddContent
              .split('\n')
              .map((line, nr) => (nr === 1 ? `${comment}${line}` : line))
              .join('\n'),
          }),
        },
      });
      const sut = new IncrementalDiffer(incrementalReport, currentFiles, testInjector.logger);

      // Act
      const actualDiff = sut.diff(mutants, createAddTestCoverage(mutants));

      // Assert
      expect(actualDiff[0].status).eq(MutantStatus.Killed);
    });

    it('should not reuse the status of a mutant in changed text', () => {
      // Arrange
      const currentFiles = new Map([[srcAdd, srcAddContent]]);
      const mutants = [createMinReplacementMutant()];
      const incrementalReport = createMinReplacementIncrementalReport({
        files: {
          [srcAdd]: factory.mutationTestReportSchemaFileResult({
            mutants: [createMinReplacementMutantResult()],
            source: srcAddContent.replace('+', '*'),
          }),
        },
      });
      const sut = new IncrementalDiffer(incrementalReport, currentFiles, testInjector.logger);

      // Act
      const actualDiff = sut.diff(mutants, createAddTestCoverage(mutants));

      // Assert
      expect(actualDiff[0].status).undefined;
    });

    it('should not copy the status if the mutant came from a different mutator', () => {
      // Arrange
      const currentFiles = new Map([[srcAdd, srcAddContent]]);
      const mutants = [createMinReplacementMutant()];
      const incrementalReport = createMinReplacementIncrementalReport({
        files: {
          [srcAdd]: factory.mutationTestReportSchemaFileResult({
            mutants: [createMinReplacementMutantResult({ mutatorName: 'max-replacement' })],
            source: srcAddContent,
          }),
        },
      });
      const sut = new IncrementalDiffer(incrementalReport, currentFiles, testInjector.logger);

      // Act
      const actualDiff = sut.diff(mutants, createAddTestCoverage(mutants));

      // Assert
      expect(actualDiff).deep.eq(mutants);
    });

    it('should not copy the status if the mutant has a different replacement', () => {
      // Arrange
      const currentFiles = new Map([[srcAdd, srcAddContent]]);
      const mutants = [createMinReplacementMutant()];
      const incrementalReport = createMinReplacementIncrementalReport({
        files: {
          [srcAdd]: factory.mutationTestReportSchemaFileResult({
            mutants: [createMinReplacementMutantResult({ replacement: 'other replacement' })],
            source: srcAddContent,
          }),
        },
      });
      const sut = new IncrementalDiffer(incrementalReport, currentFiles, testInjector.logger);

      // Act
      const actualDiff = sut.diff(mutants, createAddTestCoverage(mutants));

      // Assert
      expect(actualDiff).deep.eq(mutants);
    });

    it('should not copy the status if the mutant has a different location', () => {
      // Arrange
      const currentFiles = new Map([[srcAdd, srcAddContent]]);
      const mutants = [createMinReplacementMutant()];
      const incrementalReport = createMinReplacementIncrementalReport({
        files: {
          [srcAdd]: factory.mutationTestReportSchemaFileResult({
            mutants: [createMinReplacementMutantResult({ location: loc(2, 11, 2, 12) })],
            source: srcAddContent,
          }),
        },
      });
      const sut = new IncrementalDiffer(incrementalReport, currentFiles, testInjector.logger);

      // Act
      const actualDiff = sut.diff(mutants, createAddTestCoverage(mutants));

      // Assert
      expect(actualDiff).deep.eq(mutants);
    });

    it('should not copy the status if the mutant has a different file name', () => {
      // Arrange
      const currentFiles = new Map([[srcAdd, srcAddContent]]);
      const mutants = [createMinReplacementMutant()];
      const incrementalReport = createMinReplacementIncrementalReport({
        files: {
          ['src/some-other-file.js']: factory.mutationTestReportSchemaFileResult({
            mutants: [createMinReplacementMutantResult()],
            source: srcAddContent,
          }),
        },
      });
      const sut = new IncrementalDiffer(incrementalReport, currentFiles, testInjector.logger);

      // Act
      const actualDiff = sut.diff(mutants, createAddTestCoverage(mutants));

      // Assert
      expect(actualDiff).deep.eq(mutants);
    });
  });

  describe('test changes', () => {
    it('should identify that a mutant state can be reused when no tests changed', () => {
      // Arrange
      const currentFiles = new Map([[srcAdd, srcAddContent]]);
      const mutants = [createMinReplacementMutant({ coveredBy: ['2'] })];
      const tests = new Map(Object.entries({ [mutants[0].id]: new Set([createAddTestResult()]) }));
      const incrementalReport = createMinReplacementIncrementalReport();
      const sut = new IncrementalDiffer(incrementalReport, currentFiles, testInjector.logger);

      // Act
      const actualDiff = sut.diff(mutants, tests);

      // Assert
      expect(actualDiff[0].status).eq(MutantStatus.Killed);
    });

    describe('with test file changes', () => {
      it('should identify that mutant state can be reused with changes above', () => {
        // Arrange
        const currentFiles = new Map(
          Object.entries({
            [srcAdd]: srcAddContent,
            [testAdd]: `import foo from 'bar'

        ${testAddContent}`,
          })
        );
        const mutants = [createMinReplacementMutant({ coveredBy: ['2'] })];
        const tests = new Map(Object.entries({ [mutants[0].id]: new Set([createAddTestResult({ startPosition: pos(6, 2) })]) }));
        const incrementalReport = createMinReplacementIncrementalReport({
          testFiles: {
            [testAdd]: {
              source: testAddContent,
              tests: [createAddTestDefinition({ location: loc(4, 2) })],
            },
          },
        });
        const sut = new IncrementalDiffer(incrementalReport, currentFiles, testInjector.logger);

        // Act
        const actualDiff = sut.diff(mutants, tests);

        // Assert
        expect(actualDiff[0].status).eq(MutantStatus.Killed);
      });

      it('should identify that mutant state can be reused with changes before', () => {
        // Arrange
        const comment = '/*text-added*/';
        const currentFiles = new Map(
          Object.entries({
            [srcAdd]: srcAddContent,
            [testAdd]: testAddContent
              .split('\n')
              .map((line, nr) => (nr === 4 ? `${comment}${line}` : line))
              .join('\n'),
          })
        );
        const mutants = [createMinReplacementMutant({ coveredBy: ['2'] })];
        const tests = new Map(Object.entries({ [mutants[0].id]: new Set([createAddTestResult({ startPosition: pos(4, 2 + comment.length) })]) }));
        const incrementalReport = createMinReplacementIncrementalReport({
          testFiles: {
            [testAdd]: {
              source: testAddContent,
              tests: [createAddTestDefinition({ location: loc(4, 2) })],
            },
          },
        });
        const sut = new IncrementalDiffer(incrementalReport, currentFiles, testInjector.logger);

        // Act
        const actualDiff = sut.diff(mutants, tests);

        // Assert
        expect(actualDiff[0].status).eq(MutantStatus.Killed);
      });

      it('should identify that mutant state can be reused with changes below', () => {
        // Arrange
        const currentFiles = new Map(
          Object.entries({
            [srcAdd]: srcAddContent,
            [testAdd]: testAddContentTwoTests,
          })
        );
        const mutants = [createMinReplacementMutant({ coveredBy: ['2'] })];
        const tests = new Map(
          Object.entries({
            [mutants[0].id]: new Set([createAddSecondTestResult({ startPosition: pos(7, 2) }), createAddTestResult({ startPosition: pos(4, 2) })]),
          })
        );
        const incrementalReport = createMinReplacementIncrementalReport({
          testFiles: {
            [testAdd]: {
              source: testAddContent,
              tests: [createAddTestDefinition({ location: loc(4, 2, 6, 7) })],
            },
          },
        });
        const sut = new IncrementalDiffer(incrementalReport, currentFiles, testInjector.logger);

        // Act
        const actualDiff = sut.diff(mutants, tests);

        // Assert
        expect(actualDiff[0].status).eq(MutantStatus.Killed);
      });

      it('should identify that mutant state can be reused with changes behind', () => {
        // Arrange
        const comment = '/*text-added*/';
        const currentFiles = new Map(
          Object.entries({
            [srcAdd]: srcAddContent,
            [testAdd]: `${testAddContent}${comment}`,
          })
        );
        const mutants = [createMinReplacementMutant()];
        const tests = new Map(Object.entries({ [mutants[0].id]: new Set([createAddTestResult({ startPosition: pos(4, 2) })]) }));
        const incrementalReport = createMinReplacementIncrementalReport({
          testFiles: {
            [testAdd]: {
              source: testAddContent,
              tests: [createAddTestDefinition({ location: loc(4, 2, 6, 7) })],
            },
          },
        });
        const sut = new IncrementalDiffer(incrementalReport, currentFiles, testInjector.logger);

        // Act
        const actualDiff = sut.diff(mutants, tests);

        // Assert
        expect(actualDiff[0].status).eq(MutantStatus.Killed);
      });

      it('should not reuse a mutant state when a covering test gets code added', () => {
        // Arrange
        const code = 'addedText();';
        const currentFiles = new Map(
          Object.entries({
            [srcAdd]: srcAddContent,
            [testAdd]: testAddContent
              .split('\n')
              .map((line, nr) => (nr === 5 ? `  ${code}\n${line}` : line))
              .join('\n'),
          })
        );
        const mutants = [createMinReplacementMutant()];
        const tests = new Map(Object.entries({ [mutants[0].id]: new Set([createAddTestResult({ startPosition: pos(4, 2) })]) }));
        const incrementalReport = createMinReplacementIncrementalReport({
          files: {
            [srcAdd]: factory.mutationTestReportSchemaFileResult({
              source: srcAddContent,
              mutants: [createMinReplacementMutantResult({ killedBy: [], status: MutantStatus.NoCoverage })],
            }),
          },
          testFiles: {
            [testAdd]: {
              source: testAddContent,
              tests: [createAddTestDefinition({ location: loc(4, 2) })],
            },
          },
        });
        const sut = new IncrementalDiffer(incrementalReport, currentFiles, testInjector.logger);

        // Act
        const actualDiff = sut.diff(mutants, tests);

        // Assert
        expect(actualDiff[0].status).undefined;
      });

      it('should close locations of tests in the incremental report', () => {
        // All test runners currently only report the start positions of tests.
        // Add a workaround for 'inventing' the end position based on the next test's start position.
        // Arrange
        const currentFiles = new Map(
          Object.entries({
            [srcAdd]: srcAddContent,
            [testAdd]: testAddContentTwoTestsUpdated,
          })
        );
        const mutants = [createMinReplacementMutant()];
        const tests = new Map(
          Object.entries({
            [mutants[0].id]: new Set([createAddTestResult({ startPosition: pos(4, 2) })]),
          })
        );
        const incrementalReport = createMinReplacementIncrementalReport({
          testFiles: {
            [testAdd]: {
              source: testAddContentTwoTests,
              tests: [
                // Tests are presented deliberately in the wrong order, should be sorted by Stryker
                createAddSecondTestDefinition({ location: loc(7, 2) }),
                createAddTestDefinition({ location: loc(4, 2) }),
              ],
            },
          },
        });
        const sut = new IncrementalDiffer(incrementalReport, currentFiles, testInjector.logger);

        // Act
        const actualDiff = sut.diff(mutants, tests);

        // Assert
        expect(actualDiff[0].status).eq(MutantStatus.Killed);
      });

      it('should close locations for tests on the same location in the incremental report', () => {
        // Test cases can generate tests, make sure the correct end position is chosen in those cases
        // Arrange
        const currentFiles = new Map(
          Object.entries({
            [srcAdd]: srcAddContent,
            [testAdd]: testAddContentWithTestGenerationUpdated,
          })
        );
        const mutants = [createMinReplacementMutant()];
        const tests = new Map(
          Object.entries({
            [mutants[0].id]: new Set([
              createAddTestResult({ name: 'should have name "add"', startPosition: pos(9, 2) }),
              createAddWithTestGenerationTestResult(40, 2, 42),
              createAddWithTestGenerationTestResult(45, -3, 42),
            ]),
          })
        );
        const incrementalReport = createMinReplacementIncrementalReport({
          files: {
            [srcAdd]: factory.mutationTestReportSchemaFileResult({
              source: srcAddContent,
              mutants: [createMinReplacementMutantResult({ coveredBy: ['spec4', 'spec5'], killedBy: ['spec4'] })],
            }),
          },
          testFiles: {
            [testAdd]: {
              source: testAddContentWithTestGeneration,
              tests: [
                // Tests are presented deliberately in the wrong order, should be sorted by Stryker
                factory.mutationTestReportSchemaTestDefinition({ id: '23', name: 'should have name "add"', location: loc(9, 2) }),
                createAddWithTestGenerationTestDefinition('spec4', 40, 2, 42),
                createAddWithTestGenerationTestDefinition('spec5', 45, -3, 42),
              ],
            },
          },
        });
        const sut = new IncrementalDiffer(incrementalReport, currentFiles, testInjector.logger);

        // Act
        const actualDiff = sut.diff(mutants, tests);

        // Assert
        expect(actualDiff[0].status).eq(MutantStatus.Killed);
      });
    });

    it('should identify that a non-"Killed" state can be reused when a test is removed', () => {
      // Arrange
      const currentFiles = new Map([[srcAdd, srcAddContent]]);
      const mutants = [createMinReplacementMutant()];
      const tests = new Map(Object.entries({ [mutants[0].id]: new Set([createAddTestResult()]) }));
      const incrementalReport = createMinReplacementIncrementalReport({
        files: {
          [srcAdd]: factory.mutationTestReportSchemaFileResult({
            mutants: [createMinReplacementMutantResult({ status: MutantStatus.Survived, coveredBy: ['1', '2'] })],
            source: srcAddContent,
          }),
        },
        testFiles: {
          [testAdd]: factory.mutationTestReportSchemaTestFile({
            tests: [createAddTestDefinition({ id: '1' }), createAddTestDefinition({ id: '2', name: 'add(2,4) = 6' })],
          }),
        },
      });
      const sut = new IncrementalDiffer(incrementalReport, currentFiles, testInjector.logger);

      // Act
      const actualDiff = sut.diff(mutants, tests);

      // Assert
      expect(actualDiff[0].status).eq(MutantStatus.Survived);
    });

    it('should identify that a non-"Killed" state cannot be reused when a test is added', () => {
      // Arrange
      const currentFiles = new Map([[srcAdd, srcAddContent]]);
      const mutants = [createMinReplacementMutant()];
      const tests = new Map(Object.entries({ [mutants[0].id]: new Set([createAddTestResult(), createAddTestResult({ name: 'add(2, 4) = 6' })]) }));
      const incrementalReport = createMinReplacementIncrementalReport({
        files: {
          [srcAdd]: factory.mutationTestReportSchemaFileResult({
            mutants: [createMinReplacementMutantResult({ status: MutantStatus.Survived, coveredBy: ['1'] })],
            source: srcAddContent,
          }),
        },
      });
      const sut = new IncrementalDiffer(incrementalReport, currentFiles, testInjector.logger);

      // Act
      const actualDiff = sut.diff(mutants, tests);

      // Assert
      expect(actualDiff[0].status).undefined;
    });

    it('should identify that a "Killed" state can be reused when the killing test didn\'t change', () => {
      // Arrange
      const currentFiles = new Map([[srcAdd, srcAddContent]]);
      const mutants = [createMinReplacementMutant()];
      const tests = new Map(Object.entries({ [mutants[0].id]: new Set([createAddTestResult(), createAddTestResult({ name: 'add(2, 4) = 6' })]) }));
      const incrementalReport = createMinReplacementIncrementalReport({
        files: {
          [srcAdd]: factory.mutationTestReportSchemaFileResult({
            mutants: [createMinReplacementMutantResult({ status: MutantStatus.Killed, coveredBy: ['1'], killedBy: ['1'] })],
            source: srcAddContent,
          }),
        },
      });
      const sut = new IncrementalDiffer(incrementalReport, currentFiles, testInjector.logger);

      // Act
      const actualDiff = sut.diff(mutants, tests);

      // Assert
      expect(actualDiff[0].status).eq(MutantStatus.Killed);
    });

    it('should identify that a "Killed" state cannot be reused when the killing test was removed', () => {
      // Arrange
      const currentFiles = new Map([[srcAdd, srcAddContent]]);
      const mutants = [createMinReplacementMutant()];
      const tests = new Map(Object.entries({ [mutants[0].id]: new Set([createAddTestResult()]) }));
      const incrementalReport = createMinReplacementIncrementalReport({
        files: {
          [srcAdd]: factory.mutationTestReportSchemaFileResult({
            mutants: [createMinReplacementMutantResult({ status: MutantStatus.Killed, coveredBy: ['1', '2'], killedBy: ['2'] })],
            source: srcAddContent,
          }),
        },
        testFiles: {
          [testAdd]: factory.mutationTestReportSchemaTestFile({
            tests: [createAddTestDefinition(), createAddTestDefinition({ id: '2', name: 'add(2, 4) = 6' })],
          }),
        },
      });
      const sut = new IncrementalDiffer(incrementalReport, currentFiles, testInjector.logger);

      // Act
      const actualDiff = sut.diff(mutants, tests);

      // Assert
      expect(actualDiff[0].status).undefined;
    });
  });

  function createMinReplacementMutantResult(overrides?: Partial<schema.MutantResult>): schema.MutantResult {
    return factory.mutationTestReportSchemaMutantResult({
      id: '1',
      coveredBy: ['1'],
      killedBy: ['1'],
      replacement: '-',
      mutatorName: 'min-replacement',
      statusReason: 'Killed by first test',
      testsCompleted: 2,
      status: MutantStatus.Killed,
      location: loc(1, 11, 1, 12),
      ...overrides,
    });
  }

  function createMinReplacementIncrementalReport(overrides?: Partial<schema.MutationTestResult>): schema.MutationTestResult {
    return factory.mutationTestReportSchemaMutationTestResult({
      files: {
        [srcAdd]: factory.mutationTestReportSchemaFileResult({
          mutants: [createMinReplacementMutantResult()],
          source: srcAddContent,
        }),
      },
      testFiles: {
        [testAdd]: factory.mutationTestReportSchemaTestFile({
          source: testAddContent,
          tests: [createAddTestDefinition()],
        }),
      },
      ...overrides,
    });
  }

  function createAddTestCoverage(mutants: Mutant[]): Map<string, Set<TestResult>> {
    return new Map(mutants.map(({ id }) => [id, new Set([createAddTestResult()])]));
  }

  function createMinReplacementMutant(overrides?: Partial<Mutant>): Mutant {
    return createMutant({ id: '2', fileName: srcAdd, replacement: '-', mutatorName: 'min-replacement', location: loc(1, 11, 1, 12), ...overrides });
  }

  function createAddTestResult(overrides?: Partial<TestResult>): TestResult {
    return factory.testResult({ fileName: testAdd, name: 'add(2, 0) = 2', ...overrides });
  }
  function createAddSecondTestResult(overrides?: Partial<TestResult>): TestResult {
    return factory.testResult({ id: '2', fileName: testAdd, name: 'add(45, -3) = 42', ...overrides });
  }

  function createAddTestDefinition(overrides?: Partial<schema.TestDefinition>): schema.TestDefinition {
    return { id: '1', name: 'add(2, 0) = 2', ...overrides };
  }

  function createAddSecondTestDefinition(overrides?: Partial<schema.TestDefinition>): schema.TestDefinition {
    return { id: '2', name: 'add(45, -3) = 42', ...overrides };
  }

  function createAddWithTestGenerationTestResult(a: number, b: number, answer: number): TestResult {
    return factory.testResult({ fileName: testAdd, name: `should result in ${answer} for ${a} and ${b}`, startPosition: pos(5, 4) });
  }

  function createAddWithTestGenerationTestDefinition(id: string, a: number, b: number, answer: number): schema.TestDefinition {
    return factory.mutationTestReportSchemaTestDefinition({
      id,
      name: `should result in ${answer} for ${a} and ${b}`,
      location: loc(5, 4),
    });
  }

  function loc(startLine: number, startColumn: number): schema.OpenEndLocation;
  function loc(startLine: number, startColumn: number, endLine: number, endColumn: number): Location;
  function loc(startLine: number, startColumn: number, endLine?: number, endColumn?: number): schema.OpenEndLocation {
    return { start: { line: startLine, column: startColumn }, end: endLine ? { line: endLine, column: endColumn ?? 0 } : undefined };
  }

  function pos(line: number, column: number): schema.Position {
    return { line, column };
  }
});
