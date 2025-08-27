import * as fs from 'fs-extra';
import * as path from 'node:path';
import dayjs from 'dayjs';

const timestamp = dayjs().format('YYYYMMDD_HHmmss');

/**
 * Create a test directory for isolated testing
 */
export const createTestDirectory = async (
  categoryName: string,
  testName: string
): Promise<string> => {
  const testDir = path.join(
    process.cwd(),
    'test-results',
    timestamp,
    categoryName.replace(/\s+/g, '-'),
    testName.replace(/\s+/g, '-')
  );
  await fs.ensureDir(testDir);
  return testDir;
};

/**
 * Get a unique test port
 */
export const getTestPort = (basePort: number = 6000): number => {
  const pidComponent = process.pid % 1000;
  const randomComponent = Math.floor(Math.random() * 4000);
  return basePort + pidComponent + randomComponent;
};
