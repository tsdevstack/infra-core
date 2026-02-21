import { describe, it, expect } from '@rstest/core';
import { extractLockId } from './extract-lock-id';

describe('extractLockId', () => {
  it('should extract lock ID from terraform lock error output', () => {
    const output = `
Error: Error acquiring the state lock

Error message: ConditionalCheckFailedException: The conditional request failed
Lock Info:
  ID:        c7ea14eb-66e6-4f5e-3ee5-23bb545614f5
  Path:      tsdevstack-terraform-state-184979630067/dev/terraform.tfstate
  Operation: OperationTypeApply
`;

    expect(extractLockId(output)).toBe('c7ea14eb-66e6-4f5e-3ee5-23bb545614f5');
  });

  it('should return undefined when no lock ID is present', () => {
    const output = 'Some other error message without lock info';

    expect(extractLockId(output)).toBeUndefined();
  });

  it('should handle various UUID formats', () => {
    const output = 'ID:        12345678-1234-1234-1234-123456789abc';

    expect(extractLockId(output)).toBe('12345678-1234-1234-1234-123456789abc');
  });

  it('should handle output with extra whitespace', () => {
    const output = '  ID:     abcdef12-3456-7890-abcd-ef1234567890  ';

    expect(extractLockId(output)).toBe('abcdef12-3456-7890-abcd-ef1234567890');
  });

  it('should be case insensitive', () => {
    const output = 'ID:        ABCDEF12-3456-7890-ABCD-EF1234567890';

    expect(extractLockId(output)).toBe('ABCDEF12-3456-7890-ABCD-EF1234567890');
  });
});
