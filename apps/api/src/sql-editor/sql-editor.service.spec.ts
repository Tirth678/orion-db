import { BadRequestException } from '@nestjs/common';
import { SqlEditorService } from './sql-editor.service';
import { DrizzleService } from '../db/drizzle.service';
import { assertAndReport } from '../../test/test-logger';

describe('SqlEditorService Statement & Query Validation', () => {
  let service: SqlEditorService;
  let mockDrizzle: Partial<DrizzleService>;

  beforeEach(() => {
    mockDrizzle = {
      db: {} as any,
    };
    service = new SqlEditorService(mockDrizzle as DrizzleService);
  });

  // Positive Case 1: Valid single SQL query
  it('SQL-01 | Valid single SQL query parsing | Expected: Cleaned single statement', () => {
    const inputSql =
      "   SELECT id, name FROM users WHERE status = 'active';   ";

    const parsedStatements = (service as any).parseStatements(inputSql);

    assertAndReport(
      {
        id: 'SQL-01',
        name: 'Single statement parsing & sanitization',
        scenario: inputSql.trim(),
        expected:
          'Parsed single SQL statement string without trailing semicolons',
        actual: `statements.length=${parsedStatements.length}, statement="${parsedStatements[0]}"`,
      },
      () => {
        expect(parsedStatements).toHaveLength(1);
        expect(parsedStatements[0]).toBe(
          "SELECT id, name FROM users WHERE status = 'active'",
        );
      },
    );
  });

  // Positive Case 2: Multiple SQL statements (now allowed)
  it('SQL-02 | Multiple SQL statements execution | Expected: Allowed (returns array)', () => {
    const multiSql = 'SELECT * FROM users; DROP TABLE users;';

    const parsedStatements = (service as any).parseStatements(multiSql);

    assertAndReport(
      {
        id: 'SQL-02',
        name: 'Multi-statement parsing (allowed)',
        scenario: multiSql,
        expected: 'Parsed as 2 separate statements in array',
        actual: `statements.length=${parsedStatements.length}`,
      },
      () => {
        expect(parsedStatements).toHaveLength(2);
        expect(parsedStatements[0]).toBe('SELECT * FROM users');
        expect(parsedStatements[1]).toBe('DROP TABLE users');
      },
    );
  });

  // Negative Case 1: Empty SQL query
  it('SQL-03 | Empty SQL query execution attempt | Expected: Rejection (400)', () => {
    const emptySql = '   ;   ;  ';

    let error: any;
    try {
      (service as any).parseStatements(emptySql);
    } catch (err) {
      error = err;
    }

    assertAndReport(
      {
        id: 'SQL-03',
        name: 'Empty SQL query rejection',
        scenario: 'query="   ;   ;  " (no statements)',
        expected: 'HTTP 400 BadRequestException("SQL query cannot be empty")',
        actual: `HTTP ${error?.status || 400} BadRequest, message="${error?.message}"`,
      },
      () => {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe('SQL query cannot be empty');
      },
    );
  });

  // Negative Case 2: Blocked destructive statement (DROP DATABASE / TRUNCATE)
  it('SQL-04 | Destructive statement check (DROP DATABASE) | Expected: Rejection (400)', () => {
    const dangerousSql = 'DROP DATABASE orion_production';

    let error: any;
    try {
      service.assertAllowedStatements([dangerousSql]);
    } catch (err) {
      error = err;
    }

    assertAndReport(
      {
        id: 'SQL-04',
        name: 'Dangerous destructive SQL blocking',
        scenario: `statement="${dangerousSql}"`,
        expected:
          'HTTP 400 BadRequestException("This statement is not allowed")',
        actual: `HTTP ${error?.status || 400} BadRequest, message="${error?.message}"`,
      },
      () => {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe('This statement is not allowed');
      },
    );
  });

  // Negative Case 3: Block comment bypass attempt
  it('SQL-05 | Block comment bypass attempt (/* comment */ DROP SCHEMA) | Expected: Rejection (400)', () => {
    const bypassSql = '/* safe comment */ DROP SCHEMA "tenant_alpha"';

    let error: any;
    try {
      service.assertAllowedStatements([bypassSql]);
    } catch (err) {
      error = err;
    }

    assertAndReport(
      {
        id: 'SQL-05',
        name: 'Block comment bypass prevention',
        scenario: `statement="${bypassSql}"`,
        expected:
          'HTTP 400 BadRequestException("This statement is not allowed")',
        actual: `HTTP ${error?.status || 400} BadRequest, message="${error?.message}"`,
      },
      () => {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe('This statement is not allowed');
      },
    );
  });

  // Negative Case 4: Line comment bypass attempt
  it('SQL-06 | Line comment bypass attempt (-- comment\\nDROP DATABASE) | Expected: Rejection (400)', () => {
    const bypassSql = '-- harmless comment\nDROP DATABASE "prod_db"';

    let error: any;
    try {
      service.assertAllowedStatements([bypassSql]);
    } catch (err) {
      error = err;
    }

    assertAndReport(
      {
        id: 'SQL-06',
        name: 'Line comment bypass prevention',
        scenario: `statement="${bypassSql}"`,
        expected:
          'HTTP 400 BadRequestException("This statement is not allowed")',
        actual: `HTTP ${error?.status || 400} BadRequest, message="${error?.message}"`,
      },
      () => {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe('This statement is not allowed');
      },
    );
  });

  // Negative Case 5: CTE TRUNCATE bypass attempt
  it('SQL-07 | CTE TRUNCATE bypass attempt | Expected: Rejection (400)', () => {
    const bypassSql = 'WITH cte AS (SELECT 1) TRUNCATE TABLE users';

    let error: any;
    try {
      service.assertAllowedStatements([bypassSql]);
    } catch (err) {
      error = err;
    }

    assertAndReport(
      {
        id: 'SQL-07',
        name: 'CTE TRUNCATE bypass prevention',
        scenario: `statement="${bypassSql}"`,
        expected:
          'HTTP 400 BadRequestException("This statement is not allowed")',
        actual: `HTTP ${error?.status || 400} BadRequest, message="${error?.message}"`,
      },
      () => {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe('This statement is not allowed');
      },
    );
  });

  // Negative Case 6: Arbitrary whitespace/newlines bypass attempt
  it('SQL-08 | Whitespace/newlines bypass attempt (DROP \\n\\t SCHEMA) | Expected: Rejection (400)', () => {
    const bypassSql = 'DROP \n\t  SCHEMA "tenant_alpha"';

    let error: any;
    try {
      service.assertAllowedStatements([bypassSql]);
    } catch (err) {
      error = err;
    }

    assertAndReport(
      {
        id: 'SQL-08',
        name: 'Whitespace/newlines bypass prevention',
        scenario: 'statement="DROP \\n\\t  SCHEMA \\"tenant_alpha\\""',
        expected:
          'HTTP 400 BadRequestException("This statement is not allowed")',
        actual: `HTTP ${error?.status || 400} BadRequest, message="${error?.message}"`,
      },
      () => {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe('This statement is not allowed');
      },
    );
  });

  // Positive Case 3: String literal containing blocked words is permitted
  it('SQL-09 | String literal containing blocked keywords | Expected: Allowed (no exception)', () => {
    const benignSql =
      "SELECT * FROM audit_logs WHERE action = 'DROP DATABASE' OR action = 'TRUNCATE'";

    expect(() => service.assertAllowedStatements([benignSql])).not.toThrow();

    assertAndReport(
      {
        id: 'SQL-09',
        name: 'Benign string literal with blocked keywords permitted',
        scenario: benignSql,
        expected: 'Statement allowed without throwing BadRequestException',
        actual: 'No exception thrown',
      },
      () => {
        expect(true).toBe(true);
      },
    );
  });

  // Positive Case 4: Semicolon within string literal or comment parsed as single statement
  it('SQL-010 | Semicolon inside string literal or comment | Expected: Parsed as single statement', () => {
    const complexSql =
      "/* comment with ; semicolon */ SELECT 'first;second' AS pair;";

    const parsed = (service as any).parseStatements(complexSql);

    assertAndReport(
      {
        id: 'SQL-10',
        name: 'Semicolons in strings/comments preserved as single statement',
        scenario: complexSql,
        expected: 'Parsed as 1 statement without multi-statement error',
        actual: `statements.length=${parsed.length}, statement="${parsed[0]}"`,
      },
      () => {
        expect(parsed).toHaveLength(1);
        expect(parsed[0]).toBe(
          "/* comment with ; semicolon */ SELECT 'first;second' AS pair",
        );
      },
    );
  });
});
